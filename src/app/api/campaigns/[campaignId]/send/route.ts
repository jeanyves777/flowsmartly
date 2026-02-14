import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import {
  sendMarketingEmail,
  validateEmailConfig,
  replaceMergeTags,
} from "@/lib/email/marketing-sender";
import { applyEmailTracking } from "@/lib/email/tracking";
import { sendSMS, formatPhoneNumber } from "@/lib/twilio";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { triggerActivitySyncForUser } from "@/lib/strategy/activity-matcher";
import { compositeImageWithText } from "@/lib/media/image-compositor";
import { uploadToS3 } from "@/lib/utils/s3-client";

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000; // 1 second between batches

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST /api/campaigns/[campaignId]/send - Send or schedule a campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId: session.userId },
      include: {
        contactList: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: { message: "Campaign not found" } },
        { status: 404 }
      );
    }

    // Cannot send already sent campaigns
    if (campaign.status === "SENT") {
      return NextResponse.json(
        { success: false, error: { message: "Campaign has already been sent" } },
        { status: 400 }
      );
    }

    // Must have a contact list
    if (!campaign.contactListId) {
      return NextResponse.json(
        { success: false, error: { message: "No contact list selected for this campaign" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, scheduledAt } = body;

    if (!action || !["send", "schedule"].includes(action)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid action. Use 'send' or 'schedule'." } },
        { status: 400 }
      );
    }

    if (action === "schedule") {
      if (!scheduledAt) {
        return NextResponse.json(
          { success: false, error: { message: "Scheduled time is required" } },
          { status: 400 }
        );
      }

      const scheduleDate = new Date(scheduledAt);
      if (scheduleDate <= new Date()) {
        return NextResponse.json(
          { success: false, error: { message: "Scheduled time must be in the future" } },
          { status: 400 }
        );
      }

      // Update campaign to scheduled
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: "SCHEDULED",
          scheduledAt: scheduleDate,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          message: "Campaign scheduled successfully",
          scheduledAt: scheduleDate.toISOString(),
        },
      });
    }

    // Send immediately
    // For EMAIL campaigns, validate the user's email provider configuration first
    let marketingConfig: {
      emailProvider: string;
      emailConfig: string;
      emailEnabled: boolean;
      emailVerified: boolean;
      emailMonthlyLimit: number;
      emailSentThisMonth: number;
      defaultFromName: string | null;
      defaultFromEmail: string | null;
      defaultReplyTo: string | null;
      id: string;
    } | null = null;

    let emailProvider = "";
    let emailConfig: Record<string, unknown> = {};
    let fromAddress = "";

    if (campaign.type === "EMAIL") {
      marketingConfig = await prisma.marketingConfig.findUnique({
        where: { userId: session.userId },
        select: {
          id: true,
          emailProvider: true,
          emailConfig: true,
          emailEnabled: true,
          emailVerified: true,
          emailMonthlyLimit: true,
          emailSentThisMonth: true,
          defaultFromName: true,
          defaultFromEmail: true,
          defaultReplyTo: true,
        },
      });

      if (!marketingConfig) {
        return NextResponse.json(
          { success: false, error: { message: "Email provider not configured. Go to Settings > Marketing to set up your email provider." } },
          { status: 400 }
        );
      }

      if (!marketingConfig.emailEnabled && !marketingConfig.emailVerified) {
        return NextResponse.json(
          { success: false, error: { message: "Email sending is not enabled. Go to Settings > Marketing to enable it." } },
          { status: 400 }
        );
      }

      emailProvider = marketingConfig.emailProvider;
      try {
        emailConfig = JSON.parse(marketingConfig.emailConfig);
      } catch {
        return NextResponse.json(
          { success: false, error: { message: "Invalid email configuration. Please re-configure your email provider in Settings." } },
          { status: 400 }
        );
      }

      const validationError = validateEmailConfig(emailProvider, emailConfig);
      if (validationError) {
        return NextResponse.json(
          { success: false, error: { message: validationError } },
          { status: 400 }
        );
      }

      // Determine the "from" address
      const fromName = campaign.fromName || marketingConfig.defaultFromName || "";
      const fromEmail = (emailConfig.fromEmail as string) || marketingConfig.defaultFromEmail || "";
      if (!fromEmail) {
        return NextResponse.json(
          { success: false, error: { message: "No from email address configured. Set one in your email provider settings or campaign settings." } },
          { status: 400 }
        );
      }
      fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    }

    // Get contacts from the list
    const listMembers = await prisma.contactListMember.findMany({
      where: { contactListId: campaign.contactListId },
      include: {
        contact: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            status: true,
            emailOptedIn: true,
            smsOptedIn: true,
          },
        },
      },
    });

    // Filter active contacts with proper opt-in
    const validContacts = listMembers.filter((m) => {
      if (m.contact.status !== "ACTIVE") return false;
      if (campaign.type === "EMAIL" && (!m.contact.email || !m.contact.emailOptedIn)) return false;
      if (campaign.type === "SMS" && (!m.contact.phone || !m.contact.smsOptedIn)) return false;
      return true;
    });

    if (validContacts.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "No valid contacts to send to" } },
        { status: 400 }
      );
    }

    // Get existing sends to avoid duplicates
    const existingSends = await prisma.campaignSend.findMany({
      where: { campaignId },
      select: { contactId: true },
    });
    const existingContactIds = new Set(existingSends.map((s) => s.contactId));

    // Filter out contacts that already have send records
    const newContacts = validContacts.filter((m) => !existingContactIds.has(m.contact.id));

    if (newContacts.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: "All contacts have already been sent to",
          sentTo: 0,
          sentAt: new Date().toISOString(),
        },
      });
    }

    // Check monthly email limit before sending
    if (campaign.type === "EMAIL" && marketingConfig) {
      const remaining = marketingConfig.emailMonthlyLimit - marketingConfig.emailSentThisMonth;
      if (remaining < newContacts.length) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: `Monthly email limit would be exceeded. You have ${remaining} emails remaining this month but need to send ${newContacts.length}. Upgrade your plan or wait until next month.`,
            },
          },
          { status: 400 }
        );
      }
    }

    // Mark campaign as SENDING
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "SENDING" },
    });

    // ------------------------------------------------------------------
    // EMAIL campaigns: actually deliver each email through the provider
    // ------------------------------------------------------------------
    if (campaign.type === "EMAIL" && marketingConfig) {
      // Check credit balance before sending emails
      const emailCreditCost = await getDynamicCreditCost("EMAIL_SEND");
      const totalEmailCost = emailCreditCost * newContacts.length;
      const emailCreditBalance = await creditService.getBalance(session.userId);

      if (emailCreditBalance < totalEmailCost) {
        // Reset campaign status since we can't send
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: "DRAFT" },
        });
        return NextResponse.json(
          {
            success: false,
            error: {
              message: `Insufficient credits. You need ${totalEmailCost} credits to send ${newContacts.length} emails. Current balance: ${emailCreditBalance}.`,
            },
          },
          { status: 402 }
        );
      }

      let successCount = 0;
      let failureCount = 0;

      const replyTo = campaign.replyTo || marketingConfig.defaultReplyTo || undefined;

      // Process contacts in batches
      for (let i = 0; i < newContacts.length; i += BATCH_SIZE) {
        const batch = newContacts.slice(i, i + BATCH_SIZE);

        // Send each email in the batch concurrently
        const results = await Promise.allSettled(
          batch.map(async (member) => {
            const contact = member.contact;

            // 1. Create CampaignSend record first (PENDING) to get ID for tracking
            const sendRecord = await prisma.campaignSend.create({
              data: {
                campaignId,
                contactId: contact.id,
                status: "PENDING",
              },
            });

            // 2. Personalize subject and content with merge tags
            const personalizedSubject = replaceMergeTags(
              campaign.subject || campaign.name,
              contact
            );
            let personalizedHtml = replaceMergeTags(
              campaign.contentHtml || campaign.content,
              contact
            );
            const personalizedText = replaceMergeTags(campaign.content, contact);

            // 2b. Embed inline image if campaign has one
            if (personalizedHtml && (campaign.imageUrl || campaign.imageSource === "contact_photo")) {
              let inlineImageUrl: string | undefined;

              if (campaign.imageSource === "contact_photo") {
                // Per-recipient: use contact's photo
                if (contact.imageUrl) {
                  if (campaign.imageOverlayText) {
                    try {
                      const overlayText = replaceMergeTags(campaign.imageOverlayText, contact);
                      const pngBuf = await compositeImageWithText({
                        baseImageUrl: contact.imageUrl,
                        text: overlayText,
                      });
                      const key = `composited/email-${campaignId}-${contact.id}-${Date.now()}.png`;
                      inlineImageUrl = await uploadToS3(key, pngBuf, "image/png");
                    } catch {
                      inlineImageUrl = contact.imageUrl;
                    }
                  } else {
                    inlineImageUrl = contact.imageUrl;
                  }
                }
              } else if (campaign.imageUrl) {
                inlineImageUrl = campaign.imageUrl;
              }

              if (inlineImageUrl) {
                const imgTag = `<div style="text-align:center;margin:20px 0;padding:0;"><img src="${inlineImageUrl}" alt="" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:8px;" /></div>`;
                // Insert image after first paragraph (greeting) for natural flow
                const firstPClose = personalizedHtml.indexOf("</p>");
                if (firstPClose !== -1) {
                  const insertAt = firstPClose + 4;
                  personalizedHtml = personalizedHtml.slice(0, insertAt) + imgTag + personalizedHtml.slice(insertAt);
                } else {
                  // Fallback: after <body> tag or prepend
                  const insertPoint = personalizedHtml.search(/<body[^>]*>/i);
                  if (insertPoint !== -1) {
                    const afterBody = personalizedHtml.indexOf(">", insertPoint) + 1;
                    personalizedHtml = personalizedHtml.slice(0, afterBody) + imgTag + personalizedHtml.slice(afterBody);
                  } else {
                    personalizedHtml = imgTag + personalizedHtml;
                  }
                }
              }
            }

            // 3. Inject tracking pixel + rewrite links for click tracking
            if (personalizedHtml) {
              personalizedHtml = applyEmailTracking(personalizedHtml, sendRecord.id);
            }

            // 4. Send the email
            const result = await sendMarketingEmail({
              provider: emailProvider,
              emailConfig,
              from: fromAddress,
              to: contact.email!,
              subject: personalizedSubject,
              html: personalizedHtml,
              text: personalizedText,
              replyTo,
            });

            // 5. Update CampaignSend with real status + delivery timestamp
            await prisma.campaignSend.update({
              where: { id: sendRecord.id },
              data: {
                status: result.success ? "SENT" : "FAILED",
                sentAt: result.success ? new Date() : null,
                deliveredAt: result.success ? new Date() : null,
              },
            });

            return result;
          })
        );

        // Tally up results
        for (const result of results) {
          if (result.status === "fulfilled" && result.value.success) {
            successCount++;
          } else {
            failureCount++;
            // Log failures for debugging
            if (result.status === "fulfilled" && result.value.error) {
              console.error(`Campaign ${campaignId} send failed:`, result.value.error);
            } else if (result.status === "rejected") {
              console.error(`Campaign ${campaignId} send rejected:`, result.reason);
            }
          }
        }

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < newContacts.length) {
          await sleep(BATCH_DELAY_MS);
        }
      }

      // Update monthly usage counter
      await prisma.marketingConfig.update({
        where: { id: marketingConfig.id },
        data: {
          emailSentThisMonth: {
            increment: successCount,
          },
        },
      });

      // Deduct credits for successfully sent emails
      if (successCount > 0) {
        const emailCreditsToDeduct = emailCreditCost * successCount;
        await creditService.deductCredits({
          userId: session.userId,
          type: TRANSACTION_TYPES.USAGE,
          amount: emailCreditsToDeduct,
          description: `Email campaign "${campaign.name}": ${successCount} emails sent`,
          referenceType: "email_campaign",
          referenceId: campaignId,
        });
      }

      // Update campaign with actual counts
      const totalSent = existingSends.length + successCount;
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          sentCount: totalSent,
          deliveredCount: totalSent, // Actual delivery tracking happens via webhooks
        },
      });

      // Fire-and-forget: sync strategy tasks after email campaign sent
      triggerActivitySyncForUser(session.userId).catch((err) =>
        console.error("Activity sync hook (email campaign) failed:", err)
      );

      return NextResponse.json({
        success: true,
        data: {
          message:
            failureCount > 0
              ? `Campaign sent with ${failureCount} failure(s)`
              : "Campaign sent successfully",
          sentTo: successCount,
          failed: failureCount,
          creditsDeducted: emailCreditCost * successCount,
          sentAt: new Date().toISOString(),
        },
      });
    }

    // ------------------------------------------------------------------
    // SMS campaigns: deliver via Twilio
    // ------------------------------------------------------------------
    // Plan gate: SMS campaigns require Pro plan or higher
    const gate = checkPlanAccess(session.user.plan, "SMS messaging");
    if (gate) return gate;

    // Get user's SMS phone number from marketing config
    const smsConfig = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        smsEnabled: true,
        smsPhoneNumber: true,
        smsMonthlyLimit: true,
        smsSentThisMonth: true,
        smsComplianceStatus: true,
        smsTollfreeVerifyStatus: true,
        smsA2pBrandStatus: true,
        smsA2pCampaignStatus: true,
        optOutMessage: true,
      },
    });

    if (!smsConfig?.smsEnabled || !smsConfig.smsPhoneNumber) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "DRAFT" },
      });
      return NextResponse.json(
        { success: false, error: { message: "SMS is not enabled. Go to Settings > SMS Marketing to rent a phone number." } },
        { status: 400 }
      );
    }

    // Check compliance status
    if (smsConfig.smsComplianceStatus !== "APPROVED") {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "DRAFT" },
      });
      const msg = smsConfig.smsComplianceStatus === "SUSPENDED"
        ? "Your SMS access has been suspended. Contact support."
        : "SMS compliance verification required before sending campaigns.";
      return NextResponse.json(
        { success: false, error: { message: msg } },
        { status: 403 }
      );
    }

    // Check toll-free verification status — must be approved before sending
    if (smsConfig.smsTollfreeVerifyStatus && smsConfig.smsTollfreeVerifyStatus !== "TWILIO_APPROVED") {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "DRAFT" },
      });
      const msg = smsConfig.smsTollfreeVerifyStatus === "TWILIO_REJECTED"
        ? "Your toll-free number verification was rejected. Please contact support or submit a new verification."
        : "Your toll-free number is still under carrier review. You can send SMS campaigns once verification is approved (typically 1-5 business days).";
      return NextResponse.json(
        { success: false, error: { message: msg } },
        { status: 403 }
      );
    }

    // Check A2P 10DLC registration for local (non-toll-free) numbers
    const isTollFreeNumber = smsConfig.smsPhoneNumber && /^\+1(800|833|844|855|866|877|888)/.test(smsConfig.smsPhoneNumber);
    if (!isTollFreeNumber && smsConfig.smsA2pBrandStatus) {
      const brandOk = smsConfig.smsA2pBrandStatus === "APPROVED";
      const campaignOk = smsConfig.smsA2pCampaignStatus === "VERIFIED" || smsConfig.smsA2pCampaignStatus === "SUCCESSFUL";

      if (!brandOk || !campaignOk) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: "DRAFT" },
        });
        let msg: string;
        if (smsConfig.smsA2pBrandStatus === "FAILED") {
          msg = "Your A2P 10DLC brand registration failed. Please resubmit from Settings > SMS Marketing.";
        } else if (smsConfig.smsA2pCampaignStatus === "FAILED") {
          msg = "Your A2P 10DLC campaign registration failed. Please resubmit from Settings > SMS Marketing.";
        } else {
          msg = "Your local number requires A2P 10DLC registration to send SMS. Registration is still pending carrier review (typically 1-7 business days). Check status in Settings > SMS Marketing.";
        }
        return NextResponse.json(
          { success: false, error: { message: msg } },
          { status: 403 }
        );
      }
    }

    // Check SMS monthly limit
    const smsRemaining = smsConfig.smsMonthlyLimit - smsConfig.smsSentThisMonth;
    if (smsRemaining < newContacts.length) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "DRAFT" },
      });
      return NextResponse.json(
        { success: false, error: { message: `Monthly SMS limit would be exceeded. You have ${smsRemaining} messages remaining but need ${newContacts.length}.` } },
        { status: 400 }
      );
    }

    // Determine if this is an MMS campaign
    const campaignIsMMS = !!campaign.imageUrl || campaign.imageSource === "contact_photo";
    const creditsPerSms = campaignIsMMS
      ? await getDynamicCreditCost("MMS_SEND")
      : await getDynamicCreditCost("SMS_SEND");
    const totalCreditsNeeded = creditsPerSms * newContacts.length;
    const creditBalance = await creditService.getBalance(session.userId);

    if (creditBalance < totalCreditsNeeded) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "DRAFT" },
      });
      return NextResponse.json(
        { success: false, error: { message: `Insufficient credits. You need ${totalCreditsNeeded} credits to send ${newContacts.length} messages. Current balance: ${creditBalance}.` } },
        { status: 400 }
      );
    }

    let smsSuccessCount = 0;
    let smsFailureCount = 0;

    // Process SMS in batches
    for (let i = 0; i < newContacts.length; i += BATCH_SIZE) {
      const batch = newContacts.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (member) => {
          const contact = member.contact;

          // Create PENDING send record
          const sendRecord = await prisma.campaignSend.create({
            data: {
              campaignId,
              contactId: contact.id,
              status: "PENDING",
            },
          });

          // Personalize message with merge tags
          let personalizedMessage = replaceMergeTags(campaign.content, contact);

          // Auto-append opt-out text if not already present
          if (!personalizedMessage.toUpperCase().includes("STOP")) {
            const optOut = smsConfig.optOutMessage || "Reply STOP to unsubscribe";
            personalizedMessage += `\n\n${optOut}`;
          }

          // Determine MMS media URL for this contact
          let contactMediaUrl: string | undefined;
          if (campaign.imageSource === "contact_photo" && contact.imageUrl) {
            if (campaign.imageOverlayText) {
              // Composite personalized text on the contact's photo
              const personalizedOverlay = replaceMergeTags(campaign.imageOverlayText, contact);
              try {
                const pngBuffer = await compositeImageWithText({
                  baseImageUrl: contact.imageUrl,
                  text: personalizedOverlay,
                });
                const key = `media/mms-${campaignId}-${contact.id}-${Date.now()}.png`;
                contactMediaUrl = await uploadToS3(key, pngBuffer, "image/png");
              } catch (err) {
                console.error(`Composite failed for contact ${contact.id}:`, err);
                // Fall back to plain contact photo
                contactMediaUrl = contact.imageUrl;
              }
            } else {
              contactMediaUrl = contact.imageUrl;
            }
          } else if (campaign.imageUrl) {
            contactMediaUrl = campaign.imageUrl;
          }

          // Build status callback URL for delivery tracking
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
          const statusCallback = appUrl.startsWith("https://")
            ? `${appUrl}/api/sms/status-callback`
            : undefined;

          // Send via Twilio
          const result = await sendSMS({
            from: smsConfig.smsPhoneNumber!,
            to: formatPhoneNumber(contact.phone!),
            body: personalizedMessage,
            ...(contactMediaUrl ? { mediaUrl: contactMediaUrl } : {}),
            ...(statusCallback ? { statusCallback } : {}),
          });

          // Update send record — store Twilio message SID for tracking
          // Do NOT set deliveredAt here — wait for Twilio status callback
          await prisma.campaignSend.update({
            where: { id: sendRecord.id },
            data: {
              messageId: result.messageId || null,
              status: result.success ? "SENT" : "FAILED",
              sentAt: result.success ? new Date() : null,
              failureReason: result.success ? null : (result.error || "Send failed"),
            },
          });

          return result;
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.success) {
          smsSuccessCount++;
        } else {
          smsFailureCount++;
          if (result.status === "fulfilled" && result.value.error) {
            console.error(`SMS campaign ${campaignId} send failed:`, result.value.error);
          } else if (result.status === "rejected") {
            console.error(`SMS campaign ${campaignId} send rejected:`, result.reason);
          }
        }
      }

      // Rate limiting delay between batches
      if (i + BATCH_SIZE < newContacts.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    // Deduct credits for successful sends
    if (smsSuccessCount > 0) {
      const creditsToDeduct = creditsPerSms * smsSuccessCount;
      await creditService.deductCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: creditsToDeduct,
        description: `${campaignIsMMS ? "MMS" : "SMS"} campaign "${campaign.name}": ${smsSuccessCount} messages sent`,
        referenceType: "sms_campaign",
        referenceId: campaignId,
      });

      // Update monthly SMS counter
      await prisma.marketingConfig.update({
        where: { id: smsConfig.id },
        data: {
          smsSentThisMonth: {
            increment: smsSuccessCount,
          },
        },
      });
    }

    // Update campaign status and counts
    // deliveredCount starts at 0 — will be updated by Twilio status callbacks
    const totalSmsSent = existingSends.length + smsSuccessCount;
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sentCount: totalSmsSent,
        deliveredCount: 0,
        failedCount: smsFailureCount,
      },
    });

    // Fire-and-forget: sync strategy tasks after SMS campaign sent
    triggerActivitySyncForUser(session.userId).catch((err) =>
      console.error("Activity sync hook (SMS campaign) failed:", err)
    );

    return NextResponse.json({
      success: true,
      data: {
        message:
          smsFailureCount > 0
            ? `Campaign sent with ${smsFailureCount} failure(s)`
            : "Campaign sent successfully",
        sentTo: smsSuccessCount,
        failed: smsFailureCount,
        creditsDeducted: creditsPerSms * smsSuccessCount,
        sentAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Send campaign error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to send campaign" } },
      { status: 500 }
    );
  }
}
