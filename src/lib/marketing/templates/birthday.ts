// ---------------------------------------------------------------------------
// Birthday & Milestone Marketing Templates
// ---------------------------------------------------------------------------

import type { MarketingTemplate } from "./types";
import { buildEmailHtml } from "./email-html";

export const BIRTHDAY_TEMPLATES: MarketingTemplate[] = [
  // -------------------------------------------------------------------------
  // 1. Happy Birthday
  // -------------------------------------------------------------------------
  {
    id: "happy-birthday",
    name: "Happy Birthday",
    description:
      "Send a warm birthday greeting with a special offer to make their day memorable.",
    category: "birthday",
    icon: "\u{1F382}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "contact.birthday",
    defaultEmail: {
      subject:
        "Happy Birthday, {{firstName}}! \u{1F382} A Special Gift Inside",
      preheader:
        "We have a little something to make your birthday extra special.",
      content:
        "Happy Birthday, {{firstName}}! Today is all about you, and we wanted to take a moment to celebrate with you. To make your special day even sweeter, we have put together an exclusive birthday gift just for you. Use the code below at checkout and enjoy a special discount on your next order. We hope this year brings you everything you wish for and more. Cheers to another wonderful year!",
      htmlContent: buildEmailHtml(
        [
          {
            type: "heading",
            content:
              "Happy Birthday, {{firstName}}! \u{1F382}",
          },
          {
            type: "text",
            content:
              "Today is all about <strong>you</strong>, and we wanted to take a moment to celebrate with you! Birthdays only come once a year, so we think they deserve something truly special.",
          },
          {
            type: "text",
            content:
              "To make your day even sweeter, we have put together an exclusive birthday gift just for you \u{1F381}",
          },
          {
            type: "highlight",
            content:
              "Use code <strong>{{couponCode}}</strong> at checkout to claim your special birthday discount. This offer is our way of saying thank you for being part of our community!",
          },
          {
            type: "button",
            content: "Claim Your Birthday Gift",
            href: "#",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "We hope this year brings you everything you wish for and more. Here\u2019s to another wonderful year ahead, {{firstName}}!",
          },
          {
            type: "text",
            content:
              "Cheers and warm wishes,<br>The {{company}} Team",
          },
        ],
        { brandColor: "#e11d48" }
      ),
    },
    defaultSms:
      "Happy Birthday {{firstName}}! \u{1F382} Here's a special gift just for you: [link]. Enjoy your day! Reply STOP to opt out.",
    aiPromptHint:
      "Write a warm, celebratory birthday greeting email. Include a special discount or gift offer. Keep the tone joyful, personal, and festive. Mention the recipient by first name and make them feel valued.",
    suggestedMergeTags: ["firstName", "lastName", "couponCode"],
  },

  // -------------------------------------------------------------------------
  // 2. Birthday Reminder (Internal)
  // -------------------------------------------------------------------------
  {
    id: "birthday-reminder-internal",
    name: "Birthday Reminder (Internal)",
    description:
      "Alert your team 3 days before a contact\u2019s birthday so they can plan a personal outreach.",
    category: "birthday",
    icon: "\u{1F514}",
    channels: ["email"],
    automatable: true,
    triggerEvent: undefined,
    defaultEmail: {
      subject:
        "Reminder: {{firstName}} {{lastName}}\u2019s birthday is in 3 days",
      preheader:
        "A client birthday is coming up. Consider reaching out with a personal touch.",
      content:
        "This is a friendly reminder that {{firstName}} {{lastName}} from {{company}} has a birthday coming up on {{birthday}}. This is a great opportunity to strengthen the relationship with a personal note, a phone call, or a small gesture. Reaching out around milestones like birthdays can make a lasting impression and shows that you value the relationship beyond business.",
      htmlContent: buildEmailHtml(
        [
          {
            type: "heading",
            content:
              "\u{1F514} Upcoming Birthday Reminder",
          },
          {
            type: "text",
            content:
              "This is a friendly reminder that <strong>{{firstName}} {{lastName}}</strong> from <strong>{{company}}</strong> has a birthday coming up on <strong>{{birthday}}</strong>.",
          },
          {
            type: "highlight",
            content:
              "Consider reaching out with a personal touch \u2014 a quick phone call, a handwritten note, or even a simple email can go a long way in strengthening this relationship.",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "<strong>Suggested actions:</strong>",
          },
          {
            type: "text",
            content:
              "\u2022 Send a personalized birthday message<br>\u2022 Schedule a brief check-in call<br>\u2022 Share a relevant birthday offer or gift<br>\u2022 Add a note to the CRM for follow-up",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "Reaching out around milestones like birthdays shows that you value the relationship beyond business. Small gestures often leave the biggest impression.",
          },
        ],
        { brandColor: "#6366f1" }
      ),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write a concise internal reminder email for the team about an upcoming client birthday. Include the client name, company, and birthday date. Suggest actionable ways to reach out personally. Keep the tone professional and helpful.",
    suggestedMergeTags: ["firstName", "lastName", "birthday", "company"],
  },

  // -------------------------------------------------------------------------
  // 3. Birthday Follow-Up
  // -------------------------------------------------------------------------
  {
    id: "birthday-follow-up",
    name: "Birthday Follow-Up",
    description:
      "Follow up the day after their birthday with warm wishes and a reminder about any active birthday offer.",
    category: "birthday",
    icon: "\u{1F381}",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "contact.birthday_followup",
    defaultEmail: {
      subject:
        "Hope You Had an Amazing Birthday, {{firstName}}!",
      preheader:
        "Your birthday celebration doesn\u2019t have to end yet \u2014 your special offer is still waiting.",
      content:
        "We hope you had an absolutely wonderful birthday yesterday, {{firstName}}! We just wanted to check in and make sure you had the best day ever. By the way, if you did not get a chance to use your special birthday offer yet, do not worry \u2014 it is still valid! You can still use your code to treat yourself to something special. You deserve it. Here is to carrying that birthday joy into the days ahead!",
      htmlContent: buildEmailHtml(
        [
          {
            type: "heading",
            content:
              "Hope You Had an Amazing Birthday! \u{1F389}",
          },
          {
            type: "text",
            content:
              "Hey {{firstName}}, we hope you had an absolutely wonderful birthday yesterday! We just wanted to check in and make sure your special day was everything you wished for.",
          },
          {
            type: "text",
            content:
              "Whether you celebrated with friends, family, or a quiet moment to yourself \u2014 we hope it was filled with joy and laughter.",
          },
          {
            type: "highlight",
            content:
              "By the way, your birthday offer is still valid! Use code <strong>{{couponCode}}</strong> to treat yourself to something special. You deserve it \u{1F31F}",
          },
          {
            type: "button",
            content: "Use Your Birthday Offer",
            href: "#",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "Here\u2019s to carrying that birthday joy into the days ahead, {{firstName}}. We\u2019re so glad to have you as part of our community!",
          },
          {
            type: "text",
            content: "Warm wishes,<br>The Team",
          },
        ],
        { brandColor: "#e11d48" }
      ),
    },
    defaultSms:
      "Hope you had an amazing birthday {{firstName}}! Your special offer is still valid: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Write a warm follow-up email for the day after someone\u2019s birthday. Express hope they had a great day, remind them about any birthday offer that is still active, and keep the tone friendly and celebratory.",
    suggestedMergeTags: ["firstName", "couponCode"],
  },
];
