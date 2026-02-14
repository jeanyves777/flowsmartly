// One-time script to submit A2P 10DLC registration for existing local number users
// Usage: npx tsx scripts/submit-a2p.js [--force] [--email user@example.com]
//   --force: Re-submit even if A2P brand already exists (creates new complete registration)
//   --email: Only process a specific user
require("dotenv").config();

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const emailIdx = args.indexOf("--email");
  const targetEmail = emailIdx !== -1 ? args[emailIdx + 1] : null;

  const mod = await import("../src/lib/twilio/index.ts");
  const twilio = mod.default || mod;
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const where = {
      smsPhoneNumber: { not: null },
      smsPhoneNumberSid: { not: null },
      ...(force ? {} : { smsA2pBrandSid: null }),
    };

    const configs = await prisma.marketingConfig.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    for (const config of configs) {
      // Filter by email if specified
      if (targetEmail && config.user.email !== targetEmail) continue;

      // Skip toll-free numbers
      if (/^\+1(800|833|844|855|866|877|888)/.test(config.smsPhoneNumber)) {
        console.log(`Skipping toll-free number ${config.smsPhoneNumber} for user ${config.user.email}`);
        continue;
      }

      if (!config.businessName || !config.businessStreetAddress) {
        console.log(`Skipping ${config.user.email} — missing business info`);
        continue;
      }

      console.log(`\nSubmitting A2P 10DLC for ${config.user.email} (${config.smsPhoneNumber})...`);
      if (force && config.smsA2pBrandSid) {
        console.log(`  (Force re-submit — replacing old brand ${config.smsA2pBrandSid})`);
      }

      let messageSamples = [];
      try { messageSamples = JSON.parse(config.smsMessageSamples || "[]"); } catch {}
      if (messageSamples.length === 0) {
        messageSamples = [`Hi from ${config.businessName}! Thanks for subscribing. Reply STOP to opt out.`];
      }

      const nameParts = (config.user.name || "").split(" ");
      const firstName = nameParts[0] || config.businessName;
      const lastName = nameParts.slice(1).join(" ") || "Owner";

      const result = await twilio.submitA2p10DlcRegistration({
        phoneNumberSid: config.smsPhoneNumberSid,
        phoneNumber: config.smsPhoneNumber,
        businessName: config.businessName,
        businessWebsite: config.businessWebsite || "",
        businessStreetAddress: config.businessStreetAddress,
        businessCity: config.businessCity || "",
        businessStateProvinceRegion: config.businessStateProvinceRegion || "",
        businessPostalCode: config.businessPostalCode || "",
        businessCountry: config.businessCountry || "US",
        contactEmail: config.user.email,
        contactFirstName: firstName,
        contactLastName: lastName,
        contactPhone: config.smsPhoneNumber,
        useCaseDescription: config.smsUseCaseDescription || `${config.businessName} uses SMS for marketing to opted-in subscribers.`,
        messageSamples,
        smsUseCase: config.smsUseCase || "marketing",
        privacyPolicyUrl: config.privacyPolicyUrl || undefined,
        termsOfServiceUrl: config.termsOfServiceUrl || undefined,
        optOutMessage: config.optOutMessage || undefined,
      });

      console.log("Result:", JSON.stringify(result, null, 2));

      if (result.success) {
        await prisma.marketingConfig.update({
          where: { userId: config.userId },
          data: {
            smsA2pProfileSid: result.profileSid || null,
            smsA2pBrandSid: result.brandSid || null,
            smsA2pBrandStatus: result.brandStatus || "PENDING",
            smsA2pMessagingServiceSid: result.messagingServiceSid || null,
            smsA2pCampaignSid: result.campaignSid || null,
            smsA2pCampaignStatus: result.campaignStatus || null,
            smsEmergencyAddressSid: result.emergencyAddressSid || null,
          },
        });
        console.log("DB updated successfully for", config.user.email);
      } else {
        console.error("Failed for", config.user.email, ":", result.error, "at step:", result.step);
      }
    }

    if (configs.length === 0) {
      console.log("No users found matching criteria.");
      if (!force) console.log("Tip: Use --force to re-submit for users with existing registrations.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
