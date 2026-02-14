// ---------------------------------------------------------------------------
// Lifecycle Marketing Templates
// Automated emails & SMS triggered by customer journey events
// ---------------------------------------------------------------------------

import type { MarketingTemplate } from "./types";
import { buildEmailHtml } from "./email-html";

export const LIFECYCLE_TEMPLATES: MarketingTemplate[] = [
  // -------------------------------------------------------------------------
  // 1. Welcome Email
  // -------------------------------------------------------------------------
  {
    id: "welcome",
    name: "Welcome Email",
    description:
      "Greet new subscribers with a warm introduction and set expectations for what comes next.",
    category: "lifecycle",
    icon: "\u{1F44B}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "user.signup",
    defaultEmail: {
      subject: "Welcome to the family, {{firstName}}!",
      preheader:
        "We are thrilled to have you on board. Here is what to expect.",
      content:
        "Hi {{firstName}}, welcome to our community! We're thrilled to have you join us. You've just taken the first step toward a better experience, and we can't wait to show you everything we have in store. Over the next few days, we'll send you a few tips to help you get the most out of your account. In the meantime, feel free to explore your dashboard and reach out if you have any questions. We're here to help!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Welcome aboard, {{firstName}}!",
        },
        {
          type: "text",
          content:
            "We are thrilled to have you join our community. You have just taken the first step toward a better experience, and we cannot wait to show you everything we have in store.",
        },
        {
          type: "highlight",
          content:
            "Over the next few days, we will send you a few tips to help you get the most out of your account. Keep an eye on your inbox!",
        },
        {
          type: "text",
          content:
            "In the meantime, feel free to explore your dashboard and reach out if you have any questions. We are here to help every step of the way.",
        },
        {
          type: "button",
          content: "Go to Your Dashboard",
          href: "{{dashboardUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "If you have any questions, just hit reply. A real person will get back to you.",
        },
      ]),
    },
    defaultSms:
      "Hi {{firstName}}! Welcome aboard. Get started now: {{dashboardUrl}} - We're excited to have you! Reply STOP to opt out.",
    aiPromptHint:
      "Write a warm, enthusiastic welcome email for a new subscriber. Introduce the brand, set expectations for future emails, and encourage them to explore the product.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{dashboardUrl}}",
      "{{companyName}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 2. Onboarding: Getting Started
  // -------------------------------------------------------------------------
  {
    id: "onboarding-1",
    name: "Onboarding: Getting Started",
    description:
      "Guide new users through their first steps with a clear, actionable getting-started email.",
    category: "lifecycle",
    icon: "\u{1F680}",
    channels: ["email"],
    automatable: true,
    triggerEvent: "user.signup",
    defaultEmail: {
      subject: "Getting started: your first 3 steps",
      preheader:
        "Follow these quick steps to set up your account and hit the ground running.",
      content:
        "Hi {{firstName}}, here's how to get the most out of your account in just a few minutes. Step 1: Complete your profile so we can personalize your experience. Step 2: Connect your favorite tools and integrations. Step 3: Send your first campaign to see the magic in action. Each step takes less than two minutes, and you will be fully set up before you know it. Need a hand? Our support team is just a click away.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Let's get you started, {{firstName}}",
        },
        {
          type: "text",
          content:
            "Setting up your account takes just a few minutes. Follow these three simple steps and you will be ready to go.",
        },
        {
          type: "highlight",
          content:
            "<strong>Step 1:</strong> Complete your profile so we can personalize your experience.<br><strong>Step 2:</strong> Connect your favorite tools and integrations.<br><strong>Step 3:</strong> Send your first campaign to see the magic in action.",
        },
        {
          type: "text",
          content:
            "Each step takes less than two minutes. You will be fully set up before you know it.",
        },
        {
          type: "button",
          content: "Complete Your Setup",
          href: "{{setupUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Need a hand? Our support team is just a click away. Reply to this email anytime.",
        },
      ]),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write a concise onboarding email that walks a new user through their first 3 setup steps. Keep the tone encouraging and action-oriented.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{setupUrl}}",
      "{{companyName}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 3. Onboarding: Key Features
  // -------------------------------------------------------------------------
  {
    id: "onboarding-2",
    name: "Onboarding: Key Features",
    description:
      "Highlight the most valuable features to drive engagement and product adoption.",
    category: "lifecycle",
    icon: "\u{2B50}",
    channels: ["email"],
    automatable: true,
    defaultEmail: {
      subject: "Did you know you can do all this?",
      preheader:
        "Discover the powerful features that make your workflow faster and smarter.",
      content:
        "Hi {{firstName}}, did you know you can automate your campaigns, segment your audience with smart filters, and track real-time analytics all from one dashboard? These are just a few of the features our most successful users rely on every day. Automated Campaigns: Set it and forget it. Build campaigns that send themselves at the perfect time. Smart Segmentation: Target the right people with laser-focused audience filters. Real-Time Analytics: See what is working and optimize on the fly. Take a few minutes to explore these features and discover how they can save you hours every week.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Unlock the features that matter most",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, you have access to some powerful tools that can transform the way you work. Here are three features our most successful users rely on every day.",
        },
        {
          type: "highlight",
          content:
            "<strong>Automated Campaigns</strong> - Set it and forget it. Build campaigns that send themselves at the perfect time.",
        },
        {
          type: "highlight",
          content:
            "<strong>Smart Segmentation</strong> - Target the right people with laser-focused audience filters.",
        },
        {
          type: "highlight",
          content:
            "<strong>Real-Time Analytics</strong> - See what is working and optimize on the fly.",
        },
        {
          type: "text",
          content:
            "Take a few minutes to explore these features and discover how they can save you hours every week.",
        },
        {
          type: "button",
          content: "Explore Features",
          href: "{{featuresUrl}}",
        },
      ]),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write a feature-highlight email for day 3 of onboarding. Showcase 3 key product features with brief descriptions and encourage the user to try them.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{featuresUrl}}",
      "{{companyName}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 4. Onboarding: Pro Tips
  // -------------------------------------------------------------------------
  {
    id: "onboarding-3",
    name: "Onboarding: Pro Tips",
    description:
      "Share advanced tips and tricks to help users get maximum value from the product.",
    category: "lifecycle",
    icon: "\u{1F4A1}",
    channels: ["email"],
    automatable: true,
    defaultEmail: {
      subject: "Pro tips to level up your results",
      preheader:
        "You are doing great! Here are expert tricks to take things to the next level.",
      content:
        "Hi {{firstName}}, you're doing great! Now that you have the basics down, here are some pro tips to supercharge your results. Tip 1: Use A/B testing on your subject lines to boost open rates by up to 30%. Tip 2: Schedule your campaigns for Tuesday or Thursday mornings when engagement peaks. Tip 3: Create re-engagement segments to win back contacts who have gone quiet. These small tweaks can make a big difference. Try one this week and watch your metrics improve.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Ready to level up, {{firstName}}?",
        },
        {
          type: "text",
          content:
            "You are doing great! Now that you have the basics down, here are some pro tips our power users swear by.",
        },
        {
          type: "highlight",
          content:
            "<strong>Tip 1:</strong> Use A/B testing on your subject lines to boost open rates by up to 30%.",
        },
        {
          type: "highlight",
          content:
            "<strong>Tip 2:</strong> Schedule your campaigns for Tuesday or Thursday mornings when engagement peaks.",
        },
        {
          type: "highlight",
          content:
            "<strong>Tip 3:</strong> Create re-engagement segments to win back contacts who have gone quiet.",
        },
        {
          type: "text",
          content:
            "These small tweaks can make a big difference. Try one this week and watch your metrics improve.",
        },
        {
          type: "button",
          content: "Try These Tips Now",
          href: "{{dashboardUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Want more tips? Check out our knowledge base for in-depth guides and tutorials.",
        },
      ]),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write an advanced tips email for experienced onboarding users. Include 3 actionable pro tips with specific outcomes. Keep the tone motivating and practical.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{dashboardUrl}}",
      "{{knowledgeBaseUrl}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 5. Account Activation Reminder
  // -------------------------------------------------------------------------
  {
    id: "activation-reminder",
    name: "Account Activation Reminder",
    description:
      "Re-engage users who signed up but have not started using the product yet.",
    category: "lifecycle",
    icon: "\u{23F0}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "user.inactive_3d",
    defaultEmail: {
      subject: "{{firstName}}, your account is waiting for you",
      preheader:
        "You signed up but have not gotten started yet. Let us help!",
      content:
        "Hi {{firstName}}, we noticed you haven't gotten started yet, and we don't want you to miss out! Setting up takes less than 5 minutes, and once you do, you will wonder why you waited. Here is what you are missing: a fully personalized dashboard tailored to your needs, powerful automation tools that save you hours every week, and real-time insights to help you make smarter decisions. We have also put together a quick-start guide to make things even easier. Click below to jump right in.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "We saved your spot, {{firstName}}",
        },
        {
          type: "text",
          content:
            "We noticed you signed up but have not gotten started yet. We do not want you to miss out on everything waiting for you inside.",
        },
        {
          type: "highlight",
          content:
            "Setting up takes less than 5 minutes, and once you do, you will wonder why you waited.",
        },
        {
          type: "text",
          content:
            "Here is what you are missing:<br>A fully personalized dashboard tailored to your needs<br>Powerful automation tools that save you hours every week<br>Real-time insights to help you make smarter decisions",
        },
        {
          type: "text",
          content:
            "We have also put together a quick-start guide to make things even easier.",
        },
        {
          type: "button",
          content: "Get Started Now",
          href: "{{setupUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Need help? Reply to this email and our team will walk you through everything.",
        },
      ]),
    },
    defaultSms:
      "Hey {{firstName}}, your account is ready and waiting! Set up in under 5 min: {{setupUrl}} - Need help? Just reply. STOP to opt out.",
    aiPromptHint:
      "Write a gentle re-engagement email for a user who signed up 3 days ago but has not activated their account. Emphasize ease of setup and what they are missing.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{setupUrl}}",
      "{{companyName}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 6. Free Trial Ending
  // -------------------------------------------------------------------------
  {
    id: "trial-ending",
    name: "Free Trial Ending",
    description:
      "Alert users that their free trial is about to expire and encourage them to subscribe.",
    category: "lifecycle",
    icon: "\u{23F3}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "trial.ending",
    defaultEmail: {
      subject: "Your free trial ends in 3 days",
      preheader:
        "Don't lose access to your data and workflows. Upgrade now to keep going.",
      content:
        "Hi {{firstName}}, your free trial ends in 3 days, and we want to make sure you don't lose access to everything you have built so far. During your trial, you have explored powerful features that can continue to drive results for you. Upgrading takes just a moment, and your {{planName}} plan starts at a price that fits any budget. If you upgrade today, all your data, settings, and workflows will carry over seamlessly. No setup required, no interruptions. Don't wait until the last minute. Secure your account now and keep the momentum going.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Your free trial ends in 3 days",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, we want to make sure you do not lose access to everything you have built so far.",
        },
        {
          type: "highlight",
          content:
            "During your trial, you explored powerful features that can continue to drive results for you. Upgrading takes just a moment.",
        },
        {
          type: "text",
          content:
            "Your <strong>{{planName}}</strong> plan starts at a price that fits any budget. If you upgrade today, all your data, settings, and workflows will carry over seamlessly. No setup required. No interruptions.",
        },
        {
          type: "button",
          content: "Upgrade Now",
          href: "{{upgradeUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Have questions about pricing or features? Reply to this email and we will help you find the perfect plan.",
        },
      ]),
    },
    defaultSms:
      "{{firstName}}, your free trial ends in 3 days! Upgrade now to keep your data: {{upgradeUrl}} - Reply STOP to opt out.",
    aiPromptHint:
      "Write an urgent but friendly trial-expiration email. Emphasize what the user will lose and make upgrading feel effortless. Include a clear CTA.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{planName}}",
      "{{upgradeUrl}}",
      "{{trialEndDate}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 7. Subscription Confirmed
  // -------------------------------------------------------------------------
  {
    id: "subscription-confirmation",
    name: "Subscription Confirmed",
    description:
      "Confirm a successful payment and thank the user for subscribing.",
    category: "lifecycle",
    icon: "\u{2705}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "payment.success",
    defaultEmail: {
      subject: "You're all set! Subscription confirmed",
      preheader:
        "Thank you for subscribing. Your payment has been processed successfully.",
      content:
        "Hi {{firstName}}, thank you! Your subscription to the {{planName}} plan is confirmed, and your payment has been processed successfully. Here is a quick summary: Plan: {{planName}}. Next billing date: {{nextBillingDate}}. Amount: {{amount}}. You now have full access to all the features included in your plan. If you ever need to update your billing information or change your plan, you can do so from your account settings at any time. Thank you for choosing us. We are excited to support your success!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Subscription confirmed!",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, thank you for subscribing! Your payment has been processed successfully and your account is fully activated.",
        },
        {
          type: "highlight",
          content:
            "<strong>Plan:</strong> {{planName}}<br><strong>Next billing date:</strong> {{nextBillingDate}}<br><strong>Amount:</strong> {{amount}}",
        },
        {
          type: "text",
          content:
            "You now have full access to all the features included in your plan. If you ever need to update your billing information or change your plan, visit your account settings anytime.",
        },
        {
          type: "button",
          content: "Go to Dashboard",
          href: "{{dashboardUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Thank you for choosing us. We are excited to support your success!",
        },
      ]),
    },
    defaultSms:
      "{{firstName}}, your {{planName}} subscription is confirmed! Payment received. Manage your account: {{dashboardUrl}} STOP to opt out.",
    aiPromptHint:
      "Write a professional subscription confirmation email. Include plan details, billing summary, and a thank-you message. Keep the tone reassuring and appreciative.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{planName}}",
      "{{nextBillingDate}}",
      "{{amount}}",
      "{{dashboardUrl}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 8. Subscription Renewal Reminder
  // -------------------------------------------------------------------------
  {
    id: "renewal-reminder",
    name: "Subscription Renewal Reminder",
    description:
      "Notify users 7 days before their subscription automatically renews.",
    category: "lifecycle",
    icon: "\u{1F501}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "subscription.renewal",
    defaultEmail: {
      subject: "Your subscription renews on {{nextBillingDate}}",
      preheader:
        "A friendly reminder that your plan will renew in 7 days. Review your details.",
      content:
        "Hi {{firstName}}, this is a friendly heads-up that your {{planName}} subscription will automatically renew on {{nextBillingDate}} for {{amount}}. No action is needed if you would like to continue with your current plan. Everything will renew seamlessly. If you would like to make changes to your plan, update your payment method, or review your billing history, you can do so from your account settings. We appreciate your continued trust in us and look forward to serving you for another billing cycle.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Renewal reminder",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, this is a friendly heads-up that your subscription will renew soon.",
        },
        {
          type: "highlight",
          content:
            "<strong>Plan:</strong> {{planName}}<br><strong>Renewal date:</strong> {{nextBillingDate}}<br><strong>Amount:</strong> {{amount}}",
        },
        {
          type: "text",
          content:
            "No action is needed if you would like to continue with your current plan. Everything will renew seamlessly.",
        },
        {
          type: "text",
          content:
            "If you would like to make changes to your plan, update your payment method, or review your billing history, you can do so from your account settings.",
        },
        {
          type: "button",
          content: "Manage Subscription",
          href: "{{billingUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "We appreciate your continued trust and look forward to serving you for another billing cycle.",
        },
      ]),
    },
    defaultSms:
      "Hi {{firstName}}, your {{planName}} plan renews on {{nextBillingDate}} for {{amount}}. Manage: {{billingUrl}} STOP to opt out.",
    aiPromptHint:
      "Write a clear renewal reminder email sent 7 days before auto-renewal. Include plan details, renewal date, and amount. Provide an easy way to manage the subscription.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{planName}}",
      "{{nextBillingDate}}",
      "{{amount}}",
      "{{billingUrl}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 9. Payment Failed
  // -------------------------------------------------------------------------
  {
    id: "payment-failed",
    name: "Payment Failed",
    description:
      "Notify users when a payment attempt fails and prompt them to update their payment method.",
    category: "lifecycle",
    icon: "\u{26A0}\u{FE0F}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "payment.failed",
    defaultEmail: {
      subject: "Action needed: we couldn't process your payment",
      preheader:
        "Your recent payment did not go through. Please update your payment method to avoid interruption.",
      content:
        "Hi {{firstName}}, we tried to process your payment for the {{planName}} plan, but it was not successful. This can happen for a number of reasons, such as an expired card, insufficient funds, or a temporary bank hold. To keep your account active and avoid any interruption to your service, please update your payment method as soon as possible. We will automatically retry the charge once your details are updated. If your payment is not resolved within the next 7 days, your account may be downgraded. We are here to help if you run into any issues.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "We could not process your payment",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, we tried to process your payment for the <strong>{{planName}}</strong> plan, but it was not successful.",
        },
        {
          type: "highlight",
          content:
            "This can happen for a number of reasons: an expired card, insufficient funds, or a temporary bank hold. Nothing to worry about if you act quickly.",
        },
        {
          type: "text",
          content:
            "To keep your account active and avoid any interruption to your service, please update your payment method as soon as possible. We will automatically retry the charge once your details are updated.",
        },
        {
          type: "button",
          content: "Update Payment Method",
          href: "{{billingUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "If your payment is not resolved within the next 7 days, your account may be downgraded. Need help? Just reply to this email.",
        },
      ]),
    },
    defaultSms:
      "{{firstName}}, your payment for {{planName}} failed. Update your card now to avoid losing access: {{billingUrl}} STOP to opt out.",
    aiPromptHint:
      "Write an urgent but empathetic payment-failed email. Explain possible reasons, provide a direct link to update payment, and mention the deadline before account downgrade.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{planName}}",
      "{{billingUrl}}",
      "{{amount}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 10. Upgrade Your Plan (Upsell)
  // -------------------------------------------------------------------------
  {
    id: "upgrade-upsell",
    name: "Upgrade Your Plan",
    description:
      "Encourage users approaching their plan limits to upgrade to a higher tier.",
    category: "lifecycle",
    icon: "\u{1F4C8}",
    channels: ["email"],
    automatable: true,
    defaultEmail: {
      subject: "You're growing fast! Time to unlock more?",
      preheader:
        "You are getting close to your plan limits. See what the next tier can do for you.",
      content:
        "Hi {{firstName}}, great news: you are getting close to your {{planName}} plan limits, which means your business is growing! To keep the momentum going without any interruptions, we recommend upgrading to our next plan tier. Here is what you will unlock: higher sending limits so you can reach more people, advanced automation workflows for more sophisticated campaigns, priority support for faster response times, and enhanced analytics to measure what matters most. Upgrading is instant and your current data carries over without any downtime. Take a look at the available plans and pick the one that fits your growth.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "You are growing fast, {{firstName}}!",
        },
        {
          type: "text",
          content:
            "Great news: you are getting close to your <strong>{{planName}}</strong> plan limits, which means your business is thriving!",
        },
        {
          type: "text",
          content:
            "To keep the momentum going without any interruptions, we recommend upgrading to our next plan tier. Here is what you will unlock:",
        },
        {
          type: "highlight",
          content:
            "Higher sending limits to reach more people<br>Advanced automation workflows for sophisticated campaigns<br>Priority support for faster response times<br>Enhanced analytics to measure what matters most",
        },
        {
          type: "text",
          content:
            "Upgrading is instant and your current data carries over without any downtime.",
        },
        {
          type: "button",
          content: "View Upgrade Options",
          href: "{{upgradeUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Not sure which plan is right for you? Reply to this email and our team will help you find the perfect fit.",
        },
      ]),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write a positive upsell email for a user approaching their plan limits. Frame the upgrade as a natural next step for their growth. Highlight 3-4 benefits of the higher tier.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{planName}}",
      "{{upgradeUrl}}",
      "{{usagePercent}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 11. Win-Back (We Miss You)
  // -------------------------------------------------------------------------
  {
    id: "win-back",
    name: "We Miss You!",
    description:
      "Re-engage users who have been inactive for 30 or more days with a compelling reason to return.",
    category: "lifecycle",
    icon: "\u{1F49C}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "user.inactive_30d",
    defaultEmail: {
      subject: "We miss you, {{firstName}}! Come see what's new",
      preheader:
        "It has been a while since your last visit. We have been busy making things better for you.",
      content:
        "Hi {{firstName}}, it's been a while and we miss you! A lot has changed since your last visit, and we think you are going to love what we have been working on. Here is what is new: a redesigned dashboard that is faster and easier to use, new automation features that save even more time, improved analytics with deeper insights into your campaigns, and a growing library of templates to get you started in seconds. We would love to see you back. Your account is right where you left it, ready to go whenever you are. As a welcome-back bonus, log in this week and unlock exclusive access to our newest features.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "We miss you, {{firstName}}!",
        },
        {
          type: "text",
          content:
            "It has been a while since your last visit, and we have been busy making things better for you. Here is what is new:",
        },
        {
          type: "highlight",
          content:
            "A redesigned dashboard that is faster and easier to use<br>New automation features that save even more time<br>Improved analytics with deeper campaign insights<br>A growing library of templates to get started in seconds",
        },
        {
          type: "text",
          content:
            "Your account is right where you left it, ready to go whenever you are.",
        },
        {
          type: "highlight",
          content:
            "<strong>Welcome-back bonus:</strong> Log in this week and unlock exclusive access to our newest features.",
        },
        {
          type: "button",
          content: "Come Back and Explore",
          href: "{{dashboardUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "If something was not working for you, we would love to hear about it. Just reply to this email.",
        },
      ]),
    },
    defaultSms:
      "Hey {{firstName}}, we miss you! A lot is new since your last visit. Come back and see: {{dashboardUrl}} Reply STOP to opt out.",
    aiPromptHint:
      "Write a warm win-back email for a user inactive for 30+ days. Highlight new features and improvements, offer an incentive to return, and keep the tone friendly and non-pushy.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{dashboardUrl}}",
      "{{lastActiveDate}}",
      "{{companyName}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 12. Cancellation Confirmed
  // -------------------------------------------------------------------------
  {
    id: "cancellation",
    name: "Cancellation Confirmed",
    description:
      "Acknowledge a subscription cancellation gracefully and leave the door open for return.",
    category: "lifecycle",
    icon: "\u{1F44D}",
    channels: ["email"],
    automatable: true,
    triggerEvent: "subscription.cancelled",
    defaultEmail: {
      subject: "Your cancellation is confirmed",
      preheader:
        "We are sorry to see you go. Your account details and next steps are inside.",
      content:
        "Hi {{firstName}}, we're sorry to see you go. Your {{planName}} subscription has been cancelled, and you will not be charged going forward. Here is what you should know: your account will remain accessible until the end of your current billing period on {{nextBillingDate}}, your data will be securely stored for 30 days in case you decide to come back, and you can reactivate your subscription at any time from your account settings. If there is anything we could have done differently, we would genuinely appreciate your feedback. It helps us improve for everyone. We hope to see you again in the future. Thank you for being part of our community.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Your cancellation is confirmed",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, we are sorry to see you go. Your <strong>{{planName}}</strong> subscription has been cancelled, and you will not be charged going forward.",
        },
        {
          type: "highlight",
          content:
            "<strong>What happens next:</strong><br>Your account remains accessible until {{nextBillingDate}}.<br>Your data will be securely stored for 30 days.<br>You can reactivate anytime from your account settings.",
        },
        {
          type: "text",
          content:
            "If there is anything we could have done differently, we would genuinely appreciate your feedback. It helps us improve for everyone.",
        },
        {
          type: "button",
          content: "Share Feedback",
          href: "{{feedbackUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Changed your mind? You can reactivate your subscription anytime. We hope to see you again in the future.",
        },
      ]),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write a graceful cancellation confirmation email. Acknowledge the decision, explain what happens next, ask for feedback, and leave the door open for the user to return.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{planName}}",
      "{{nextBillingDate}}",
      "{{feedbackUrl}}",
    ],
  },

  // -------------------------------------------------------------------------
  // 13. Account Anniversary
  // -------------------------------------------------------------------------
  {
    id: "anniversary",
    name: "Account Anniversary",
    description:
      "Celebrate the yearly milestone of a user being part of your community.",
    category: "lifecycle",
    icon: "\u{1F389}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "user.anniversary",
    defaultEmail: {
      subject: "Happy Anniversary, {{firstName}}! \u{1F389}",
      preheader:
        "You have been with us for {{daysAsClient}} days. Let's celebrate this milestone together!",
      content:
        "Happy Anniversary, {{firstName}}! You have been with us for {{daysAsClient}} days, and we could not be more grateful to have you as part of our community. Over this time, you have accomplished some amazing things. Here is a quick look at your journey: campaigns sent: {{campaignsSent}}, contacts reached: {{contactsReached}}, and so many milestones along the way. Every message you send makes a difference, and we are honored to be part of your story. To celebrate, we have a special surprise waiting for you in your account. Log in to claim it! Thank you for your loyalty and trust. Here is to many more milestones together!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Happy Anniversary, {{firstName}}!",
        },
        {
          type: "text",
          content:
            "You have been with us for <strong>{{daysAsClient}} days</strong>, and we could not be more grateful to have you as part of our community.",
        },
        {
          type: "highlight",
          content:
            "<strong>Your journey so far:</strong><br>Campaigns sent: {{campaignsSent}}<br>Contacts reached: {{contactsReached}}<br>And so many milestones along the way!",
        },
        {
          type: "text",
          content:
            "Every message you send makes a difference, and we are honored to be part of your story.",
        },
        {
          type: "highlight",
          content:
            "To celebrate, we have a special surprise waiting for you in your account. Log in to claim it!",
        },
        {
          type: "button",
          content: "Claim Your Anniversary Gift",
          href: "{{dashboardUrl}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Thank you for your loyalty and trust. Here is to many more milestones together!",
        },
      ]),
    },
    defaultSms:
      "Happy Anniversary, {{firstName}}! {{daysAsClient}} days with us. A surprise awaits you: {{dashboardUrl}} Reply STOP to opt out.",
    aiPromptHint:
      "Write a celebratory account anniversary email. Include usage stats, express genuine gratitude, and offer a small reward or surprise. Keep the tone joyful and appreciative.",
    suggestedMergeTags: [
      "{{firstName}}",
      "{{daysAsClient}}",
      "{{campaignsSent}}",
      "{{contactsReached}}",
      "{{dashboardUrl}}",
    ],
  },
];
