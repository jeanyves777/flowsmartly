// Debug A2P: check all existing profiles, policies, and find a working approach
require("dotenv").config();

async function main() {
  const twilio = require("twilio");
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  // List all customer profiles and their statuses
  console.log("=== All Customer Profiles ===");
  try {
    const profiles = await client.trusthub.v1.customerProfiles.list({ limit: 20 });
    for (const p of profiles) {
      console.log(`  ${p.sid}: status=${p.status}, name="${p.friendlyName}", policy=${p.policySid}`);
    }
  } catch (e) {
    console.error("List profiles error:", e.message);
  }

  // List all trust products and their statuses
  console.log("\n=== All Trust Products ===");
  try {
    const products = await client.trusthub.v1.trustProducts.list({ limit: 20 });
    for (const p of products) {
      console.log(`  ${p.sid}: status=${p.status}, name="${p.friendlyName}", policy=${p.policySid}`);
    }
  } catch (e) {
    console.error("List trust products error:", e.message);
  }

  // List all policies
  console.log("\n=== Available Policies ===");
  try {
    const policies = await client.trusthub.v1.policies.list();
    for (const p of policies) {
      console.log(`  ${p.sid}: "${p.friendlyName}"`);
    }
  } catch (e) {
    console.error("List policies error:", e.message);
  }

  // Check the approved profile BU6ec0e3a256cf2290e8fa70370cb48240
  console.log("\n=== Approved Profile BU6ec0e3a256cf2290e8fa70370cb48240 ===");
  try {
    const profile = await client.trusthub.v1.customerProfiles("BU6ec0e3a256cf2290e8fa70370cb48240").fetch();
    console.log("SID:", profile.sid);
    console.log("Status:", profile.status);
    console.log("Policy SID:", profile.policySid);
    console.log("Friendly Name:", profile.friendlyName);

    // Get its assignments
    const assignments = await client.trusthub.v1.customerProfiles(profile.sid).customerProfilesEntityAssignments.list();
    for (const a of assignments) {
      console.log(`  Assignment: ${a.objectSid}`);
    }
  } catch (e) {
    console.error("Fetch approved profile error:", e.message);
  }

  // Check the other approved profile
  console.log("\n=== Approved Profile BUc839f4c87f47e7f50b53ec4fd674ca03 ===");
  try {
    const profile = await client.trusthub.v1.customerProfiles("BUc839f4c87f47e7f50b53ec4fd674ca03").fetch();
    console.log("SID:", profile.sid);
    console.log("Status:", profile.status);
    console.log("Policy SID:", profile.policySid);
    console.log("Friendly Name:", profile.friendlyName);
  } catch (e) {
    console.error("Fetch approved profile error:", e.message);
  }

  // Check what policy "Primary Business Profile" might use
  console.log("\n=== End User Types ===");
  try {
    const types = await client.trusthub.v1.endUserTypes.list();
    for (const t of types) {
      if (t.machineName.includes("business") || t.machineName.includes("primary") || t.machineName.includes("customer")) {
        console.log(`  ${t.machineName}: "${t.friendlyName}"`);
        console.log(`    Fields:`, JSON.stringify(t.fields));
      }
    }
  } catch (e) {
    console.error("List end user types error:", e.message);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
