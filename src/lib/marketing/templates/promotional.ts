// ---------------------------------------------------------------------------
// Promotional & Sales Marketing Templates
// ---------------------------------------------------------------------------

import type { MarketingTemplate } from "./types";
import { buildEmailHtml } from "./email-html";

export const PROMOTIONAL_TEMPLATES: MarketingTemplate[] = [
  // -----------------------------------------------------------------------
  // 1. Flash Sale
  // -----------------------------------------------------------------------
  {
    id: "flash-sale",
    name: "Flash Sale",
    description:
      "Time-limited 24-48 hour deals that create urgency and drive immediate purchases.",
    category: "promotional",
    icon: "\u26A1",
    channels: ["email", "sms"],
    automatable: false,
    defaultEmail: {
      subject: "FLASH SALE: 24 Hours Only! Don't Miss Out, {{firstName}}",
      preheader:
        "The clock is ticking — our biggest discounts disappear at midnight.",
      content: `FLASH SALE — 24 HOURS ONLY

Time is running out, {{firstName}}! For the next 24 hours we're slashing prices across the board — up to 50% off our most popular items.

This isn't a sale we run every week. Once the timer hits zero, these prices are gone for good.

What's on sale:
- Best-sellers: up to 50% off
- New arrivals: up to 30% off
- Bundles: extra 15% off

Use code FLASH24 at checkout for an additional 10% off your entire order.

Don't wait — shop the flash sale now before it's too late!`,
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "\u26A1 FLASH SALE — 24 Hours Only!",
        },
        {
          type: "text",
          content:
            "Time is running out, <strong>{{firstName}}</strong>! For the next 24 hours we're slashing prices across the board — up to <strong>50% off</strong> our most popular items.",
        },
        {
          type: "highlight",
          content:
            "\u23F0 <strong>This sale ends at midnight.</strong> Once the timer hits zero, these prices are gone for good.",
        },
        {
          type: "text",
          content:
            "<strong>What's on sale:</strong><br>&#8226; Best-sellers: up to 50% off<br>&#8226; New arrivals: up to 30% off<br>&#8226; Bundles: extra 15% off",
        },
        {
          type: "highlight",
          content:
            "Use code <strong>FLASH24</strong> at checkout for an additional 10% off your entire order.",
        },
        {
          type: "button",
          content: "Shop the Flash Sale Now",
          href: "{{shopLink}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Hurry — thousands of customers are shopping right now and stock is limited. Don't let this one slip away!",
        },
      ]),
    },
    defaultSms:
      "\u26A1 FLASH SALE! 24hrs only \u2014 up to 50% off. Shop now: {{shopLink}}. Hurry, {{firstName}}! Reply STOP to opt out.",
    aiPromptHint:
      "Write urgent, high-energy flash sale copy with countdown language, bold discount numbers, and a strong call to action. Emphasize scarcity and time limits.",
    suggestedMergeTags: [
      "firstName",
      "shopLink",
      "discountPercent",
      "couponCode",
      "saleEndDate",
    ],
  },

  // -----------------------------------------------------------------------
  // 2. Seasonal Sale
  // -----------------------------------------------------------------------
  {
    id: "seasonal-sale",
    name: "Seasonal Sale",
    description:
      "Spring, summer, fall, or winter seasonal sale campaigns with themed messaging and curated picks.",
    category: "promotional",
    icon: "\uD83C\uDF38",
    channels: ["email", "sms"],
    automatable: false,
    defaultEmail: {
      subject: "The Season's Best Deals Are Here, {{firstName}}!",
      preheader:
        "Fresh picks, fresh prices. Explore our seasonal collection at up to 40% off.",
      content: `THE SEASON'S BEST DEALS ARE HERE

Hi {{firstName}},

A new season means a fresh start — and fresh savings. We've hand-picked our favorite items of the season and marked them down so you can enjoy them at incredible prices.

Our Seasonal Picks:
- Trending styles: up to 40% off
- Seasonal essentials: starting at $9.99
- Staff favorites: buy 2, get 1 free

Whether you're refreshing your routine or trying something new, now is the perfect time. These seasonal prices won't last — once the season turns, so do these deals.

Explore the seasonal collection today!`,
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "\uD83C\uDF38 The Season's Best Deals Are Here!",
        },
        {
          type: "text",
          content:
            "Hi <strong>{{firstName}}</strong>,<br><br>A new season means a fresh start \u2014 and fresh savings. We've hand-picked our favorite items of the season and marked them down so you can enjoy them at incredible prices.",
        },
        {
          type: "highlight",
          content:
            "<strong>Our Seasonal Picks:</strong><br>&#8226; Trending styles: up to 40% off<br>&#8226; Seasonal essentials: starting at $9.99<br>&#8226; Staff favorites: buy 2, get 1 free",
        },
        {
          type: "text",
          content:
            "Whether you're refreshing your routine or trying something new, now is the perfect time. These seasonal prices won't last \u2014 once the season turns, so do these deals.",
        },
        {
          type: "button",
          content: "Explore the Seasonal Collection",
          href: "{{shopLink}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Need inspiration? Our team curated these picks just for customers like you. Happy shopping!",
        },
      ]),
    },
    defaultSms:
      "\uD83C\uDF38 Seasonal sale is live, {{firstName}}! Up to 40% off top picks. Shop now: {{shopLink}}. Reply STOP to opt out.",
    aiPromptHint:
      "Write warm, seasonal copy that matches the current time of year. Highlight curated picks, limited-time savings, and the feeling of a fresh start.",
    suggestedMergeTags: [
      "firstName",
      "shopLink",
      "seasonName",
      "discountPercent",
    ],
  },

  // -----------------------------------------------------------------------
  // 3. VIP Loyalty Discount
  // -----------------------------------------------------------------------
  {
    id: "vip-loyalty",
    name: "VIP Loyalty Discount",
    description:
      "Exclusive discounts for long-term, high-value clients to reward loyalty and strengthen retention.",
    category: "promotional",
    icon: "\uD83D\uDC51",
    channels: ["email", "sms"],
    automatable: false,
    defaultEmail: {
      subject: "{{firstName}}, You've Earned Something Special",
      preheader:
        "A VIP-only reward just for you. Because loyalty deserves to be celebrated.",
      content: `YOU'VE EARNED SOMETHING SPECIAL

{{firstName}},

You've been with us for {{daysAsClient}} days, and we don't take that for granted. Customers like you are the reason we do what we do — and we want to say thank you in a meaningful way.

As one of our VIP customers, here's an exclusive offer made just for you:

Your VIP Discount: Use code {{couponCode}} for 25% off your next order.

This code is exclusively yours — it won't work for anyone else. There's no minimum purchase and it's valid for the next 14 days.

You've earned this, {{firstName}}. Treat yourself to something great.`,
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "\uD83D\uDC51 You've Earned Something Special",
        },
        {
          type: "text",
          content:
            "<strong>{{firstName}}</strong>,<br><br>You've been with us for <strong>{{daysAsClient}} days</strong>, and we don't take that for granted. Customers like you are the reason we do what we do \u2014 and we want to say thank you in a meaningful way.",
        },
        {
          type: "highlight",
          content:
            "\uD83C\uDF81 <strong>Your VIP Discount:</strong> Use code <strong>{{couponCode}}</strong> for <strong>25% off</strong> your next order. Exclusively yours \u2014 valid for 14 days.",
        },
        {
          type: "text",
          content:
            "There's no minimum purchase and no strings attached. This is our way of saying <em>thank you</em> for being part of our community.",
        },
        {
          type: "button",
          content: "Redeem Your VIP Reward",
          href: "{{shopLink}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "You've earned this, {{firstName}}. Treat yourself to something great.",
        },
      ]),
    },
    defaultSms:
      "\uD83D\uDC51 {{firstName}}, you're a VIP! Use code {{couponCode}} for 25% off \u2014 just for you. Shop: {{shopLink}}. Reply STOP to opt out.",
    aiPromptHint:
      "Write warm, appreciative copy that makes the customer feel valued and exclusive. Emphasize loyalty, personal recognition, and the uniqueness of the offer.",
    suggestedMergeTags: [
      "firstName",
      "daysAsClient",
      "couponCode",
      "shopLink",
    ],
  },

  // -----------------------------------------------------------------------
  // 4. Referral Program
  // -----------------------------------------------------------------------
  {
    id: "referral-program",
    name: "Referral Program",
    description:
      "Encourage customers to refer friends with a dual-incentive reward program.",
    category: "promotional",
    icon: "\uD83E\uDD1D",
    channels: ["email", "sms"],
    automatable: false,
    defaultEmail: {
      subject: "Give $10, Get $10 \u2014 Share the Love, {{firstName}}!",
      preheader:
        "Your friends get $10 off, you get $10 back. Everybody wins.",
      content: `GIVE $10, GET $10 — SHARE THE LOVE

Hi {{firstName}},

Love what we do? Now you can share the experience with friends and family — and you both get rewarded.

Here's how it works:
1. Share your personal referral link with anyone you think would love us.
2. They get $10 off their first order.
3. You get a $10 credit the moment they make a purchase.

Your referral link: {{referralLink}}

There's no limit to how many friends you can refer. The more you share, the more you earn. Some of our customers have earned over $100 in credits just by spreading the word!

Start sharing today and watch the rewards roll in.`,
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "\uD83E\uDD1D Give $10, Get $10 \u2014 Share the Love!",
        },
        {
          type: "text",
          content:
            "Hi <strong>{{firstName}}</strong>,<br><br>Love what we do? Now you can share the experience with friends and family \u2014 and you <em>both</em> get rewarded.",
        },
        {
          type: "highlight",
          content:
            "<strong>How it works:</strong><br>1\uFE0F\u20E3 Share your personal referral link<br>2\uFE0F\u20E3 They get <strong>$10 off</strong> their first order<br>3\uFE0F\u20E3 You get a <strong>$10 credit</strong> when they purchase",
        },
        {
          type: "text",
          content:
            "There's <strong>no limit</strong> to how many friends you can refer. The more you share, the more you earn. Some of our customers have earned over $100 in credits!",
        },
        {
          type: "button",
          content: "Share Your Referral Link",
          href: "{{referralLink}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Start sharing today and watch the rewards roll in. Your friends will thank you!",
        },
      ]),
    },
    defaultSms:
      "\uD83E\uDD1D Hey {{firstName}}! Give $10, get $10 when friends sign up with your link: {{referralLink}}. Reply STOP to opt out.",
    aiPromptHint:
      "Write friendly, enthusiastic referral copy that clearly explains the dual incentive. Make sharing feel rewarding and effortless. Emphasize the win-win.",
    suggestedMergeTags: ["firstName", "referralLink", "referralReward"],
  },

  // -----------------------------------------------------------------------
  // 5. Coupon / Promo Code Delivery
  // -----------------------------------------------------------------------
  {
    id: "coupon-delivery",
    name: "Coupon/Promo Code",
    description:
      "Deliver a personalized discount or promo code with clear redemption instructions.",
    category: "promotional",
    icon: "\uD83C\uDF9F\uFE0F",
    channels: ["email", "sms"],
    automatable: false,
    defaultEmail: {
      subject: "Your Exclusive Discount Code Inside, {{firstName}}",
      preheader:
        "We've got a special code waiting for you. Open up and save!",
      content: `YOUR EXCLUSIVE DISCOUNT CODE

Hi {{firstName}},

Here's a little something to brighten your day. We've created a special discount code just for you:

Your Code: {{couponCode}}

How to use it:
1. Browse our store and add your favorite items to the cart.
2. At checkout, enter the code above in the "Promo Code" field.
3. Watch your total drop instantly!

This code expires on {{expiryDate}}, so don't wait too long. Whether you've had your eye on something for a while or want to discover something new, now is the perfect time.

Happy shopping!`,
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "\uD83C\uDF9F\uFE0F Your Exclusive Discount Code",
        },
        {
          type: "text",
          content:
            "Hi <strong>{{firstName}}</strong>,<br><br>Here's a little something to brighten your day. We've created a special discount code just for you:",
        },
        {
          type: "highlight",
          content:
            "\uD83C\uDF89 <strong>Your Code: {{couponCode}}</strong><br><br>Enter this code at checkout to save instantly. Expires <strong>{{expiryDate}}</strong>.",
        },
        {
          type: "text",
          content:
            "<strong>How to use it:</strong><br>1. Browse our store and add items to your cart<br>2. Enter <strong>{{couponCode}}</strong> in the promo code field at checkout<br>3. Watch your total drop instantly!",
        },
        {
          type: "button",
          content: "Start Shopping Now",
          href: "{{shopLink}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Whether you've had your eye on something or want to discover something new \u2014 now is the perfect time. Happy shopping!",
        },
      ]),
    },
    defaultSms:
      "\uD83C\uDF9F\uFE0F {{firstName}}, your code {{couponCode}} is ready! Save now at {{shopLink}}. Expires {{expiryDate}}. Reply STOP to opt out.",
    aiPromptHint:
      "Write clear, exciting copy that puts the discount code front and center. Include step-by-step redemption instructions and emphasize the expiry date to create urgency.",
    suggestedMergeTags: [
      "firstName",
      "couponCode",
      "expiryDate",
      "shopLink",
      "discountPercent",
    ],
  },

  // -----------------------------------------------------------------------
  // 6. Abandoned Cart
  // -----------------------------------------------------------------------
  {
    id: "abandoned-cart",
    name: "Abandoned Cart",
    description:
      "Automated reminder for customers who added items to their cart but didn't complete checkout.",
    category: "promotional",
    icon: "\uD83D\uDED2",
    channels: ["email", "sms"],
    automatable: true,
    triggerEvent: "cart.abandoned",
    defaultEmail: {
      subject: "{{firstName}}, You Left Something Behind!",
      preheader:
        "Your cart is waiting. Complete your order before your items sell out.",
      content: `YOU LEFT SOMETHING BEHIND!

Hey {{firstName}},

We noticed you left a few items in your cart. No worries — it happens! Your cart is saved and ready for you whenever you are.

But here's the thing: the items in your cart are selling fast, and we'd hate for you to miss out.

Your cart summary is waiting for you — just click below to pick up right where you left off. No need to search again, no need to re-add anything. One click and you're back.

Still on the fence? Here's what other customers are saying:
"Absolutely love the quality! Wish I'd ordered sooner." — Sarah M.

Complete your order today and see why thousands of customers keep coming back.`,
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "\uD83D\uDED2 You Left Something Behind!",
        },
        {
          type: "text",
          content:
            "Hey <strong>{{firstName}}</strong>,<br><br>We noticed you left a few items in your cart. No worries \u2014 it happens! Your cart is saved and ready whenever you are.",
        },
        {
          type: "highlight",
          content:
            "\u26A0\uFE0F <strong>Heads up:</strong> The items in your cart are selling fast. We'd hate for you to miss out on something you clearly loved.",
        },
        {
          type: "text",
          content:
            "Just click below to pick up right where you left off. No need to search again \u2014 everything is exactly how you left it.",
        },
        {
          type: "button",
          content: "Complete Your Order",
          href: "{{cartLink}}",
        },
        { type: "divider", content: "" },
        {
          type: "highlight",
          content:
            "\u2B50 <strong>What other customers are saying:</strong><br><em>\"Absolutely love the quality! Wish I'd ordered sooner.\"</em> \u2014 Sarah M.",
        },
        {
          type: "text",
          content:
            "Complete your order today and see why thousands of customers keep coming back.",
        },
      ]),
    },
    defaultSms:
      "Hey {{firstName}}, you left items in your cart! Complete your order: {{cartLink}}. Reply STOP to opt out.",
    aiPromptHint:
      "Write a friendly, non-pushy cart recovery email. Include social proof, mild urgency about stock levels, and make it effortless to return to checkout. Avoid being guilt-trippy.",
    suggestedMergeTags: [
      "firstName",
      "cartLink",
      "cartItemCount",
      "cartTotal",
    ],
  },

  // -----------------------------------------------------------------------
  // 7. Product Launch
  // -----------------------------------------------------------------------
  {
    id: "product-launch",
    name: "Product Launch",
    description:
      "Announce a new product, service, or feature with excitement and an early-access call to action.",
    category: "promotional",
    icon: "\uD83D\uDE80",
    channels: ["email", "sms"],
    automatable: false,
    defaultEmail: {
      subject: "Introducing Something New, {{firstName}}!",
      preheader:
        "Be the first to see what we've been working on. Early access inside.",
      content: `INTRODUCING SOMETHING NEW

{{firstName}}, we've been working on something special — and today, we're finally ready to share it with you.

Introducing {{productName}}: designed from the ground up to solve the problems you told us about, built with the quality you've come to expect from us.

What makes it special:
- Built with your feedback in mind
- Premium quality at an accessible price
- Designed to make your life easier, starting day one

As a valued customer, you get early access before we open it up to everyone. Be among the first to try {{productName}} and let us know what you think.

This is just the beginning — and we're excited to have you along for the ride.`,
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "\uD83D\uDE80 Introducing Something New!",
        },
        {
          type: "text",
          content:
            "<strong>{{firstName}}</strong>, we've been working on something special \u2014 and today, we're finally ready to share it with you.",
        },
        {
          type: "highlight",
          content:
            "Introducing <strong>{{productName}}</strong> \u2014 designed from the ground up to solve the problems you told us about, built with the quality you've come to expect.",
        },
        {
          type: "text",
          content:
            "<strong>What makes it special:</strong><br>&#8226; Built with your feedback in mind<br>&#8226; Premium quality at an accessible price<br>&#8226; Designed to make your life easier, starting day one",
        },
        {
          type: "text",
          content:
            "As a valued customer, <strong>you get early access</strong> before we open it up to everyone. Be among the first to experience it.",
        },
        {
          type: "button",
          content: "Get Early Access Now",
          href: "{{productLink}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "This is just the beginning \u2014 and we're excited to have you along for the ride.",
        },
      ]),
    },
    defaultSms:
      "\uD83D\uDE80 {{firstName}}, something new just dropped! Be first to try {{productName}}: {{productLink}}. Reply STOP to opt out.",
    aiPromptHint:
      "Write exciting, forward-looking launch copy that builds anticipation. Highlight key features and benefits, offer early access as a reward for being a customer, and include a clear CTA.",
    suggestedMergeTags: [
      "firstName",
      "productName",
      "productLink",
      "launchDate",
    ],
  },

  // -----------------------------------------------------------------------
  // 8. Limited Stock Alert
  // -----------------------------------------------------------------------
  {
    id: "limited-stock",
    name: "Limited Stock Alert",
    description:
      "Create urgency with scarcity-driven messaging about low-stock or limited-edition items.",
    category: "promotional",
    icon: "\uD83D\uDD25",
    channels: ["email", "sms"],
    automatable: false,
    defaultEmail: {
      subject: "Almost Gone, {{firstName}} \u2014 Only a Few Left!",
      preheader:
        "Stock is running dangerously low. Grab yours before they're gone for good.",
      content: `ALMOST GONE — ONLY A FEW LEFT!

{{firstName}}, this is your heads-up: some of our most popular items are almost out of stock, and once they're gone, they're gone.

We're not saying this to pressure you — we're saying it because we know how frustrating it is to miss out on something you wanted. Here's what's running low:

- Top sellers with less than 10 units remaining
- Limited-edition items that won't be restocked
- Customer favorites flying off the shelves

Last time stock got this low, items sold out within hours. If there's something you've been thinking about, now is the time to act.

Don't let this one slip away.`,
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "\uD83D\uDD25 Almost Gone \u2014 Only a Few Left!",
        },
        {
          type: "text",
          content:
            "<strong>{{firstName}}</strong>, this is your heads-up: some of our most popular items are almost out of stock, and once they're gone, they're <em>gone</em>.",
        },
        {
          type: "highlight",
          content:
            "\u26A0\uFE0F <strong>Stock is critically low:</strong><br>&#8226; Top sellers with less than 10 units remaining<br>&#8226; Limited-edition items that won't be restocked<br>&#8226; Customer favorites flying off the shelves",
        },
        {
          type: "text",
          content:
            "Last time stock got this low, items <strong>sold out within hours</strong>. If there's something you've been thinking about, now is the time to act.",
        },
        {
          type: "button",
          content: "Grab Yours Before They're Gone",
          href: "{{shopLink}}",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Don't let this one slip away, {{firstName}}. Once it's sold out, we can't guarantee it'll come back.",
        },
      ]),
    },
    defaultSms:
      "\uD83D\uDD25 {{firstName}}, stock is almost gone! Grab yours before it sells out: {{shopLink}}. Reply STOP to opt out.",
    aiPromptHint:
      "Write urgency-driven scarcity copy that is compelling but not manipulative. Use specific numbers (e.g., 'less than 10 left'), social proof about demand, and a strong CTA. Avoid fake urgency.",
    suggestedMergeTags: [
      "firstName",
      "shopLink",
      "productName",
      "stockCount",
    ],
  },
];
