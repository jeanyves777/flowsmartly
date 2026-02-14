/**
 * Test Webhook Script
 *
 * Simulates a Stripe webhook event for local testing.
 * This works because our webhook handler processes events without
 * signature verification when STRIPE_WEBHOOK_SECRET is not set.
 *
 * Run with: npx tsx scripts/test-webhook.ts
 */

const WEBHOOK_URL = "http://localhost:3000/api/payments/webhook";

// Simulated checkout.session.completed event for credit purchase
const creditPurchaseEvent = {
  id: "evt_test_" + Date.now(),
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_" + Date.now(),
      object: "checkout.session",
      customer: "cus_test123",
      metadata: {
        userId: process.argv[2] || "test-user-id", // Pass userId as argument
        type: "credit_purchase",
        packageId: "credits_500",
        credits: "500",
        bonus: "50",
      },
    },
  },
};

// Simulated checkout.session.completed event for subscription
const subscriptionEvent = {
  id: "evt_test_" + Date.now(),
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_" + Date.now(),
      object: "checkout.session",
      customer: "cus_test123",
      metadata: {
        userId: process.argv[2] || "test-user-id",
        type: "subscription",
        planId: "PRO",
        monthlyCredits: "2500",
      },
    },
  },
};

async function sendTestWebhook(event: object, description: string) {
  console.log(`\nSending ${description}...`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, data);

    if (response.ok) {
      console.log(`✓ ${description} processed successfully`);
    } else {
      console.log(`✗ ${description} failed`);
    }
  } catch (error) {
    console.error(`Error sending webhook:`, error);
  }
}

async function main() {
  const eventType = process.argv[3] || "credit";

  console.log("========================================");
  console.log("Stripe Webhook Test");
  console.log("========================================");
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`User ID: ${process.argv[2] || "test-user-id"}`);
  console.log(`Event type: ${eventType}`);

  if (eventType === "subscription" || eventType === "sub") {
    await sendTestWebhook(subscriptionEvent, "Subscription checkout event");
  } else {
    await sendTestWebhook(creditPurchaseEvent, "Credit purchase checkout event");
  }

  console.log("\n========================================");
  console.log("Done!");
  console.log("========================================");
}

main();
