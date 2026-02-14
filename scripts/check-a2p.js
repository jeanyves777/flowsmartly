// Quick script to check A2P registration state from DB + Twilio
require("dotenv").config();

async function main() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const config = await prisma.marketingConfig.findFirst({
      where: { smsPhoneNumber: { contains: "4133442723" } },
      include: { user: { select: { email: true, name: true } } },
    });

    if (!config) {
      console.log("No config found for this number");
      return;
    }

    console.log("=== DB State ===");
    console.log("User:", config.user.email, config.user.name);
    console.log("Phone:", config.smsPhoneNumber);
    console.log("Phone SID:", config.smsPhoneNumberSid);
    console.log("Business:", config.businessName);
    console.log("A2P Profile SID:", config.smsA2pProfileSid);
    console.log("A2P Brand SID:", config.smsA2pBrandSid);
    console.log("A2P Brand Status:", config.smsA2pBrandStatus);
    console.log("A2P Campaign SID:", config.smsA2pCampaignSid);
    console.log("A2P Campaign Status:", config.smsA2pCampaignStatus);
    console.log("Messaging Service SID:", config.smsA2pMessagingServiceSid);
    console.log("Emergency Address SID:", config.smsEmergencyAddressSid);

    // Now check Twilio for live status
    const twilio = require("twilio");
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    if (config.smsA2pBrandSid) {
      console.log("\n=== Twilio Brand Status (Live) ===");
      try {
        const brand = await client.messaging.v1.brandRegistrations(config.smsA2pBrandSid).fetch();
        console.log("Brand SID:", brand.sid);
        console.log("Status:", brand.status);
        console.log("Brand Type:", brand.brandType);
        console.log("A2P Profile SID:", brand.a2PProfileBundleSid);
        console.log("Customer Profile SID:", brand.customerProfileBundleSid);
        console.log("Failure Reason:", brand.failureReason || "none");
        console.log("Date Created:", brand.dateCreated);
        console.log("Date Updated:", brand.dateUpdated);
      } catch (e) {
        console.error("Brand fetch error:", e.message);
      }
    }

    // Check Starter Customer Profile status
    if (config.smsA2pProfileSid) {
      console.log("\n=== Starter Customer Profile (Live) ===");
      try {
        const profile = await client.trusthub.v1.customerProfiles(config.smsA2pProfileSid).fetch();
        console.log("Profile SID:", profile.sid);
        console.log("Status:", profile.status);
        console.log("Friendly Name:", profile.friendlyName);

        // Check evaluation results
        try {
          const evals = await client.trusthub.v1.customerProfiles(config.smsA2pProfileSid).customerProfilesEvaluations.list();
          for (const ev of evals) {
            console.log("Evaluation SID:", ev.sid);
            console.log("Evaluation Status:", ev.status);
            console.log("Results:", JSON.stringify(ev.results, null, 2));
          }
        } catch (e) {
          console.log("No evaluations available:", e.message);
        }
      } catch (e) {
        console.error("Profile fetch error:", e.message);
      }
    }

    // List all brand registrations to see full picture
    console.log("\n=== All Brand Registrations ===");
    try {
      const brands = await client.messaging.v1.brandRegistrations.list({ limit: 10 });
      for (const b of brands) {
        console.log(`  ${b.sid}: status=${b.status}, type=${b.brandType}, profile=${b.customerProfileBundleSid}, a2p=${b.a2PProfileBundleSid}, failure=${b.failureReason || "none"}`);
      }
    } catch (e) {
      console.error("List brands error:", e.message);
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
