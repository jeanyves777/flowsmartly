// ---------------------------------------------------------------------------
// Content & Value Marketing Templates
// ---------------------------------------------------------------------------

import type { MarketingTemplate } from "./types";
import { buildEmailHtml } from "./email-html";

export const CONTENT_TEMPLATES: MarketingTemplate[] = [
  // -------------------------------------------------------------------------
  // 1. Monthly Newsletter
  // -------------------------------------------------------------------------
  {
    id: "monthly-newsletter",
    name: "Monthly Newsletter",
    description:
      "Send a monthly roundup of updates, tips, and news to keep your audience engaged and informed.",
    category: "content",
    icon: "\u{1F4F0}",
    channels: ["email"],
    automatable: false,
    defaultEmail: {
      subject:
        "Your Monthly Update, {{firstName}} \u2014 What\u2019s New",
      preheader:
        "This month\u2019s highlights, tips, and updates curated just for you.",
      content:
        "Hi {{firstName}}, welcome to this month\u2019s newsletter! We have been busy behind the scenes, and we are excited to share our latest updates, hand-picked tips, and a few stories we think you will love. Whether you are looking for inspiration, practical advice, or just want to stay in the loop, this issue has something for you. Dive in and let us know what you think!",
      htmlContent: buildEmailHtml(
        [
          {
            type: "heading",
            content:
              "Your Monthly Update, {{firstName}} \u{1F4F0}",
          },
          {
            type: "text",
            content:
              "Hi {{firstName}}, welcome to this month\u2019s newsletter! We have been busy behind the scenes, and we are excited to share what we have been working on.",
          },
          { type: "divider", content: "" },
          {
            type: "heading",
            content: "What\u2019s New This Month",
          },
          {
            type: "text",
            content:
              "\u2022 <strong>Product Updates:</strong> We have rolled out several improvements based on your feedback, including faster performance, a refreshed dashboard, and new integrations that make your workflow smoother than ever.<br><br>\u2022 <strong>Community Spotlight:</strong> This month we are highlighting some incredible ways our community members are using the platform to grow their businesses. Your creativity continues to inspire us.<br><br>\u2022 <strong>Upcoming Events:</strong> Mark your calendar for our next live Q&amp;A session where our team will answer your top questions and share a sneak peek at what is coming next.",
          },
          { type: "divider", content: "" },
          {
            type: "heading",
            content: "Tips &amp; Best Practices",
          },
          {
            type: "highlight",
            content:
              "<strong>Pro Tip:</strong> Consistency is key. Set aside 15 minutes each week to review your analytics and adjust your strategy. Small, regular optimizations lead to big results over time.",
          },
          {
            type: "text",
            content:
              "We have also put together a quick guide on making the most of your account this month. From advanced features you might have missed to simple tricks that save time, it is all waiting for you.",
          },
          {
            type: "button",
            content: "Read the Full Guide",
            href: "#",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "Thank you for being part of our community, {{firstName}}. We build this for you, and your feedback is what drives us forward. If you have any questions or ideas, just hit reply \u2014 we read every message.",
          },
          {
            type: "text",
            content:
              "Until next month,<br>The {{company}} Team",
          },
        ],
        { brandColor: "#6366f1" }
      ),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write an engaging monthly newsletter email that includes a welcome note, top stories or product updates, practical tips, and a clear call to action. Keep the tone warm, informative, and conversational. Address the reader by first name and make them feel like a valued insider.",
    suggestedMergeTags: ["firstName", "company"],
  },

  // -------------------------------------------------------------------------
  // 2. Weekly Tips / How-To
  // -------------------------------------------------------------------------
  {
    id: "weekly-tips",
    name: "Weekly Tips / How-To",
    description:
      "Deliver weekly educational content with actionable tips and how-to advice your audience can apply immediately.",
    category: "content",
    icon: "\u{1F4A1}",
    channels: ["email", "sms"],
    automatable: false,
    defaultEmail: {
      subject: "This Week\u2019s Top Tips, {{firstName}}",
      preheader:
        "Actionable advice you can put into practice today.",
      content:
        "Hi {{firstName}}, it is time for your weekly dose of actionable tips! This week we are focused on helping you work smarter, not harder. We have gathered three practical strategies you can implement right away to see real results. Each tip is designed to be quick to apply and deliver measurable impact. Let us dive in and level up together.",
      htmlContent: buildEmailHtml(
        [
          {
            type: "heading",
            content:
              "This Week\u2019s Top Tips \u{1F4A1}",
          },
          {
            type: "text",
            content:
              "Hi {{firstName}}, it is time for your weekly dose of actionable advice! This week we are focused on helping you work smarter, not harder.",
          },
          { type: "divider", content: "" },
          {
            type: "highlight",
            content:
              "<strong>Tip #1 \u2014 Batch Your Tasks:</strong> Group similar activities together instead of switching between different types of work. Studies show that task-switching can cost you up to 40% of your productive time. Block out dedicated windows for emails, calls, and deep work.",
          },
          {
            type: "highlight",
            content:
              "<strong>Tip #2 \u2014 Use the Two-Minute Rule:</strong> If a task takes less than two minutes to complete, do it right now instead of adding it to your to-do list. This simple habit keeps small tasks from piling up and cluttering your mind.",
          },
          {
            type: "highlight",
            content:
              "<strong>Tip #3 \u2014 Review and Reflect Weekly:</strong> Spend 10 minutes every Friday reviewing what worked, what did not, and what you want to focus on next week. This reflection habit compounds over time and helps you spot patterns in your productivity.",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "Want to go deeper on any of these strategies? We have written a detailed breakdown with step-by-step instructions and real-world examples.",
          },
          {
            type: "button",
            content: "Read the Full How-To",
            href: "#",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "Try implementing just one of these tips this week, {{firstName}}, and let us know how it goes. Small changes add up to big results!",
          },
          {
            type: "text",
            content: "Keep growing,<br>The {{company}} Team",
          },
        ],
        { brandColor: "#6366f1" }
      ),
    },
    defaultSms:
      "Hey {{firstName}}! This week\u2019s tip: Batch similar tasks together to cut context-switching by up to 40%. Read all 3 tips: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Write an educational weekly tips email with 2\u20133 actionable, practical tips the reader can implement immediately. Use an encouraging, knowledgeable tone. Number the tips, explain the reasoning behind each one, and include a call to action to read more. Address the reader by first name.",
    suggestedMergeTags: ["firstName", "company"],
  },

  // -------------------------------------------------------------------------
  // 3. Blog Post Digest
  // -------------------------------------------------------------------------
  {
    id: "blog-digest",
    name: "Blog Post Digest",
    description:
      "Curate and share your latest blog articles in a digest format so readers never miss your best content.",
    category: "content",
    icon: "\u{1F4DD}",
    channels: ["email"],
    automatable: false,
    defaultEmail: {
      subject:
        "Fresh Reads for You, {{firstName}} \u2014 This Week\u2019s Blog Highlights",
      preheader:
        "The latest articles, insights, and stories from our blog \u2014 curated for you.",
      content:
        "Hi {{firstName}}, we have published some great new content this week, and we did not want you to miss it. From in-depth guides to quick reads, here are our latest blog highlights. Each article is packed with insights you can use right away. Browse the roundup below and dive into the topics that interest you most.",
      htmlContent: buildEmailHtml(
        [
          {
            type: "heading",
            content:
              "Fresh Reads for You, {{firstName}} \u{1F4DD}",
          },
          {
            type: "text",
            content:
              "Hi {{firstName}}, we have published some great new content this week, and we did not want you to miss it. Here are our latest blog highlights:",
          },
          { type: "divider", content: "" },
          {
            type: "highlight",
            content:
              "<strong>The Complete Guide to Building a Content Strategy That Converts</strong><br>Learn how to plan, create, and distribute content that actually drives results. We break down the process into five simple steps anyone can follow, from defining your audience to measuring success.",
          },
          {
            type: "button",
            content: "Read This Article",
            href: "#",
          },
          {
            type: "highlight",
            content:
              "<strong>10 Common Mistakes That Are Hurting Your Email Open Rates</strong><br>Are your emails going unread? We analyzed thousands of campaigns to identify the most common pitfalls and what high-performing senders do differently. Spoiler: your subject line is only half the story.",
          },
          {
            type: "button",
            content: "Read This Article",
            href: "#",
          },
          {
            type: "highlight",
            content:
              "<strong>How to Turn Customer Feedback Into Your Secret Weapon</strong><br>Feedback is gold if you know how to mine it. Discover our framework for collecting, analyzing, and acting on customer feedback to improve your product and strengthen loyalty.",
          },
          {
            type: "button",
            content: "Read This Article",
            href: "#",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "That is a wrap on this week\u2019s digest, {{firstName}}. If any of these topics spark an idea or a question, we would love to hear from you. Just reply to this email.",
          },
          {
            type: "text",
            content: "Happy reading,<br>The {{company}} Team",
          },
        ],
        { brandColor: "#6366f1" }
      ),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write a blog digest email that showcases 2\u20134 recent articles with compelling summaries. Each article should have a brief description highlighting the key takeaway and a read-more link. Keep the tone conversational and informative. Address the reader by first name.",
    suggestedMergeTags: ["firstName", "company"],
  },

  // -------------------------------------------------------------------------
  // 4. Case Study / Success Story
  // -------------------------------------------------------------------------
  {
    id: "case-study",
    name: "Case Study / Success Story",
    description:
      "Share a compelling customer success story using the problem, solution, results format to build credibility and trust.",
    category: "content",
    icon: "\u{1F4CA}",
    channels: ["email"],
    automatable: false,
    defaultEmail: {
      subject:
        "See How [Company] Achieved Amazing Results",
      preheader:
        "A real success story showing what is possible when strategy meets the right tools.",
      content:
        "Hi {{firstName}}, we love sharing stories of real customers achieving real results, and this one is too good to keep to ourselves. One of our customers was struggling with low engagement and inefficient workflows. After implementing a new strategy using our platform, they saw a dramatic improvement across every metric that mattered. Read on to discover exactly what they did, how they did it, and the results they achieved.",
      htmlContent: buildEmailHtml(
        [
          {
            type: "heading",
            content:
              "Customer Success Story \u{1F4CA}",
          },
          {
            type: "text",
            content:
              "Hi {{firstName}}, we love sharing stories of real customers achieving real results \u2014 and this one is too good to keep to ourselves.",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "<strong>The Challenge:</strong><br>Like many growing businesses, this company was dealing with scattered workflows, low engagement rates, and a team spending too many hours on manual tasks. They knew there had to be a better way \u2014 they just had not found it yet.",
          },
          {
            type: "text",
            content:
              "<strong>The Solution:</strong><br>After partnering with us, they implemented automated workflows, personalized messaging, and data-driven decision-making across their entire operation. Our team worked closely with them to tailor a strategy that fit their unique needs and goals.",
          },
          {
            type: "highlight",
            content:
              "<strong>The Results:</strong><br>\u2022 <strong>72% increase</strong> in customer engagement within the first 90 days<br>\u2022 <strong>35% reduction</strong> in time spent on manual outreach<br>\u2022 <strong>3x return</strong> on their investment in the first quarter<br>\u2022 <strong>50% improvement</strong> in team productivity and collaboration",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "<em>\u201CWe went from spending hours on repetitive tasks to focusing on what actually moves the needle. The results speak for themselves.\u201D</em><br>\u2014 Marketing Director",
          },
          {
            type: "text",
            content:
              "Want to know exactly how they did it? We have documented the full strategy, timeline, and lessons learned in a detailed case study.",
          },
          {
            type: "button",
            content: "Read the Full Case Study",
            href: "#",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "Your results could be next, {{firstName}}. If you are curious about what a similar approach could look like for your business, we would love to chat.",
          },
          {
            type: "text",
            content:
              "To your success,<br>The {{company}} Team",
          },
        ],
        { brandColor: "#6366f1" }
      ),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write a case study email following the problem \u2192 solution \u2192 results format. Include specific metrics and a customer quote for social proof. Keep the tone professional yet approachable. End with a call to action to read the full case study or explore similar results.",
    suggestedMergeTags: ["firstName", "company"],
  },

  // -------------------------------------------------------------------------
  // 5. Webinar / Event Invitation
  // -------------------------------------------------------------------------
  {
    id: "webinar-invite",
    name: "Webinar / Event Invitation",
    description:
      "Invite your audience to a live webinar or event with all the details they need to register and attend.",
    category: "content",
    icon: "\u{1F399}\uFE0F",
    channels: ["email", "sms"],
    automatable: false,
    defaultEmail: {
      subject:
        "You\u2019re Invited, {{firstName}}! Join Us Live",
      preheader:
        "Reserve your spot for our upcoming live event \u2014 limited seats available.",
      content:
        "Hi {{firstName}}, we are hosting a live event and we would love for you to be there! Join us for a deep dive into the strategies and insights that are driving results right now. Our expert speakers will share actionable advice you can implement immediately, and you will have the chance to ask questions live. Spots are limited, so reserve yours today.",
      htmlContent: buildEmailHtml(
        [
          {
            type: "heading",
            content:
              "You\u2019re Invited! Join Us Live \u{1F399}\uFE0F",
          },
          {
            type: "text",
            content:
              "Hi {{firstName}}, we are hosting a live event and we would love for you to be there!",
          },
          {
            type: "text",
            content:
              "Join us for a deep dive into the strategies and insights that are driving real results right now. Whether you are just getting started or looking to level up, this session is designed to give you practical takeaways you can use right away.",
          },
          { type: "divider", content: "" },
          {
            type: "highlight",
            content:
              "<strong>Event Details:</strong><br>\u{1F4C5} <strong>Date:</strong> [Event Date]<br>\u{1F552} <strong>Time:</strong> [Event Time] (Your Local Time)<br>\u{1F4CD} <strong>Where:</strong> Online \u2014 join from anywhere<br>\u{1F3A4} <strong>Speakers:</strong> [Speaker Name], [Speaker Name]",
          },
          {
            type: "text",
            content:
              "<strong>What you will learn:</strong><br>\u2022 Proven strategies for increasing engagement and conversions<br>\u2022 Step-by-step frameworks you can apply to your business today<br>\u2022 Real-world examples and live demonstrations<br>\u2022 Answers to your questions in our live Q&amp;A session",
          },
          {
            type: "button",
            content: "Reserve Your Spot Now",
            href: "#",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "Spots are limited, {{firstName}}, and past events have filled up quickly. Register now to make sure you do not miss out. We can not wait to see you there!",
          },
          {
            type: "text",
            content:
              "See you soon,<br>The {{company}} Team",
          },
        ],
        { brandColor: "#6366f1" }
      ),
    },
    defaultSms:
      "{{firstName}}, you\u2019re invited! Join our live event on [date]. Register now: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Write an engaging webinar or event invitation email. Include the event name, date, time, speakers, and what attendees will learn. Create a sense of urgency with limited spots. Include a clear register button. Keep the tone excited and professional.",
    suggestedMergeTags: ["firstName", "company"],
  },

  // -------------------------------------------------------------------------
  // 6. Webinar Follow-Up
  // -------------------------------------------------------------------------
  {
    id: "webinar-follow-up",
    name: "Webinar Follow-Up",
    description:
      "Follow up after a live event with the recording link, key takeaways, and next steps to keep the momentum going.",
    category: "content",
    icon: "\u{1F3AC}",
    channels: ["email"],
    automatable: false,
    defaultEmail: {
      subject:
        "Thanks for Joining, {{firstName}} \u2014 Here\u2019s the Recording",
      preheader:
        "Missed something or want to rewatch? The full recording and key takeaways are inside.",
      content:
        "Hi {{firstName}}, thank you so much for attending our live event! We had a fantastic turnout and some great conversations. As promised, here is the full recording so you can revisit any part of the session at your own pace. We have also pulled together the key takeaways and a few recommended next steps to help you put what you learned into action.",
      htmlContent: buildEmailHtml(
        [
          {
            type: "heading",
            content:
              "Thanks for Joining Us! \u{1F3AC}",
          },
          {
            type: "text",
            content:
              "Hi {{firstName}}, thank you so much for attending our live event! We had a fantastic turnout and some great conversations, and we are glad you were part of it.",
          },
          {
            type: "text",
            content:
              "As promised, here is the full recording so you can revisit any part of the session at your own pace \u2014 or share it with a colleague who could not make it.",
          },
          {
            type: "button",
            content: "Watch the Recording",
            href: "#",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content: "<strong>Key Takeaways:</strong>",
          },
          {
            type: "highlight",
            content:
              "\u2022 <strong>Start with your audience:</strong> Every effective strategy begins with a deep understanding of who you are trying to reach and what they care about most.<br><br>\u2022 <strong>Focus on consistency over perfection:</strong> Showing up regularly with good content beats waiting for the perfect moment. Progress compounds over time.<br><br>\u2022 <strong>Measure what matters:</strong> Identify 2\u20133 key metrics that align with your goals and track them weekly. Data-driven decisions always outperform guesswork.",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "<strong>Recommended Next Steps:</strong><br>\u2022 Review the recording and take notes on the strategies most relevant to your situation<br>\u2022 Pick one takeaway and implement it this week<br>\u2022 Join our community to continue the conversation and get support<br>\u2022 Keep an eye on your inbox for our next event announcement",
          },
          {
            type: "button",
            content: "Join the Community",
            href: "#",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "We truly appreciate your time and engagement, {{firstName}}. If you have any follow-up questions, just reply to this email and we will be happy to help.",
          },
          {
            type: "text",
            content:
              "Until next time,<br>The {{company}} Team",
          },
        ],
        { brandColor: "#6366f1" }
      ),
    },
    defaultSms: undefined,
    aiPromptHint:
      "Write a follow-up email for webinar attendees. Include a link to the recording, 2\u20133 key takeaways from the session, and recommended next steps. Keep the tone grateful, helpful, and action-oriented. Mention the reader by first name.",
    suggestedMergeTags: ["firstName", "company"],
  },

  // -------------------------------------------------------------------------
  // 7. Survey / Feedback Request
  // -------------------------------------------------------------------------
  {
    id: "survey-feedback",
    name: "Survey / Feedback Request",
    description:
      "Ask your audience for feedback or input through a brief survey to improve your products and services.",
    category: "content",
    icon: "\u2B50",
    channels: ["email", "sms"],
    automatable: false,
    defaultEmail: {
      subject:
        "We\u2019d Love Your Feedback, {{firstName}}",
      preheader:
        "Your opinion matters \u2014 take our quick 2-minute survey and help us improve.",
      content:
        "Hi {{firstName}}, your opinion truly matters to us, and we would love to hear from you! We have put together a short survey that takes just 2 minutes to complete. Your feedback helps us understand what we are doing well and where we can improve. Every response makes a real difference in shaping our future direction. Thank you in advance for taking the time!",
      htmlContent: buildEmailHtml(
        [
          {
            type: "heading",
            content:
              "We\u2019d Love Your Feedback \u2B50",
          },
          {
            type: "text",
            content:
              "Hi {{firstName}}, your opinion truly matters to us, and we would love to hear from you!",
          },
          {
            type: "text",
            content:
              "We are always looking for ways to serve you better, and the most valuable insights come directly from people like you \u2014 the ones who use our product every day. That is why we have put together a short survey, and we would be grateful if you could share your thoughts.",
          },
          {
            type: "highlight",
            content:
              "<strong>It only takes about 2 minutes.</strong> Your responses are completely anonymous and go directly to our product team. Every piece of feedback helps us prioritize what matters most to you.",
          },
          {
            type: "text",
            content:
              "<strong>What we are asking about:</strong><br>\u2022 Your overall experience with our product<br>\u2022 Features you find most valuable<br>\u2022 Areas where we can do better<br>\u2022 Ideas for new features or improvements",
          },
          {
            type: "button",
            content: "Take the 2-Minute Survey",
            href: "#",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "We read every single response, {{firstName}}, and your feedback has a direct impact on our roadmap. Thank you for helping us build something better for everyone.",
          },
          {
            type: "text",
            content:
              "With gratitude,<br>The {{company}} Team",
          },
        ],
        { brandColor: "#6366f1" }
      ),
    },
    defaultSms:
      "Hi {{firstName}}, we\u2019d love your feedback! Take our 2-min survey: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Write a friendly feedback request email asking the reader to complete a short survey. Emphasize that it only takes a few minutes, explain how their feedback will be used, and include a clear call to action. Keep the tone appreciative, respectful of their time, and genuine.",
    suggestedMergeTags: ["firstName", "company"],
  },

  // -------------------------------------------------------------------------
  // 8. NPS Score Request
  // -------------------------------------------------------------------------
  {
    id: "nps-request",
    name: "NPS Score Request",
    description:
      "Collect a Net Promoter Score with a simple 0\u201310 rating question to measure customer loyalty and satisfaction.",
    category: "content",
    icon: "\u{1F4C8}",
    channels: ["email", "sms"],
    automatable: false,
    defaultEmail: {
      subject: "One Quick Question, {{firstName}}",
      preheader:
        "How likely are you to recommend us? Your answer helps us improve.",
      content:
        "Hi {{firstName}}, we have just one quick question for you today. On a scale of 0 to 10, how likely are you to recommend us to a friend or colleague? Your honest answer helps us understand how we are doing and where we need to improve. It takes less than 30 seconds, and it makes a real difference. Thank you for your time!",
      htmlContent: buildEmailHtml(
        [
          {
            type: "heading",
            content: "One Quick Question \u{1F4C8}",
          },
          {
            type: "text",
            content:
              "Hi {{firstName}}, we have just one quick question for you today \u2014 and it takes less than 30 seconds to answer.",
          },
          {
            type: "highlight",
            content:
              "<strong>On a scale of 0 to 10, how likely are you to recommend us to a friend or colleague?</strong><br><br>0 = Not likely at all &nbsp;&nbsp;\u2022&nbsp;&nbsp; 10 = Extremely likely",
          },
          {
            type: "text",
            content:
              "Your honest answer helps us understand how we are doing and where we need to improve. Whether you give us a 10 or a 0, we want to hear it \u2014 because every score tells us something important about your experience.",
          },
          {
            type: "button",
            content: "Share Your Score",
            href: "#",
          },
          { type: "divider", content: "" },
          {
            type: "text",
            content:
              "<strong>Why does this matter?</strong><br>This single question \u2014 known as the Net Promoter Score \u2014 is one of the most widely used measures of customer satisfaction. We track it closely because your experience is our top priority. Your response goes directly to our leadership team and shapes the decisions we make.",
          },
          {
            type: "text",
            content:
              "Thank you for taking a moment to share your feedback, {{firstName}}. It truly means a lot to us.",
          },
          {
            type: "text",
            content:
              "Sincerely,<br>The {{company}} Team",
          },
        ],
        { brandColor: "#6366f1" }
      ),
    },
    defaultSms:
      "{{firstName}}, how likely are you to recommend us? Rate 0-10: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Write a concise NPS request email with a single question: how likely are you to recommend us on a scale of 0\u201310. Briefly explain what the score means and why their feedback matters. Include a clear call to action button. Keep the tone simple, respectful, and direct.",
    suggestedMergeTags: ["firstName", "company"],
  },
];
