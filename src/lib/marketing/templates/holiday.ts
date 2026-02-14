import type { MarketingTemplate } from "./types";
import { buildEmailHtml } from "./email-html";

// ---------------------------------------------------------------------------
// Holiday Marketing Templates (23 total)
// Aligned with the holiday calendar in src/lib/marketing/holidays.ts
// ---------------------------------------------------------------------------

export const HOLIDAY_TEMPLATES: MarketingTemplate[] = [
  // -------------------------------------------------------------------------
  // 1. New Year's Day - Jan 1
  // -------------------------------------------------------------------------
  {
    id: "new-years-day",
    name: "New Year's Day",
    description:
      "Ring in the new year with an uplifting campaign celebrating fresh starts, resolutions, and exclusive new-year offers.",
    category: "holiday",
    icon: "\u{1F389}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Happy New Year, {{firstName}}! Here's to New Beginnings",
      preheader:
        "Start the year off right with an exclusive offer just for you.",
      content:
        "Happy New Year {{firstName}}! Here's to new beginnings and making this year the best one yet. We're kicking things off with a special offer to help you start strong.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Happy New Year, {{firstName}}! \u{1F389}",
        },
        {
          type: "text",
          content:
            "A brand-new year is here, and we couldn't be more excited to start it with you! Whether you're setting bold resolutions or simply looking forward to what's ahead, we want to make sure your year begins on the right note.",
        },
        {
          type: "highlight",
          content:
            "To celebrate new beginnings, enjoy <strong>20% off</strong> your next purchase with code <strong>NEWYEAR2026</strong>. Valid through January 7th.",
        },
        {
          type: "text",
          content:
            "Here's to growth, success, and an incredible year together. Thank you for being part of our community, {{firstName}}.",
        },
        {
          type: "button",
          content: "Shop New Year Deals",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Wishing you and yours a prosperous and joyful 2026!",
        },
      ]),
    },
    defaultSms:
      "Happy New Year {{firstName}}! \u{1F389} Start 2026 right with 20% off. Use code NEWYEAR2026. Shop now: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create an uplifting, celebratory email welcoming the new year with themes of fresh starts, new goals, resolutions, and exclusive new-year offers.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 2. Martin Luther King Jr. Day - 3rd Monday of January
  // -------------------------------------------------------------------------
  {
    id: "mlk-day",
    name: "Martin Luther King Jr. Day",
    description:
      "Honor Dr. King's legacy with a campaign centered on unity, service, and community impact.",
    category: "holiday",
    icon: "\u{270A}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Honoring Dr. King's Legacy Together, {{firstName}}",
      preheader:
        "Unity, service, and community \u2014 let's make a difference today.",
      content:
        "Today we honor Dr. Martin Luther King Jr. and his enduring message of unity, justice, and service. Join us in giving back to our community, {{firstName}}.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Honoring Dr. King\u2019s Legacy \u{270A}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, today we pause to honor the life and legacy of Dr. Martin Luther King Jr. His vision of unity, equality, and service continues to inspire communities everywhere.",
        },
        {
          type: "highlight",
          content:
            "\u201CLife\u2019s most persistent and urgent question is: What are you doing for others?\u201D \u2014 Dr. Martin Luther King Jr.",
        },
        {
          type: "text",
          content:
            "This MLK Day, we encourage everyone to find a way to serve their community. Whether it's volunteering your time, supporting a local cause, or simply spreading kindness, every action counts.",
        },
        {
          type: "text",
          content:
            "We're proud to support communities that uplift one another. As a small gesture, we're donating a portion of today's proceeds to local service organizations.",
        },
        {
          type: "button",
          content: "Learn How We Give Back",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Together, we can build the beloved community Dr. King envisioned.",
        },
      ]),
    },
    defaultSms:
      "Hi {{firstName}}, today we honor Dr. King's legacy of unity and service. Join us in giving back. Learn more: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a respectful, inspiring email honoring Martin Luther King Jr. Day with themes of unity, service, community impact, and social justice.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 3. Valentine's Day - Feb 14
  // -------------------------------------------------------------------------
  {
    id: "valentines-day",
    name: "Valentine's Day",
    description:
      "Spread the love with a warm campaign featuring heartfelt appreciation, gift ideas, and Valentine's specials.",
    category: "holiday",
    icon: "\u{2764}\u{FE0F}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Spread the Love, {{firstName}} \u{2764}\u{FE0F}",
      preheader:
        "Show someone special how much you care with our Valentine's picks.",
      content:
        "Happy Valentine's Day {{firstName}}! Whether it's a partner, friend, or yourself \u2014 today is all about celebrating love. Check out our curated gift ideas and special offers.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content:
            "Happy Valentine\u2019s Day, {{firstName}}! \u{2764}\u{FE0F}",
        },
        {
          type: "text",
          content:
            "Love is in the air! Whether you're celebrating with a partner, a best friend, or treating yourself, Valentine's Day is the perfect time to show the people you care about just how much they mean to you.",
        },
        {
          type: "highlight",
          content:
            "Send a little love their way \u2014 enjoy <strong>free shipping</strong> on all orders today plus a complimentary gift wrap on orders over $50.",
        },
        {
          type: "text",
          content:
            "From thoughtful gifts to heartfelt surprises, we've curated a collection that's sure to make someone smile. Don't wait \u2014 order by February 12th for guaranteed delivery!",
        },
        {
          type: "button",
          content: "Shop Valentine's Gifts",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Thank you for being someone we love having in our community, {{firstName}}.",
        },
      ]),
    },
    defaultSms:
      "Happy Valentine's Day {{firstName}}! \u{2764}\u{FE0F} Free shipping today + gift wrap on $50+. Find the perfect gift: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a warm, romantic-themed email about love, appreciation, gift ideas, and special Valentine's Day offers.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 4. Presidents' Day - 3rd Monday of February
  // -------------------------------------------------------------------------
  {
    id: "presidents-day",
    name: "Presidents' Day",
    description:
      "Celebrate Presidents' Day with a patriotic-themed sale campaign featuring exclusive weekend deals.",
    category: "holiday",
    icon: "\u{1F1FA}\u{1F1F8}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Presidents' Day Sale: Up to 30% Off, {{firstName}}!",
      preheader:
        "Patriotic savings are here \u2014 don't miss our biggest winter sale.",
      content:
        "Happy Presidents' Day {{firstName}}! In honor of the holiday, we're offering up to 30% off across our entire collection. This weekend-only sale won't last long!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content:
            "Presidents\u2019 Day Sale \u{1F1FA}\u{1F1F8}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, in honor of Presidents' Day, we're rolling out our biggest winter sale of the season! This is your chance to grab incredible deals before spring arrives.",
        },
        {
          type: "highlight",
          content:
            "Save up to <strong>30% off</strong> sitewide this Presidents' Day weekend. No code needed \u2014 discounts applied automatically at checkout. Sale ends Monday at midnight.",
        },
        {
          type: "text",
          content:
            "Whether you've had your eye on something special or want to stock up on essentials, now is the time. These presidential savings only come around once a year!",
        },
        {
          type: "button",
          content: "Shop the Sale",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Have a wonderful Presidents' Day weekend, {{firstName}}!",
        },
      ]),
    },
    defaultSms:
      "Presidents' Day Sale! \u{1F1FA}\u{1F1F8} Up to 30% off sitewide this weekend, {{firstName}}. No code needed. Shop: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a patriotic, sale-focused email for Presidents' Day with themes of American pride, weekend deals, and winter clearance.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 5. St. Patrick's Day - Mar 17
  // -------------------------------------------------------------------------
  {
    id: "st-patricks-day",
    name: "St. Patrick's Day",
    description:
      "Get lucky with a festive green-themed campaign featuring lucky deals and St. Patrick's Day fun.",
    category: "holiday",
    icon: "\u{2618}\u{FE0F}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Feeling Lucky, {{firstName}}? St. Patrick's Day Deals Inside!",
      preheader:
        "Your luck just got better \u2014 green-themed deals are waiting.",
      content:
        "Happy St. Patrick's Day {{firstName}}! Feeling lucky? You should be! We've got special green-themed deals that are too good to pass up.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content:
            "Feeling Lucky, {{firstName}}? \u{2618}\u{FE0F}",
        },
        {
          type: "text",
          content:
            "Happy St. Patrick's Day! The luck of the Irish is on your side today, and we've got the deals to prove it. No four-leaf clover needed \u2014 just click and save!",
        },
        {
          type: "highlight",
          content:
            "It's your lucky day! Use code <strong>LUCKY17</strong> for <strong>17% off</strong> your entire order. Plus, one lucky shopper today wins a $100 gift card!",
        },
        {
          type: "text",
          content:
            "From green-themed favorites to pot-of-gold worthy finds, our St. Patrick's Day collection is bursting with charm. Hurry \u2014 these lucky deals vanish at midnight!",
        },
        {
          type: "button",
          content: "Grab Your Lucky Deal",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "May the luck of the Irish be with you, {{firstName}}!",
        },
      ]),
    },
    defaultSms:
      "Happy St. Patrick's Day {{firstName}}! \u{2618}\u{FE0F} Use code LUCKY17 for 17% off today only. Shop: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a fun, green-themed email for St. Patrick's Day with luck, Irish charm, festive deals, and playful copy.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 6. Easter - Computed (varies each year)
  // -------------------------------------------------------------------------
  {
    id: "easter",
    name: "Easter",
    description:
      "Celebrate spring renewal with an Easter campaign featuring family themes, egg hunts, and seasonal offers.",
    category: "holiday",
    icon: "\u{1F430}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Hoppy Easter, {{firstName}}! Spring Into Something Special",
      preheader:
        "Fresh deals are blooming this Easter \u2014 come see what's new.",
      content:
        "Happy Easter {{firstName}}! Spring is in full bloom and so are our deals. Celebrate renewal and fresh beginnings with our seasonal collection.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Hoppy Easter, {{firstName}}! \u{1F430}",
        },
        {
          type: "text",
          content:
            "Spring has sprung and Easter is here! It's a time for renewal, togetherness, and celebrating the bright days ahead. We hope your basket is overflowing with joy today.",
        },
        {
          type: "highlight",
          content:
            "Our Easter Egg Hunt Sale is on! Enjoy <strong>25% off</strong> spring favorites with code <strong>SPRING25</strong>. Plus, find hidden \"golden egg\" deals scattered across our site for extra surprises!",
        },
        {
          type: "text",
          content:
            "Whether you're hosting a festive brunch, hiding eggs in the backyard, or simply soaking in the spring sunshine, we wish you a day filled with warmth and wonder.",
        },
        {
          type: "button",
          content: "Shop Easter Favorites",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Wishing you a beautiful Easter surrounded by the people you love, {{firstName}}.",
        },
      ]),
    },
    defaultSms:
      "Hoppy Easter {{firstName}}! \u{1F430} 25% off spring favorites with code SPRING25. Find our hidden deals: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a cheerful, spring-themed email celebrating Easter with themes of renewal, family, egg hunts, and seasonal promotions.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 7. Tax Day - Apr 15
  // -------------------------------------------------------------------------
  {
    id: "tax-day",
    name: "Tax Day",
    description:
      "Help customers celebrate surviving tax season with stress-relief deals and financial savings.",
    category: "holiday",
    icon: "\u{1F4B0}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Tax Day Relief: You Deserve This, {{firstName}}!",
      preheader:
        "Taxes are done \u2014 treat yourself with savings that feel like a refund.",
      content:
        "Hey {{firstName}}, tax season is finally over! You deserve a reward. Check out our Tax Day deals that feel just like getting a refund.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Tax Day Relief Is Here! \u{1F4B0}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, congratulations \u2014 you survived tax season! Whether you're celebrating a refund or just glad the paperwork is done, we think you deserve something nice.",
        },
        {
          type: "highlight",
          content:
            "Our Tax Day Sale is your reward: save <strong>$15 off every $100</strong> you spend today. Think of it as a little refund from us to you. Use code <strong>TAXBREAK</strong> at checkout.",
        },
        {
          type: "text",
          content:
            "No complicated forms, no fine print, no stress \u2014 just straightforward savings on the things you love. This deal disappears at midnight, so don't procrastinate like last year's filing!",
        },
        {
          type: "button",
          content: "Claim Your Tax Day Savings",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Here's to keeping more of what you earned, {{firstName}}!",
        },
      ]),
    },
    defaultSms:
      "Tax Day relief {{firstName}}! \u{1F4B0} Save $15 per $100 with code TAXBREAK. Treat yourself today: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a lighthearted email for Tax Day with themes of tax relief, rewarding yourself, financial deals, and stress-free savings.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 8. Mother's Day - 2nd Sunday of May
  // -------------------------------------------------------------------------
  {
    id: "mothers-day",
    name: "Mother's Day",
    description:
      "Honor moms everywhere with a heartfelt campaign featuring gift ideas, appreciation, and special offers.",
    category: "holiday",
    icon: "\u{1F490}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Make Mom's Day Unforgettable, {{firstName}}!",
      preheader:
        "Thoughtful gifts she'll treasure \u2014 plus free shipping for Mom.",
      content:
        "Happy Mother's Day {{firstName}}! Celebrate the incredible moms in your life with our curated gift collection and special offers. She deserves the world!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content:
            "Celebrate the Amazing Moms in Your Life \u{1F490}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, Mother's Day is the perfect time to show the special women in your life just how much they mean to you. Whether she's your mom, grandmother, partner, or mentor \u2014 she deserves to feel celebrated.",
        },
        {
          type: "highlight",
          content:
            "Make her day extra special: enjoy <strong>free shipping</strong> on all Mother's Day gifts plus a complimentary handwritten card with every order. Order by Thursday for guaranteed delivery!",
        },
        {
          type: "text",
          content:
            "From luxurious self-care sets to personalized keepsakes, our Mother's Day gift guide has something for every mom. Browse our top picks and find the perfect way to say \"thank you\" for everything she does.",
        },
        {
          type: "button",
          content: "Shop Mother's Day Gifts",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "To all the moms out there \u2014 happy Mother's Day from our family to yours!",
        },
      ]),
    },
    defaultSms:
      "Happy Mother's Day! \u{1F490} Free shipping on all gifts for Mom, {{firstName}}. Order by Thu for delivery: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a heartfelt email honoring mothers and maternal figures with gift ideas, appreciation messages, and special Mother's Day offers.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 9. Memorial Day - Last Monday of May
  // -------------------------------------------------------------------------
  {
    id: "memorial-day",
    name: "Memorial Day",
    description:
      "Honor those who served with a respectful campaign that also kicks off summer with special sales.",
    category: "holiday",
    icon: "\u{1F1FA}\u{1F1F8}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Honor & Save This Memorial Day, {{firstName}}",
      preheader:
        "We remember those who served \u2014 plus summer savings are here.",
      content:
        "This Memorial Day, we honor the brave men and women who gave their all. We also invite you to kick off summer with exclusive deals, {{firstName}}.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Honor & Save This Memorial Day \u{1F1FA}\u{1F1F8}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, this Memorial Day we take a moment to honor and remember the brave men and women who made the ultimate sacrifice for our freedoms. Their courage and service will never be forgotten.",
        },
        {
          type: "highlight",
          content:
            "As summer officially kicks off, enjoy our <strong>Memorial Day Weekend Sale</strong>: up to <strong>40% off</strong> summer essentials. No code needed \u2014 prices already reduced. Sale runs Friday through Monday.",
        },
        {
          type: "text",
          content:
            "Whether you're planning a backyard barbecue, heading to the beach, or enjoying a quiet day of reflection, we hope this weekend is meaningful and memorable.",
        },
        {
          type: "button",
          content: "Shop Memorial Day Deals",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "With gratitude and respect \u2014 have a wonderful Memorial Day, {{firstName}}.",
        },
      ]),
    },
    defaultSms:
      "Memorial Day Sale! \u{1F1FA}\u{1F1F8} Up to 40% off summer essentials all weekend, {{firstName}}. Shop now: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a respectful email honoring those who served while highlighting Memorial Day weekend sales, summer kick-off deals, and outdoor activities.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 10. Father's Day - 3rd Sunday of June
  // -------------------------------------------------------------------------
  {
    id: "fathers-day",
    name: "Father's Day",
    description:
      "Celebrate dads and father figures with a warm campaign featuring gift guides and special promotions.",
    category: "holiday",
    icon: "\u{1F454}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Make Dad Feel Like a Champ, {{firstName}}!",
      preheader:
        "Top gifts for Dad \u2014 curated picks he'll actually love.",
      content:
        "Happy Father's Day {{firstName}}! Show the dads in your life how much they mean with our handpicked gift guide and Father's Day specials.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Happy Father\u2019s Day! \u{1F454}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, Father's Day is here and it's time to show Dad how much he means to you! Whether he's the grill master, the fix-it guy, the world's best coach, or all of the above \u2014 we've got the perfect way to celebrate him.",
        },
        {
          type: "highlight",
          content:
            "Our Father's Day Gift Guide is live! Enjoy <strong>20% off</strong> all gifts for Dad with code <strong>BESTDAD</strong>. Plus, get a <strong>free gift box</strong> with orders over $75.",
        },
        {
          type: "text",
          content:
            "From rugged outdoor gear to sophisticated accessories, our collection is packed with gifts Dad will actually use and love. Don't settle for another tie \u2014 find something truly special this year.",
        },
        {
          type: "button",
          content: "Shop Father's Day Gifts",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Happy Father's Day to all the incredible dads out there!",
        },
      ]),
    },
    defaultSms:
      "Happy Father's Day! \u{1F454} 20% off gifts for Dad with code BESTDAD, {{firstName}}. Shop now: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a warm email celebrating fathers and father figures with gift guides, heartfelt appreciation, and Father's Day promotions.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 11. Independence Day - Jul 4
  // -------------------------------------------------------------------------
  {
    id: "independence-day",
    name: "Independence Day",
    description:
      "Celebrate the Fourth of July with a patriotic, festive campaign featuring fireworks-worthy deals.",
    category: "holiday",
    icon: "\u{1F386}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject:
        "Happy 4th of July, {{firstName}}! Fireworks-Worthy Deals Inside",
      preheader:
        "Celebrate freedom with explosive savings this Independence Day.",
      content:
        "Happy Independence Day {{firstName}}! Celebrate the red, white, and blue with our biggest summer sale. Fireworks not included, but the deals are just as exciting!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Happy 4th of July! \u{1F386}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, it's time to celebrate America's birthday! Break out the sparklers, fire up the grill, and get ready for a weekend of freedom, fun, and fireworks.",
        },
        {
          type: "highlight",
          content:
            "Our 4th of July Blowout Sale is here! Enjoy up to <strong>50% off</strong> plus an extra <strong>10% off</strong> with code <strong>FREEDOM</strong>. This explosive deal ends Sunday at midnight!",
        },
        {
          type: "text",
          content:
            "Whether you're hosting the ultimate cookout, watching fireworks with family, or enjoying a day at the lake, make it a Fourth to remember. Stock up on summer favorites before these deals fizzle out!",
        },
        {
          type: "button",
          content: "Shop 4th of July Sale",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Wishing you a safe, happy, and spectacular Independence Day, {{firstName}}!",
        },
      ]),
    },
    defaultSms:
      "Happy 4th {{firstName}}! \u{1F386} Up to 50% off + extra 10% with code FREEDOM. Celebrate and save: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a patriotic, festive email celebrating Independence Day with themes of freedom, fireworks, summer fun, and Fourth of July sales.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 12. Back to School - Aug 15
  // -------------------------------------------------------------------------
  {
    id: "back-to-school",
    name: "Back to School",
    description:
      "Help families gear up for a new school year with fresh-start deals, supply lists, and seasonal offers.",
    category: "holiday",
    icon: "\u{1F4DA}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Back to School Essentials Are Here, {{firstName}}!",
      preheader:
        "Gear up for a fresh start \u2014 everything they need for the new school year.",
      content:
        "Hey {{firstName}}! A new school year means a fresh start. Get everything you need to make this year the best one yet with our back-to-school collection.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Back to School Season Is Here! \u{1F4DA}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, can you believe it's already back-to-school time? Whether you're gearing up a first-grader or prepping for college, a new school year is a chance for a fresh start and new adventures.",
        },
        {
          type: "highlight",
          content:
            "Stock up and save! Enjoy <strong>buy 2, get 1 free</strong> on all back-to-school essentials. From backpacks to supplies to wardrobe refreshes \u2014 we've got you covered. Sale runs through August 31st.",
        },
        {
          type: "text",
          content:
            "Our back-to-school shop is stocked with everything on the list and then some. Beat the last-minute rush and check off those supplies early this year. Your future self will thank you!",
        },
        {
          type: "button",
          content: "Shop Back to School",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Here's to a great school year ahead, {{firstName}}!",
        },
      ]),
    },
    defaultSms:
      "Back to school! \u{1F4DA} Buy 2, get 1 free on all essentials, {{firstName}}. Gear up now: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create an energetic email for back-to-school season with themes of fresh starts, new supplies, family preparation, and seasonal deals.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 13. Labor Day - 1st Monday of September
  // -------------------------------------------------------------------------
  {
    id: "labor-day",
    name: "Labor Day",
    description:
      "Close out summer in style with an end-of-season Labor Day sale campaign.",
    category: "holiday",
    icon: "\u{1F528}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Last Call for Summer, {{firstName}} \u2014 Labor Day Deals!",
      preheader:
        "End-of-summer blowout: these deals won't survive the weekend.",
      content:
        "Summer's final hurrah is here, {{firstName}}! Our Labor Day Sale is your last chance to grab amazing deals before fall arrives. Don't miss out!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Labor Day Weekend Sale! \u{1F528}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, summer may be winding down, but the savings are just heating up! Our Labor Day Weekend Sale is your last chance to snag incredible deals before we turn the page to fall.",
        },
        {
          type: "highlight",
          content:
            "End-of-summer clearance is here: save up to <strong>60% off</strong> on summer favorites. Plus, take an extra <strong>15% off</strong> clearance items with code <strong>LABORDAY</strong>. This weekend only!",
        },
        {
          type: "text",
          content:
            "Make the most of the long weekend \u2014 whether you're squeezing in one last beach day, hosting a farewell-to-summer barbecue, or just relaxing at home. And if you're shopping? These are the best prices you'll see all season.",
        },
        {
          type: "button",
          content: "Shop Labor Day Sale",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Enjoy the long weekend, {{firstName}} \u2014 you've earned it!",
        },
      ]),
    },
    defaultSms:
      "Labor Day Sale! \u{1F528} Up to 60% off + extra 15% with code LABORDAY, {{firstName}}. Last chance: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create an email marking the end of summer with Labor Day weekend sales, clearance deals, and last-chance summer promotions.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 14. Halloween - Oct 31
  // -------------------------------------------------------------------------
  {
    id: "halloween",
    name: "Halloween",
    description:
      "Get into the spooky spirit with a fun, Halloween-themed campaign featuring frightfully good deals.",
    category: "holiday",
    icon: "\u{1F383}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject:
        "Boo! Spooktacular Deals Await You, {{firstName}} \u{1F383}",
      preheader:
        "Frightfully good savings \u2014 these deals are gone at midnight!",
      content:
        "Happy Halloween {{firstName}}! We've cooked up some frighteningly good deals just for you. Don't be scared \u2014 the only thing that's terrifying is how much you'll save!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Spooktacular Deals This Halloween! \u{1F383}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, the witching hour is upon us and we've brewed up something special! Whether you're into tricks, treats, or a little bit of both \u2014 our Halloween sale has something wickedly wonderful for everyone.",
        },
        {
          type: "highlight",
          content:
            "Don't be frightened by the savings! Enjoy <strong>31% off</strong> everything today with code <strong>BOO31</strong>. Plus, score a <strong>mystery treat</strong> with every order \u2014 values up to $50!",
        },
        {
          type: "text",
          content:
            "From costume-worthy looks to spooky-season home decor, our Halloween collection is to die for. But hurry \u2014 like all good ghost stories, this sale vanishes at the stroke of midnight!",
        },
        {
          type: "button",
          content: "Shop Spooky Deals",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Have a safe and spooktacular Halloween, {{firstName}}!",
        },
      ]),
    },
    defaultSms:
      "Boo! \u{1F383} 31% off everything today with code BOO31, {{firstName}}. Plus a mystery treat! Shop: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a fun, spooky-themed email for Halloween with costumes, trick-or-treat vibes, mystery deals, and frighteningly good offers.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 15. Veterans Day - Nov 11
  // -------------------------------------------------------------------------
  {
    id: "veterans-day",
    name: "Veterans Day",
    description:
      "Honor veterans and active military with a respectful campaign featuring special recognition and exclusive deals.",
    category: "holiday",
    icon: "\u{1F396}\u{FE0F}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Thank You to Those Who Served \u2014 Veterans Day Honors",
      preheader:
        "We salute our veterans with gratitude and exclusive savings.",
      content:
        "On this Veterans Day, we honor the brave men and women who have served, {{firstName}}. As a small token of our gratitude, we're offering exclusive deals for everyone.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Honoring Our Veterans \u{1F396}\u{FE0F}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, today we pause to honor the men and women who have bravely served our country. Their courage, sacrifice, and dedication to protecting our freedoms deserve our deepest gratitude \u2014 not just today, but every day.",
        },
        {
          type: "highlight",
          content:
            "In honor of our veterans, we're offering <strong>25% off</strong> for all active military and veterans with valid ID. Everyone else enjoys <strong>15% off</strong> sitewide with code <strong>HONOR</strong>.",
        },
        {
          type: "text",
          content:
            "We are proud to support veteran-owned businesses and military families across the country. A portion of every purchase this week goes directly to veteran support organizations.",
        },
        {
          type: "button",
          content: "Shop Veterans Day Deals",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "With deepest respect and gratitude \u2014 thank you for your service.",
        },
      ]),
    },
    defaultSms:
      "Thank you, veterans \u{1F396}\u{FE0F} 25% off for military, 15% off for all with code HONOR, {{firstName}}. Shop: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a respectful, grateful email honoring Veterans Day with themes of military appreciation, service recognition, and veteran-exclusive deals.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 16. Thanksgiving - 4th Thursday of November
  // -------------------------------------------------------------------------
  {
    id: "thanksgiving",
    name: "Thanksgiving",
    description:
      "Express heartfelt gratitude to your customers with a warm Thanksgiving campaign focused on thankfulness.",
    category: "holiday",
    icon: "\u{1F983}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "We're Thankful for You, {{firstName}} \u{1F983}",
      preheader:
        "A heartfelt thank you from our family to yours this Thanksgiving.",
      content:
        "Happy Thanksgiving {{firstName}}! As we gather around the table, we want you to know how grateful we are for your support. Wishing you a day filled with warmth and joy.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content:
            "Happy Thanksgiving, {{firstName}}! \u{1F983}",
        },
        {
          type: "text",
          content:
            "As we gather with loved ones to count our blessings, we want to take a moment to express how truly thankful we are for you, {{firstName}}. Your support, loyalty, and trust mean the world to us.",
        },
        {
          type: "highlight",
          content:
            "As a small token of our gratitude, enjoy a <strong>$25 gift card</strong> on us \u2014 no minimum purchase required. Just use code <strong>THANKFUL</strong> at checkout. Valid through the weekend!",
        },
        {
          type: "text",
          content:
            "This Thanksgiving, we hope your table is full, your heart is warm, and your day is spent surrounded by the people who matter most. From our family to yours \u2014 Happy Thanksgiving!",
        },
        {
          type: "button",
          content: "Claim Your Gift",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Wishing you a Thanksgiving overflowing with warmth and gratitude.",
        },
      ]),
    },
    defaultSms:
      "Happy Thanksgiving {{firstName}}! \u{1F983} We're thankful for you. Enjoy a $25 gift card with code THANKFUL: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a warm, grateful email expressing genuine thanks to customers with Thanksgiving themes of gratitude, family, and togetherness.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 17. Black Friday - Day after Thanksgiving
  // -------------------------------------------------------------------------
  {
    id: "black-friday",
    name: "Black Friday",
    description:
      "Drive massive sales with an urgent, high-energy Black Friday campaign featuring the biggest deals of the year.",
    category: "holiday",
    icon: "\u{1F6CD}\u{FE0F}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject:
        "BLACK FRIDAY IS HERE, {{firstName}}! Our Biggest Sale of the Year",
      preheader:
        "Deals this good won't last \u2014 up to 70% off. Shop now before it's gone!",
      content:
        "It's Black Friday {{firstName}}! The moment you've been waiting for is finally here. Our biggest sale of the year features jaw-dropping deals across every category. Shop now before they're gone!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "BLACK FRIDAY IS HERE! \u{1F6CD}\u{FE0F}",
        },
        {
          type: "text",
          content:
            "{{firstName}}, this is it \u2014 our biggest, boldest, most incredible sale of the entire year! The deals you've been waiting for are finally here, and they are absolutely jaw-dropping.",
        },
        {
          type: "highlight",
          content:
            "Save up to <strong>70% off</strong> sitewide! Early access is LIVE right now. Plus, the first 100 shoppers get an additional <strong>$20 off</strong> with code <strong>BLKFRI20</strong>. Don't sleep on this!",
        },
        {
          type: "text",
          content:
            "From top-rated favorites to limited-edition exclusives, every category is loaded with unbeatable prices. But fair warning: our best deals sell out fast, and once they're gone, they're gone for good.",
        },
        {
          type: "button",
          content: "Shop Black Friday Now",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Hurry, {{firstName}} \u2014 these deals expire at midnight Friday!",
        },
      ]),
    },
    defaultSms:
      "BLACK FRIDAY! \u{1F6CD}\u{FE0F} Up to 70% off sitewide, {{firstName}}! First 100 get extra $20 off: BLKFRI20. Shop: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create an urgent, exciting email about Black Friday deals with massive discounts, limited-time offers, FOMO, and strong calls-to-action.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 18. Small Business Saturday - Saturday after Thanksgiving
  // -------------------------------------------------------------------------
  {
    id: "small-business-saturday",
    name: "Small Business Saturday",
    description:
      "Encourage customers to shop local and support small businesses with a community-focused campaign.",
    category: "holiday",
    icon: "\u{1F3EA}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Shop Small, Make a Big Impact, {{firstName}}!",
      preheader:
        "Support local businesses this Small Business Saturday \u2014 every purchase matters.",
      content:
        "Happy Small Business Saturday {{firstName}}! Today is all about supporting the local businesses that make our communities special. Shop small and make a big impact!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Shop Small, Make a Big Impact! \u{1F3EA}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, today is Small Business Saturday \u2014 a day dedicated to celebrating the small businesses that are the heart and soul of our communities. Every purchase you make with a small business helps a real person chase their dream.",
        },
        {
          type: "highlight",
          content:
            "As a small business ourselves, we're grateful for every single customer. Today, enjoy <strong>20% off</strong> your entire order with code <strong>SHOPSMALL</strong>. Plus, we'll donate <strong>$1 from every sale</strong> to our local small business fund.",
        },
        {
          type: "text",
          content:
            "When you shop small, you're not just buying a product \u2014 you're supporting a family, fueling a passion, and strengthening your community. Thank you for choosing to make a difference today.",
        },
        {
          type: "button",
          content: "Shop Small With Us",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Thank you for supporting small businesses, {{firstName}}. It means more than you know.",
        },
      ]),
    },
    defaultSms:
      "Shop Small Saturday! \u{1F3EA} 20% off with code SHOPSMALL, {{firstName}}. Support local today: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a community-focused email for Small Business Saturday with themes of shopping local, supporting entrepreneurs, and community impact.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 19. Cyber Monday - Monday after Thanksgiving
  // -------------------------------------------------------------------------
  {
    id: "cyber-monday",
    name: "Cyber Monday",
    description:
      "Maximize online sales with a tech-savvy Cyber Monday campaign featuring exclusive digital deals.",
    category: "holiday",
    icon: "\u{1F4BB}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject:
        "Cyber Monday Deals Are LIVE, {{firstName}} \u2014 Online Only!",
      preheader:
        "The biggest online deals of the year \u2014 today only. Don't miss out!",
      content:
        "Cyber Monday is here {{firstName}}! The biggest online shopping day of the year has arrived with exclusive deals you won't find anywhere else. Shop from your couch and save big!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Cyber Monday Deals Are LIVE! \u{1F4BB}",
        },
        {
          type: "text",
          content:
            "{{firstName}}, skip the crowds and shop from the comfort of your couch! Cyber Monday is here with online-exclusive deals that are too good to miss. This is your last chance to score holiday season savings.",
        },
        {
          type: "highlight",
          content:
            "Online only: up to <strong>65% off</strong> everything! Plus, use code <strong>CYBER65</strong> for an extra <strong>$15 off</strong> orders over $75. Flash deals drop every 2 hours \u2014 keep checking back!",
        },
        {
          type: "text",
          content:
            "From tech gadgets to everyday essentials, every category is packed with doorbusters and digital-only exclusives. Set your alarms, bookmark your favorites, and get ready to click \u2014 because when Cyber Monday ends at midnight, so do these prices.",
        },
        {
          type: "button",
          content: "Shop Cyber Monday Deals",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Today only, {{firstName}} \u2014 don't let these deals expire!",
        },
      ]),
    },
    defaultSms:
      "Cyber Monday! \u{1F4BB} Up to 65% off online + $15 off $75 with CYBER65, {{firstName}}. Shop now: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a tech-savvy, deal-focused email about Cyber Monday online-only discounts, flash sales, doorbusters, and digital exclusives.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 20. Hanukkah - Varies (Nov/Dec)
  // -------------------------------------------------------------------------
  {
    id: "hanukkah",
    name: "Hanukkah",
    description:
      "Celebrate the Festival of Lights with a warm Hanukkah campaign featuring eight nights of joy and special offers.",
    category: "holiday",
    icon: "\u{1F54E}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Happy Hanukkah, {{firstName}}! Eight Nights of Joy Await",
      preheader:
        "Celebrate the Festival of Lights with special offers all eight nights.",
      content:
        "Happy Hanukkah {{firstName}}! As the menorah is lit and the dreidels spin, we're celebrating with eight nights of special offers just for you. Chag Sameach!",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Happy Hanukkah! \u{1F54E}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, as families gather to light the menorah and celebrate the miracle of Hanukkah, we want to wish you and yours a joyful Festival of Lights. May each candle bring warmth, hope, and happiness into your home.",
        },
        {
          type: "highlight",
          content:
            "Celebrate with our <strong>8 Nights of Deals</strong>! A brand-new offer unlocks each night of Hanukkah. Tonight's special: <strong>18% off</strong> your entire order with code <strong>LIGHTS18</strong>. Check back each evening for a new surprise!",
        },
        {
          type: "text",
          content:
            "Whether you're searching for the perfect Hanukkah gift, stocking up on gelt and candles, or simply looking to treat yourself, our festive collection has something special waiting for you.",
        },
        {
          type: "button",
          content: "Celebrate with Us",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Chag Sameach, {{firstName}} \u2014 wishing you a bright and beautiful Hanukkah!",
        },
      ]),
    },
    defaultSms:
      "Happy Hanukkah {{firstName}}! \u{1F54E} 8 nights of deals start now. 18% off with code LIGHTS18 tonight: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a warm, festive email celebrating Hanukkah with themes of the Festival of Lights, menorah, family traditions, and eight nights of special offers.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 21. Christmas Eve - Dec 24
  // -------------------------------------------------------------------------
  {
    id: "christmas-eve",
    name: "Christmas Eve",
    description:
      "Build excitement on Christmas Eve with a last-minute campaign featuring anticipation, gift ideas, and express options.",
    category: "holiday",
    icon: "\u{1F384}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "It's Christmas Eve, {{firstName}}! Last-Minute Magic Inside",
      preheader:
        "Still need a gift? We've got you covered with instant delivery options.",
      content:
        "Merry Christmas Eve {{firstName}}! The big day is almost here. If you're still searching for the perfect last-minute gift, we have you covered with instant delivery options and e-gift cards.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Merry Christmas Eve! \u{1F384}",
        },
        {
          type: "text",
          content:
            "Hi {{firstName}}, the most magical night of the year is here! The stockings are hung, the cookies are baking, and the excitement is building. Whether you're wrapping the final presents or still searching for that one perfect gift, we're here to help.",
        },
        {
          type: "highlight",
          content:
            "Last-minute lifesaver: our <strong>e-gift cards</strong> are delivered instantly and come beautifully wrapped in a digital envelope. Plus, enjoy <strong>a bonus $10 card</strong> free when you purchase $50 or more in gift cards today!",
        },
        {
          type: "text",
          content:
            "No wrapping, no shipping stress, no last-minute panic. Just a thoughtful gift that arrives in seconds and lets them pick exactly what they love. It's the gift that never misses.",
        },
        {
          type: "button",
          content: "Send an Instant Gift Card",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Wishing you a cozy and magical Christmas Eve, {{firstName}}!",
        },
      ]),
    },
    defaultSms:
      "Merry Christmas Eve {{firstName}}! \u{1F384} Need a last-minute gift? E-gift cards delivered instantly + bonus $10: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create an anticipation-building email for Christmas Eve with last-minute gift ideas, instant delivery options, and holiday excitement.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 22. Christmas - Dec 25
  // -------------------------------------------------------------------------
  {
    id: "christmas",
    name: "Christmas",
    description:
      "Spread holiday cheer with a festive Christmas campaign celebrating joy, gratitude, and the spirit of giving.",
    category: "holiday",
    icon: "\u{1F384}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject: "Merry Christmas, {{firstName}}! Unwrap Something Special",
      preheader:
        "Our gift to you \u2014 holiday cheer and a special thank you inside.",
      content:
        "Merry Christmas {{firstName}}! Wishing you a day filled with love, laughter, and all the holiday magic. As a thank you for being part of our family, we have a special gift inside just for you.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content:
            "Merry Christmas, {{firstName}}! \u{1F384}",
        },
        {
          type: "text",
          content:
            "From the bottom of our hearts, we wish you the merriest of Christmases! Today is a day for unwrapping presents, sharing meals, and making memories with the people who matter most.",
        },
        {
          type: "highlight",
          content:
            "Our gift to you: enjoy a <strong>$20 reward</strong> on your next purchase. No minimum, no catch \u2014 just our way of saying thank you for an amazing year together. Use code <strong>MERRYGIFT</strong> anytime in the next 30 days.",
        },
        {
          type: "text",
          content:
            "Thank you for being part of our family this year, {{firstName}}. Your support has made this our best year yet, and we can't wait to continue this journey with you in the new year.",
        },
        {
          type: "button",
          content: "Claim Your Christmas Gift",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Merry Christmas and Happy Holidays from all of us to all of you!",
        },
      ]),
    },
    defaultSms:
      "Merry Christmas {{firstName}}! \u{1F384} Our gift to you: $20 off your next order with code MERRYGIFT. Enjoy: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a festive, joyful email celebrating Christmas with holiday cheer, gift-giving spirit, year-end gratitude, and seasonal warmth.",
    suggestedMergeTags: ["{{firstName}}"],
  },

  // -------------------------------------------------------------------------
  // 23. Kwanzaa - Dec 26
  // -------------------------------------------------------------------------
  {
    id: "kwanzaa",
    name: "Kwanzaa",
    description:
      "Celebrate Kwanzaa with a meaningful campaign honoring African heritage, community values, and the seven principles.",
    category: "holiday",
    icon: "\u{1F56F}\u{FE0F}",
    channels: ["email", "sms"],
    automatable: true,
    defaultEmail: {
      subject:
        "Happy Kwanzaa, {{firstName}}! Celebrating Community and Culture",
      preheader:
        "Honor the seven principles with us \u2014 unity, purpose, and celebration.",
      content:
        "Habari Gani, {{firstName}}! As Kwanzaa begins, we celebrate the richness of African heritage, the strength of community, and the seven principles that inspire us all.",
      htmlContent: buildEmailHtml([
        {
          type: "heading",
          content: "Happy Kwanzaa! \u{1F56F}\u{FE0F}",
        },
        {
          type: "text",
          content:
            "Habari Gani, {{firstName}}! As the Kinara is lit and families gather to celebrate, we honor the rich traditions of Kwanzaa and the seven principles \u2014 Umoja (Unity), Kujichagulia (Self-Determination), Ujima (Collective Work), Ujamaa (Cooperative Economics), Nia (Purpose), Kuumba (Creativity), and Imani (Faith).",
        },
        {
          type: "highlight",
          content:
            "Celebrate the spirit of Ujamaa (Cooperative Economics) with us: enjoy <strong>20% off</strong> during our Kwanzaa celebration with code <strong>KWANZAA7</strong>. A portion of every sale supports Black-owned businesses and cultural organizations.",
        },
        {
          type: "text",
          content:
            "Kwanzaa is a time to reflect on our shared values, uplift our communities, and celebrate the creativity and resilience that define us. We are honored to be part of your celebration.",
        },
        {
          type: "button",
          content: "Celebrate with Us",
          href: "#",
        },
        { type: "divider", content: "" },
        {
          type: "text",
          content:
            "Wishing you a beautiful and meaningful Kwanzaa, {{firstName}}. Harambee!",
        },
      ]),
    },
    defaultSms:
      "Happy Kwanzaa {{firstName}}! \u{1F56F}\u{FE0F} 20% off with code KWANZAA7. Supporting community together: [link]. Reply STOP to opt out.",
    aiPromptHint:
      "Create a meaningful, culturally respectful email celebrating Kwanzaa with themes of the seven principles, African heritage, community, and cooperative economics.",
    suggestedMergeTags: ["{{firstName}}"],
  },
];
