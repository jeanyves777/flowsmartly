import { TemplateVariant, PAGE_TYPE_TEMPLATES } from "./templates";

function isDark(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
}

function hexToRgb(hex: string): string {
  const c = hex.replace("#", "");
  return `${parseInt(c.substring(0, 2), 16)},${parseInt(c.substring(2, 4), 16)},${parseInt(c.substring(4, 6), 16)}`;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function footerHtml(v: TemplateVariant): string {
  return `<footer style="background:#111827;padding:40px 5%;text-align:center;">
    <div style="max-width:1100px;margin:0 auto;">
      <div style="display:flex;justify-content:center;gap:24px;margin-bottom:20px;">
        ${["About", "Features", "Pricing", "Blog", "Contact"].map(l =>
          `<a href="#" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px;">${l}</a>`
        ).join("")}
      </div>
      <p style="font-size:13px;color:rgba(255,255,255,0.35);margin:0;">&copy; 2025 Brand Name. All rights reserved. &middot; Built with FlowSmartly</p>
    </div>
  </footer>`;
}

function videoPlaceholder(v: TemplateVariant, label: string): string {
  const rgb = hexToRgb(v.colorScheme.primary);
  return `<div style="position:relative;width:100%;max-width:1100px;margin:0 auto;aspect-ratio:16/9;background:#0a0a0a;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
    <div style="width:80px;height:80px;border-radius:50%;background:rgba(${rgb},0.9);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 32px rgba(${rgb},0.4);">
      <div style="width:0;height:0;border-style:solid;border-width:14px 0 14px 24px;border-color:transparent transparent transparent #ffffff;margin-left:4px;"></div>
    </div>
    <span style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.5);font-size:13px;">${label}</span>
  </div>`;
}

function ctaBanner(v: TemplateVariant, headline: string, buttonText: string): string {
  return `<section style="background:linear-gradient(135deg,${v.colorScheme.primary},${v.colorScheme.secondary});padding:80px 5%;text-align:center;">
    <div style="max-width:600px;margin:0 auto;">
      <h2 style="font-size:clamp(24px,3.5vw,40px);font-weight:800;color:#ffffff;margin:0 0 16px;">${headline}</h2>
      <p style="font-size:17px;color:rgba(255,255,255,0.85);margin:0 0 32px;">Join thousands of happy customers. No credit card required.</p>
      <a href="#" style="display:inline-block;padding:16px 40px;background:#ffffff;color:${v.colorScheme.primary};border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 4px 14px rgba(0,0,0,0.15);">${buttonText}</a>
    </div>
  </section>`;
}

function logoBar(v: TemplateVariant): string {
  const dark = isDark(v.colorScheme.bg);
  const textColor = dark ? "rgba(255,255,255,0.4)" : "#9ca3af";
  return `<section style="background:${v.colorScheme.bg};padding:40px 5%;border-top:1px solid ${dark ? "rgba(255,255,255,0.06)" : "#f3f4f6"};border-bottom:1px solid ${dark ? "rgba(255,255,255,0.06)" : "#f3f4f6"};">
    <div style="max-width:900px;margin:0 auto;text-align:center;">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:${textColor};margin:0 0 20px;">Trusted by 10,000+ companies</p>
      <div style="display:flex;justify-content:center;gap:40px;flex-wrap:wrap;">
        ${["Acme Corp", "Globex", "Initech", "Umbrella", "Waystar"].map(n =>
          `<span style="font-size:17px;font-weight:700;color:${textColor};letter-spacing:1px;">${n}</span>`
        ).join("")}
      </div>
    </div>
  </section>`;
}

function featureGrid(v: TemplateVariant, count: 3 | 6 = 6): string {
  const dark = isDark(v.colorScheme.bg);
  const bg = dark ? v.colorScheme.bg : "#f9fafb";
  const cardBg = dark ? "rgba(255,255,255,0.06)" : "#ffffff";
  const textColor = dark ? "#ffffff" : "#111827";
  const mutedColor = dark ? "rgba(255,255,255,0.65)" : "#6b7280";
  const borderColor = dark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  const features = [
    { icon: "&#9889;", title: "Lightning Fast", desc: "Optimized for speed with response times under 100ms." },
    { icon: "&#128274;", title: "Enterprise Security", desc: "Bank-grade encryption and SOC 2 compliance built-in." },
    { icon: "&#128200;", title: "Smart Analytics", desc: "Real-time insights and dashboards to track everything." },
    { icon: "&#9881;", title: "Easy Integration", desc: "Connect with 200+ tools via our open API and webhooks." },
    { icon: "&#128101;", title: "Team Collaboration", desc: "Work together in real-time with shared workspaces." },
    { icon: "&#127775;", title: "AI-Powered", desc: "Intelligent automation that learns and adapts to you." },
  ].slice(0, count);

  return `<section style="background:${bg};padding:80px 5%;">
    <div style="max-width:1100px;margin:0 auto;text-align:center;">
      <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;margin:0 0 12px;color:${textColor};">Everything You Need</h2>
      <p style="font-size:16px;color:${mutedColor};margin:0 0 48px;">Powerful features to help you succeed.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;">
        ${features.map(f => `
          <div style="background:${cardBg};border:1px solid ${borderColor};border-radius:12px;padding:28px;text-align:left;">
            <div style="width:44px;height:44px;border-radius:10px;background:rgba(${hexToRgb(v.colorScheme.primary)},0.12);display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px;">${f.icon}</div>
            <h3 style="font-size:17px;font-weight:700;margin:0 0 8px;color:${textColor};">${f.title}</h3>
            <p style="font-size:14px;line-height:1.6;margin:0;color:${mutedColor};">${f.desc}</p>
          </div>`).join("")}
      </div>
    </div>
  </section>`;
}

function testimonials(v: TemplateVariant): string {
  const dark = isDark(v.colorScheme.bg);
  const bg = dark ? v.colorScheme.bg : "#ffffff";
  const cardBg = dark ? "rgba(255,255,255,0.05)" : "#f9fafb";
  const textColor = dark ? "#ffffff" : "#111827";
  const mutedColor = dark ? "rgba(255,255,255,0.6)" : "#6b7280";
  const borderColor = dark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const items = [
    { name: "Sarah J.", role: "CEO, TechStart", text: "This completely transformed how our team works. 40% more productive in month one." },
    { name: "Michael C.", role: "Product Lead, ScaleUp", text: "The best investment we've made. Outstanding support and incredible features." },
    { name: "Emily R.", role: "Founder, Bloom", text: "I've tried dozens of tools. This is the only one that actually delivered." },
  ];
  return `<section style="background:${bg};padding:80px 5%;">
    <div style="max-width:1100px;margin:0 auto;text-align:center;">
      <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;margin:0 0 48px;color:${textColor};">What Our Customers Say</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;text-align:left;">
        ${items.map(t => `
          <div style="background:${cardBg};border:1px solid ${borderColor};border-radius:12px;padding:28px;">
            <div style="margin-bottom:16px;color:${v.colorScheme.primary};">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
            <p style="font-size:15px;line-height:1.7;color:${textColor};margin:0 0 20px;">"${t.text}"</p>
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:40px;height:40px;border-radius:50%;background:rgba(${hexToRgb(v.colorScheme.primary)},0.15);display:flex;align-items:center;justify-content:center;font-weight:700;color:${v.colorScheme.primary};">${t.name[0]}</div>
              <div>
                <p style="font-size:14px;font-weight:600;margin:0;color:${textColor};">${t.name}</p>
                <p style="font-size:12px;margin:0;color:${mutedColor};">${t.role}</p>
              </div>
            </div>
          </div>`).join("")}
      </div>
    </div>
  </section>`;
}

function pricingTable(v: TemplateVariant): string {
  const dark = isDark(v.colorScheme.bg);
  const bg = dark ? v.colorScheme.bg : "#f9fafb";
  const cardBg = dark ? "rgba(255,255,255,0.05)" : "#ffffff";
  const textColor = dark ? "#ffffff" : "#111827";
  const borderColor = dark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const rgb = hexToRgb(v.colorScheme.primary);
  const plans = [
    { name: "Starter", price: "$9", features: ["5 Projects", "Basic Analytics", "Email Support"] },
    { name: "Pro", price: "$29", features: ["Unlimited Projects", "Advanced Analytics", "Priority Support", "API Access"], popular: true },
    { name: "Enterprise", price: "$99", features: ["Everything in Pro", "Custom Integrations", "Dedicated Manager", "SLA Guarantee"] },
  ];
  return `<section style="background:${bg};padding:80px 5%;">
    <div style="max-width:1100px;margin:0 auto;text-align:center;">
      <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;margin:0 0 48px;color:${textColor};">Simple Pricing</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;">
        ${plans.map(p => `
          <div style="background:${p.popular ? v.colorScheme.primary : cardBg};color:${p.popular ? "#fff" : textColor};border:${p.popular ? "none" : `1px solid ${borderColor}`};border-radius:16px;padding:32px;${p.popular ? `box-shadow:0 8px 32px rgba(${rgb},0.25);transform:scale(1.03);` : ""}">
            ${p.popular ? `<span style="display:inline-block;background:rgba(255,255,255,0.2);font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:16px;text-transform:uppercase;">Most Popular</span>` : ""}
            <h3 style="font-size:20px;font-weight:700;margin:0 0 16px;">${p.name}</h3>
            <div style="font-size:42px;font-weight:800;margin:0 0 24px;">${p.price}<span style="font-size:16px;font-weight:400;opacity:0.7;">/mo</span></div>
            <ul style="list-style:none;padding:0;margin:0 0 24px;text-align:left;">
              ${p.features.map(f => `<li style="padding:6px 0;font-size:14px;"><span style="color:${p.popular ? "#fff" : v.colorScheme.primary};margin-right:8px;">&#10003;</span>${f}</li>`).join("")}
            </ul>
            <a href="#" style="display:block;text-align:center;padding:12px;border-radius:8px;text-decoration:none;font-weight:600;${p.popular ? `background:#fff;color:${v.colorScheme.primary};` : `background:${v.colorScheme.primary};color:#fff;`}">Get Started</a>
          </div>`).join("")}
      </div>
    </div>
  </section>`;
}

function formSection(v: TemplateVariant): string {
  const dark = isDark(v.colorScheme.bg);
  const bg = dark ? v.colorScheme.bg : "#ffffff";
  const cardBg = dark ? "rgba(255,255,255,0.06)" : "#f9fafb";
  const textColor = dark ? "#ffffff" : "#111827";
  const inputBg = dark ? "rgba(255,255,255,0.08)" : "#ffffff";
  const inputBorder = dark ? "rgba(255,255,255,0.15)" : "#d1d5db";
  return `<section style="background:${bg};padding:80px 5%;">
    <div style="max-width:480px;margin:0 auto;">
      <div style="background:${cardBg};border-radius:16px;padding:36px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <h2 style="font-size:22px;font-weight:800;margin:0 0 24px;text-align:center;color:${textColor};">Get Started</h2>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <input placeholder="First Name" style="padding:12px;border:1px solid ${inputBorder};border-radius:8px;font-size:14px;background:${inputBg};color:${textColor};" />
            <input placeholder="Last Name" style="padding:12px;border:1px solid ${inputBorder};border-radius:8px;font-size:14px;background:${inputBg};color:${textColor};" />
          </div>
          <input placeholder="Email Address" style="padding:12px;border:1px solid ${inputBorder};border-radius:8px;font-size:14px;background:${inputBg};color:${textColor};" />
          <button style="padding:14px;background:${v.colorScheme.primary};color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Submit</button>
        </div>
      </div>
    </div>
  </section>`;
}

function statsBar(v: TemplateVariant): string {
  const stats = [{ n: "10K+", l: "Active Users" }, { n: "99.9%", l: "Uptime" }, { n: "4.9/5", l: "Rating" }, { n: "24/7", l: "Support" }];
  return `<section style="background:${v.colorScheme.primary};padding:48px 5%;">
    <div style="max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;text-align:center;">
      ${stats.map(s => `<div><div style="font-size:clamp(28px,3vw,42px);font-weight:800;color:#fff;">${s.n}</div><div style="font-size:14px;color:rgba(255,255,255,0.75);margin-top:4px;">${s.l}</div></div>`).join("")}
    </div>
  </section>`;
}

function scheduleTimeline(v: TemplateVariant): string {
  const dark = isDark(v.colorScheme.bg);
  const textColor = dark ? "#ffffff" : "#111827";
  const mutedColor = dark ? "rgba(255,255,255,0.6)" : "#6b7280";
  const items = [
    { time: "9:00 AM", title: "Opening Keynote" }, { time: "10:30 AM", title: "Panel Discussion" },
    { time: "12:00 PM", title: "Networking Lunch" }, { time: "2:00 PM", title: "Workshop Sessions" },
    { time: "4:30 PM", title: "Closing & Awards" },
  ];
  return `<section style="background:${v.colorScheme.bg};padding:80px 5%;">
    <div style="max-width:700px;margin:0 auto;">
      <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;margin:0 0 48px;text-align:center;color:${textColor};">Schedule</h2>
      <div style="padding-left:32px;position:relative;">
        <div style="position:absolute;left:8px;top:0;bottom:0;width:2px;background:${dark ? "rgba(255,255,255,0.1)" : "#e5e7eb"};"></div>
        ${items.map(it => `<div style="position:relative;margin-bottom:32px;"><div style="position:absolute;left:-28px;top:4px;width:12px;height:12px;border-radius:50%;background:${v.colorScheme.primary};"></div><span style="font-size:12px;font-weight:600;color:${v.colorScheme.primary};text-transform:uppercase;letter-spacing:1px;">${it.time}</span><h3 style="font-size:17px;font-weight:700;margin:4px 0 0;color:${textColor};">${it.title}</h3></div>`).join("")}
      </div>
    </div>
  </section>`;
}

function menuSection(v: TemplateVariant): string {
  const dark = isDark(v.colorScheme.bg);
  const textColor = dark ? "#ffffff" : "#111827";
  const dividerColor = dark ? "rgba(255,255,255,0.1)" : "#e5e7eb";
  const categories = [
    { name: "Starters", items: [["Bruschetta", "$12"], ["Caesar Salad", "$14"], ["Soup of the Day", "$10"]] },
    { name: "Main Course", items: [["Grilled Salmon", "$28"], ["Filet Mignon", "$36"], ["Pasta Primavera", "$22"]] },
    { name: "Desserts", items: [["Tiramisu", "$11"], ["Crème Brûlée", "$12"]] },
  ];
  return `<section style="background:${v.colorScheme.bg};padding:80px 5%;">
    <div style="max-width:700px;margin:0 auto;">
      <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;margin:0 0 48px;text-align:center;color:${v.colorScheme.primary};">Our Menu</h2>
      ${categories.map(cat => `<div style="margin-bottom:36px;"><h3 style="font-size:20px;font-weight:700;color:${textColor};margin:0 0 16px;border-bottom:2px solid ${v.colorScheme.primary};padding-bottom:8px;">${cat.name}</h3>${cat.items.map(([n, p]) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid ${dividerColor};"><span style="color:${textColor};">${n}</span><span style="font-weight:600;color:${v.colorScheme.primary};">${p}</span></div>`).join("")}</div>`).join("")}
    </div>
  </section>`;
}

function galleryGrid(v: TemplateVariant): string {
  const dark = isDark(v.colorScheme.bg);
  const placeholderBg = dark ? "rgba(255,255,255,0.06)" : "#f3f4f6";
  const textColor = dark ? "#ffffff" : "#111827";
  return `<section style="background:${v.colorScheme.bg};padding:80px 5%;">
    <div style="max-width:1100px;margin:0 auto;text-align:center;">
      <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;margin:0 0 40px;color:${textColor};">Our Work</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
        ${[1,2,3,4,5,6].map(() => `<div style="background:${placeholderBg};border-radius:12px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;"><span style="font-size:32px;opacity:0.2;">&#128247;</span></div>`).join("")}
      </div>
    </div>
  </section>`;
}

function countdownBoxes(v: TemplateVariant): string {
  const dark = isDark(v.colorScheme.bg);
  const mutedColor = dark ? "rgba(255,255,255,0.5)" : "#6b7280";
  const boxBg = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
  const rgb = hexToRgb(v.colorScheme.primary);
  return `<section style="background:${v.colorScheme.bg};padding:60px 5%;text-align:center;">
    <div style="display:flex;justify-content:center;gap:16px;">
      ${[["42", "Days"], ["08", "Hours"], ["35", "Min"], ["12", "Sec"]].map(([n, l]) => `
        <div style="background:${boxBg};border:1px solid rgba(${rgb},0.25);border-radius:12px;padding:20px 24px;min-width:80px;">
          <div style="font-size:36px;font-weight:800;color:${v.colorScheme.primary};">${n}</div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${mutedColor};margin-top:4px;">${l}</div>
        </div>`).join("")}
    </div>
  </section>`;
}

function emailSignup(v: TemplateVariant): string {
  const dark = isDark(v.colorScheme.bg);
  const textColor = dark ? "#ffffff" : "#111827";
  const inputBg = dark ? "rgba(255,255,255,0.08)" : "#ffffff";
  const inputBorder = dark ? "rgba(255,255,255,0.15)" : "#d1d5db";
  return `<section style="background:${v.colorScheme.bg};padding:60px 5%;text-align:center;">
    <div style="max-width:480px;margin:0 auto;">
      <p style="font-size:16px;color:${textColor};margin:0 0 20px;opacity:0.8;">Be the first to know when we launch.</p>
      <div style="display:flex;gap:8px;">
        <input type="email" placeholder="Enter your email" style="flex:1;padding:14px 16px;border:1px solid ${inputBorder};border-radius:8px;font-size:15px;background:${inputBg};color:${textColor};" />
        <button style="padding:14px 24px;background:${v.colorScheme.primary};color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;white-space:nowrap;">Notify Me</button>
      </div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Layout-specific page builders
// ---------------------------------------------------------------------------

function buildStandardPage(v: TemplateVariant, pageType: string): string {
  const dark = isDark(v.colorScheme.bg);
  const textColor = dark ? "#ffffff" : "#111827";
  const rgb = hexToRgb(v.colorScheme.primary);

  // Hero
  let html = `<section style="background:${v.colorScheme.bg};padding:100px 5%;min-height:520px;display:flex;align-items:center;">
    <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;width:100%;">
      <div>
        <h1 style="font-size:clamp(32px,4vw,52px);font-weight:800;line-height:1.1;margin:0 0 20px;color:${textColor};">Build Something Amazing Today</h1>
        <p style="font-size:18px;line-height:1.6;margin:0 0 32px;color:${dark ? "rgba(255,255,255,0.7)" : "#6b7280"};">Streamline your workflow with AI-powered tools trusted by 10,000+ teams worldwide.</p>
        <div style="display:flex;gap:12px;">
          <a href="#" style="padding:14px 32px;background:${v.colorScheme.primary};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;box-shadow:0 4px 14px rgba(${rgb},0.3);">Get Started Free</a>
          <a href="#" style="padding:14px 32px;background:transparent;color:${textColor};border:2px solid ${dark ? "rgba(255,255,255,0.2)" : "#e5e7eb"};border-radius:8px;text-decoration:none;font-weight:600;">Learn More</a>
        </div>
      </div>
      <div style="background:rgba(${rgb},0.1);border-radius:16px;height:340px;display:flex;align-items:center;justify-content:center;"><span style="font-size:48px;opacity:0.2;">&#9634;</span></div>
    </div>
  </section>`;

  html += logoBar(v);
  html += featureGrid(v);

  if (["product", "saas"].includes(pageType)) {
    html += statsBar(v);
    html += pricingTable(v);
  }
  if (pageType === "event") {
    html += scheduleTimeline(v);
    html += formSection(v);
  }
  if (pageType === "restaurant") {
    html += menuSection(v);
    html += galleryGrid(v);
  }
  if (pageType === "agency" || pageType === "portfolio") {
    html += galleryGrid(v);
  }
  if (["lead-capture"].includes(pageType)) {
    html += formSection(v);
  }

  html += testimonials(v);
  html += ctaBanner(v, "Ready to Get Started?", "Start Free");
  return html;
}

function buildVideoPage(v: TemplateVariant, pageType: string): string {
  const dark = isDark(v.colorScheme.bg);
  const textColor = dark ? "#ffffff" : "#111827";
  const mutedColor = dark ? "rgba(255,255,255,0.65)" : "#6b7280";
  const bg = v.colorScheme.bg;

  const titles: Record<string, [string, string, string]> = {
    product: ["See Our Product in Action", "The all-in-one platform that helps you work smarter, not harder.", "Get Started Free"],
    "lead-capture": ["See How It Works", "Watch our 2-minute explainer and join 5,000+ who already signed up.", "Join the Waitlist"],
    event: ["Watch the Event Promo", "March 15-17, 2025 — San Francisco Convention Center", "Register Now"],
    "coming-soon": ["A Sneak Peek at What's Coming", "We're building something extraordinary. Be the first to know.", "Notify Me"],
    portfolio: ["My Showreel", "A collection of my best work over the past 5 years.", "Get in Touch"],
    restaurant: ["Experience Our Restaurant", "Fresh ingredients, bold flavors, an atmosphere you'll never forget.", "Reserve a Table"],
    saas: ["See It In Action", "Watch a 3-minute demo of how our platform transforms your workflow.", "Start Free Trial"],
    agency: ["Our Work Speaks for Itself", "Watch our showreel featuring projects for leading brands.", "Start a Project"],
  };
  const [title, subtitle, cta] = titles[pageType] || ["Watch the Video", "See what makes us different.", "Get Started"];

  // Video hero
  let html = `<section style="background:${bg};padding:60px 5% 40px;text-align:center;">
    <div style="max-width:900px;margin:0 auto;">
      <h1 style="font-size:clamp(28px,4vw,44px);font-weight:800;color:${textColor};margin:0 0 16px;">${title}</h1>
      <p style="font-size:17px;color:${mutedColor};margin:0 0 36px;">${subtitle}</p>
    </div>
    <div style="padding:0 5%;">
      ${videoPlaceholder(v, "Click to play video")}
    </div>
  </section>`;

  // Description + CTA below video
  html += `<section style="background:${bg};padding:40px 5% 60px;text-align:center;">
    <div style="max-width:600px;margin:0 auto;">
      <a href="#" style="display:inline-block;padding:16px 40px;background:${v.colorScheme.primary};color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:17px;box-shadow:0 4px 14px rgba(${hexToRgb(v.colorScheme.primary)},0.3);">${cta}</a>
      <p style="font-size:13px;color:${mutedColor};margin:16px 0 0;">No credit card required</p>
    </div>
  </section>`;

  // Conditionally add a light section below
  if (pageType === "lead-capture") {
    html += formSection(v);
  } else if (pageType === "saas" || pageType === "product") {
    html += featureGrid(v, 3);
  } else if (pageType === "event") {
    html += countdownBoxes(v);
  }

  html += logoBar(v);
  return html;
}

function buildMinimalPage(v: TemplateVariant, pageType: string): string {
  const dark = isDark(v.colorScheme.bg);
  const textColor = dark ? "#ffffff" : "#111827";
  const mutedColor = dark ? "rgba(255,255,255,0.6)" : "#6b7280";
  const rgb = hexToRgb(v.colorScheme.primary);

  const titles: Record<string, [string, string]> = {
    product: ["The Future of Work", "One tool to rule them all."],
    "lead-capture": ["Get Exclusive Growth Tips", "Join 5,000+ subscribers."],
    event: ["Innovation Summit 2025", "March 15 — San Francisco"],
    "coming-soon": ["Something Big is Coming", "We'll let you know when it's ready."],
    portfolio: ["Alex Morgan — Designer", "Building digital products that matter."],
    restaurant: ["La Maison", "Fine dining in the heart of the city."],
    saas: ["Ship Faster", "The developer platform that scales."],
    agency: ["We Create Impact", "Strategy. Design. Results."],
  };
  const [title, subtitle] = titles[pageType] || ["Welcome", "Discover what we do."];

  // Centered minimal hero
  let html = `<section style="background:${v.colorScheme.bg};min-height:60vh;display:flex;align-items:center;justify-content:center;padding:80px 5%;text-align:center;">
    <div style="max-width:600px;">
      <h1 style="font-size:clamp(36px,5vw,64px);font-weight:800;line-height:1.1;margin:0 0 16px;color:${textColor};">${title}</h1>
      <p style="font-size:18px;color:${mutedColor};margin:0 0 36px;">${subtitle}</p>`;

  if (pageType === "lead-capture") {
    // Inline email form
    html += `<div style="display:flex;gap:8px;max-width:420px;margin:0 auto;">
        <input type="email" placeholder="Enter your email" style="flex:1;padding:14px 16px;border:1px solid ${dark ? "rgba(255,255,255,0.15)" : "#d1d5db"};border-radius:8px;font-size:15px;background:${dark ? "rgba(255,255,255,0.08)" : "#fff"};color:${textColor};" />
        <button style="padding:14px 24px;background:${v.colorScheme.primary};color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Join</button>
      </div>
      <p style="font-size:13px;color:${mutedColor};margin:12px 0 0;">Join 5,000+ others. No spam.</p>`;
  } else {
    html += `<a href="#" style="display:inline-block;padding:16px 40px;background:${v.colorScheme.primary};color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 4px 14px rgba(${rgb},0.3);">Get Started</a>`;
  }

  html += `</div></section>`;

  // Only add 3 features below for non lead-capture
  if (pageType !== "lead-capture") {
    html += featureGrid(v, 3);
  } else {
    html += logoBar(v);
  }

  if (pageType === "event") {
    html += formSection(v);
  }

  html += ctaBanner(v, "Ready?", "Let's Go");
  return html;
}

function buildSplitPage(v: TemplateVariant, pageType: string): string {
  const dark = isDark(v.colorScheme.bg);
  const textColor = dark ? "#ffffff" : "#111827";
  const mutedColor = dark ? "rgba(255,255,255,0.65)" : "#6b7280";
  const rgb = hexToRgb(v.colorScheme.primary);

  // Split hero with form or image on right
  const hasForm = ["lead-capture"].includes(pageType);

  let rightSide: string;
  if (hasForm) {
    const inputBg = dark ? "rgba(255,255,255,0.08)" : "#fff";
    const inputBorder = dark ? "rgba(255,255,255,0.15)" : "#d1d5db";
    rightSide = `<div style="background:${dark ? "rgba(255,255,255,0.06)" : "#f9fafb"};border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      <h3 style="font-size:20px;font-weight:700;margin:0 0 20px;color:${textColor};">Get Started</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <input placeholder="Full Name" style="padding:12px;border:1px solid ${inputBorder};border-radius:8px;background:${inputBg};color:${textColor};" />
        <input placeholder="Email" style="padding:12px;border:1px solid ${inputBorder};border-radius:8px;background:${inputBg};color:${textColor};" />
        <button style="padding:14px;background:${v.colorScheme.primary};color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Submit</button>
      </div>
    </div>`;
  } else {
    rightSide = `<div style="background:rgba(${rgb},0.1);border-radius:16px;height:360px;display:flex;align-items:center;justify-content:center;"><span style="font-size:48px;opacity:0.2;">&#9634;</span></div>`;
  }

  let html = `<section style="background:${v.colorScheme.bg};padding:80px 5%;min-height:520px;display:flex;align-items:center;">
    <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;width:100%;">
      <div>
        <h1 style="font-size:clamp(28px,4vw,48px);font-weight:800;line-height:1.1;margin:0 0 20px;color:${textColor};">Grow Your Business With Us</h1>
        <p style="font-size:17px;line-height:1.6;margin:0 0 24px;color:${mutedColor};">We help businesses achieve measurable results through data-driven strategies.</p>
        <ul style="list-style:none;padding:0;margin:0 0 32px;">
          ${["Increase conversions by 200%", "Data-driven insights", "24/7 dedicated support", "Results guaranteed"].map(b => `<li style="padding:6px 0;font-size:15px;color:${textColor};"><span style="color:${v.colorScheme.primary};margin-right:8px;">&#10003;</span>${b}</li>`).join("")}
        </ul>
        ${!hasForm ? `<a href="#" style="padding:14px 32px;background:${v.colorScheme.primary};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;box-shadow:0 4px 14px rgba(${rgb},0.3);">Get a Quote</a>` : ""}
      </div>
      ${rightSide}
    </div>
  </section>`;

  html += statsBar(v);

  if (["agency", "portfolio"].includes(pageType)) {
    // Case study cards
    const cardBg = dark ? "rgba(255,255,255,0.05)" : "#f9fafb";
    const borderColor = dark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
    const cases = [
      { client: "TechStart Inc.", metric1: "+340% Traffic", metric2: "3x ROI", desc: "Complete brand redesign and marketing strategy." },
      { client: "GreenScale Co.", metric1: "$2M Revenue", metric2: "5x ROAS", desc: "E-commerce platform build and ad campaign." },
      { client: "HealthPlus App", metric1: "500K Users", metric2: "4.9 Rating", desc: "Mobile app design, development, and launch." },
    ];
    html += `<section style="background:${v.colorScheme.bg};padding:80px 5%;">
      <div style="max-width:1100px;margin:0 auto;">
        <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;margin:0 0 48px;text-align:center;color:${textColor};">Case Studies</h2>
        <div style="display:flex;flex-direction:column;gap:24px;">
          ${cases.map(c => `<div style="background:${cardBg};border:1px solid ${borderColor};border-radius:16px;padding:32px;display:grid;grid-template-columns:1fr 2fr;gap:32px;align-items:center;">
            <div style="background:rgba(${rgb},0.08);border-radius:12px;height:160px;display:flex;align-items:center;justify-content:center;"><span style="font-size:32px;opacity:0.2;">&#128247;</span></div>
            <div>
              <h3 style="font-size:18px;font-weight:700;margin:0 0 8px;color:${textColor};">${c.client}</h3>
              <p style="font-size:14px;color:${mutedColor};margin:0 0 16px;">${c.desc}</p>
              <div style="display:flex;gap:16px;">
                <span style="background:rgba(${rgb},0.1);color:${v.colorScheme.primary};padding:6px 14px;border-radius:20px;font-size:14px;font-weight:700;">${c.metric1}</span>
                <span style="background:rgba(${rgb},0.1);color:${v.colorScheme.primary};padding:6px 14px;border-radius:20px;font-size:14px;font-weight:700;">${c.metric2}</span>
              </div>
            </div>
          </div>`).join("")}
        </div>
      </div>
    </section>`;
  } else if (pageType === "saas") {
    html += featureGrid(v);
  } else {
    html += featureGrid(v);
  }

  html += logoBar(v);
  html += testimonials(v);
  html += ctaBanner(v, "Let's Work Together", "Get Started");
  return html;
}

function buildDarkPage(v: TemplateVariant, pageType: string): string {
  // Force dark colors for the preview
  const textColor = "#ffffff";
  const mutedColor = "rgba(255,255,255,0.6)";
  const bg = "#0a0a0a";
  const rgb = hexToRgb(v.colorScheme.primary);

  let html = `<section style="background:${bg};min-height:60vh;display:flex;align-items:center;justify-content:center;padding:80px 5%;text-align:center;">
    <div style="max-width:700px;">
      <h1 style="font-size:clamp(36px,5vw,60px);font-weight:800;line-height:1.1;margin:0 0 16px;color:${textColor};text-shadow:0 0 40px rgba(${rgb},0.3);">Something Amazing is Coming</h1>
      <p style="font-size:18px;color:${mutedColor};margin:0 0 40px;">Stay tuned. We're crafting something extraordinary.</p>
    </div>
  </section>`;

  if (pageType === "coming-soon") {
    html += `<section style="background:${bg};padding:0 5% 40px;text-align:center;">` + countdownBoxes(v).replace(/<section[^>]*>/g, '').replace(/<\/section>/g, '') + `</section>`;
    html += `<section style="background:${bg};padding:40px 5% 80px;text-align:center;">` + emailSignup(v).replace(/<section[^>]*>/g, '').replace(/<\/section>/g, '') + `</section>`;
  } else if (pageType === "restaurant") {
    // Use dark variant colors
    const darkV = { ...v, colorScheme: { ...v.colorScheme, bg } };
    html += menuSection(darkV);
    html += galleryGrid(darkV);
    html += formSection(darkV);
  } else {
    html += featureGrid({ ...v, colorScheme: { ...v.colorScheme, bg } });
    html += ctaBanner(v, "Get Started", "Join Now");
  }

  return html;
}

// ---------------------------------------------------------------------------
// Interactive page builder — canvas particles, SVG, mouse tracking, scroll reveals
// ---------------------------------------------------------------------------

function buildInteractivePage(v: TemplateVariant, pageType: string): string {
  const rgb = hexToRgb(v.colorScheme.primary);
  const rgb2 = hexToRgb(v.colorScheme.secondary);

  const titles: Record<string, [string, string, string]> = {
    product: ["Build Something<br/>Extraordinary", "The AI-powered platform that transforms how you work.", "Get Started Free"],
    saas: ["Ship Faster.<br/>Scale Smarter.", "The developer platform trusted by 10,000+ teams worldwide.", "Start Free Trial"],
    agency: ["We Create<br/>Digital Experiences", "Strategy. Design. Code. Results.", "Start a Project"],
    portfolio: ["Alex Morgan<br/>Creative Developer", "Building interactive experiences that push boundaries.", "Let\u2019s Talk"],
    "lead-capture": ["Unlock Your<br/>Growth Potential", "Join 10,000+ businesses already scaling with us.", "Get Early Access"],
    event: ["Innovation<br/>Summit 2025", "March 15-17 \u2014 San Francisco. The future starts here.", "Register Now"],
    "coming-soon": ["Something Big<br/>Is Coming", "We\u2019re crafting something extraordinary. Be the first to know.", "Notify Me"],
    restaurant: ["A Culinary<br/>Experience", "Fresh ingredients. Bold flavors. Unforgettable moments.", "Reserve a Table"],
  };
  const [headline, subtitle, ctaLabel] = titles[pageType] || ["Welcome", "Discover what we do.", "Get Started"];

  // Features per page type
  const featureItems: Record<string, { icon: string; title: string; desc: string }[]> = {
    product: [
      { icon: "&#9889;", title: "Lightning Fast", desc: "Response times under 100ms with edge deployment." },
      { icon: "&#128274;", title: "Enterprise Security", desc: "SOC 2 certified with end-to-end encryption." },
      { icon: "&#128200;", title: "Smart Analytics", desc: "Real-time dashboards and AI-powered insights." },
      { icon: "&#9881;", title: "200+ Integrations", desc: "Connect with every tool in your stack." },
    ],
    saas: [
      { icon: "&#128640;", title: "Instant Deploy", desc: "Ship to production in under 60 seconds." },
      { icon: "&#128300;", title: "Auto Scaling", desc: "Handles 10x traffic spikes without config." },
      { icon: "&#128202;", title: "Real-time Metrics", desc: "Monitor everything with live dashboards." },
      { icon: "&#128101;", title: "Team Workspaces", desc: "Collaborate in real-time with your team." },
    ],
    agency: [
      { icon: "&#127912;", title: "Brand Strategy", desc: "Data-driven brand positioning and identity." },
      { icon: "&#128187;", title: "Web Development", desc: "Custom web apps with cutting-edge tech." },
      { icon: "&#128241;", title: "Mobile Apps", desc: "Native and cross-platform mobile solutions." },
      { icon: "&#128200;", title: "Growth Marketing", desc: "Performance marketing that scales revenue." },
    ],
    portfolio: [
      { icon: "&#127912;", title: "UI/UX Design", desc: "Beautiful interfaces, intuitive experiences." },
      { icon: "&#128187;", title: "Front-End Dev", desc: "React, Three.js, WebGL, animations." },
      { icon: "&#127916;", title: "Motion Design", desc: "Scroll animations, SVG, micro-interactions." },
      { icon: "&#9889;", title: "Performance", desc: "Lighthouse 100. Every time." },
    ],
  };
  const features = featureItems[pageType] || featureItems["product"];

  const stats = [
    { n: "10K+", l: "Active Users" },
    { n: "99.9%", l: "Uptime SLA" },
    { n: "4.9/5", l: "Average Rating" },
    { n: "150+", l: "Countries" },
  ];

  // Build body HTML — all sections with data attributes for JS targeting
  let html = "";

  // ---- HERO with canvas background ----
  html += `
  <section id="hero" style="position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a1a;overflow:hidden;">
    <canvas id="particleCanvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
    <div style="position:relative;z-index:2;text-align:center;padding:40px 5%;max-width:800px;">
      <h1 class="hero-headline" style="font-size:clamp(36px,6vw,72px);font-weight:800;line-height:1.05;margin:0 0 20px;background:linear-gradient(135deg,${v.colorScheme.primary},${v.colorScheme.secondary});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;opacity:0;transform:translateY(30px);">${headline}</h1>
      <p class="hero-subtitle" style="font-size:clamp(16px,2vw,20px);color:rgba(255,255,255,0.6);margin:0 0 40px;line-height:1.6;opacity:0;transform:translateY(20px);">${subtitle}</p>
      <div class="hero-cta" style="display:flex;gap:16px;justify-content:center;opacity:0;transform:translateY(20px);">
        <a href="#" class="glow-btn" style="padding:16px 40px;background:linear-gradient(135deg,${v.colorScheme.primary},${v.colorScheme.secondary});color:#fff;border-radius:12px;text-decoration:none;font-weight:700;font-size:17px;position:relative;overflow:hidden;transition:transform 0.3s,box-shadow 0.3s;">${ctaLabel}</a>
        <a href="#" style="padding:16px 40px;border:2px solid rgba(255,255,255,0.15);color:#fff;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;transition:border-color 0.3s;">Learn More</a>
      </div>
    </div>
    <!-- Floating SVG orbs -->
    <svg class="floating-orb orb1" viewBox="0 0 200 200" style="position:absolute;width:300px;height:300px;top:10%;left:-5%;opacity:0.08;">
      <circle cx="100" cy="100" r="90" fill="${v.colorScheme.primary}"><animate attributeName="r" values="85;95;85" dur="4s" repeatCount="indefinite"/></circle>
    </svg>
    <svg class="floating-orb orb2" viewBox="0 0 200 200" style="position:absolute;width:250px;height:250px;bottom:5%;right:-3%;opacity:0.06;">
      <circle cx="100" cy="100" r="90" fill="${v.colorScheme.secondary}"><animate attributeName="r" values="80;100;80" dur="5s" repeatCount="indefinite"/></circle>
    </svg>
  </section>`;

  // ---- 3D PRODUCT / SHOWCASE CARD ----
  html += `
  <section style="background:#0f0f23;padding:100px 5%;overflow:hidden;">
    <div style="max-width:1100px;margin:0 auto;text-align:center;">
      <h2 class="reveal" style="font-size:clamp(24px,3.5vw,42px);font-weight:800;color:#fff;margin:0 0 16px;opacity:0;transform:translateY(30px);">See It In Action</h2>
      <p class="reveal" style="font-size:17px;color:rgba(255,255,255,0.5);margin:0 0 60px;opacity:0;transform:translateY(20px);">Move your mouse over the product card</p>
      <div id="tiltCard" style="max-width:600px;margin:0 auto;perspective:1000px;cursor:pointer;">
        <div id="tiltInner" style="background:linear-gradient(145deg,rgba(${rgb},0.1),rgba(${rgb2},0.05));border:1px solid rgba(${rgb},0.15);border-radius:20px;padding:48px;transform-style:preserve-3d;transition:transform 0.1s ease-out,box-shadow 0.3s;">
          <div style="transform:translateZ(40px);">
            <div style="width:80px;height:80px;margin:0 auto 24px;border-radius:20px;background:linear-gradient(135deg,${v.colorScheme.primary},${v.colorScheme.secondary});display:flex;align-items:center;justify-content:center;font-size:36px;">&#9889;</div>
            <h3 style="font-size:28px;font-weight:800;color:#fff;margin:0 0 12px;">Product Dashboard</h3>
            <p style="font-size:16px;color:rgba(255,255,255,0.5);margin:0 0 32px;line-height:1.6;">Real-time analytics, automated workflows, and intelligent insights — all in one place.</p>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
              ${[["99.9%", "Uptime"], ["<1s", "Response"], ["10M+", "Events/day"]].map(([n, l]) =>
                `<div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;">
                  <div style="font-size:24px;font-weight:800;color:${v.colorScheme.primary};">${n}</div>
                  <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:4px;">${l}</div>
                </div>`
              ).join("")}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  // ---- FEATURE CARDS with scroll reveal & animated SVG icons ----
  html += `
  <section style="background:#0a0a1a;padding:100px 5%;">
    <div style="max-width:1100px;margin:0 auto;text-align:center;">
      <h2 class="reveal" style="font-size:clamp(24px,3.5vw,42px);font-weight:800;color:#fff;margin:0 0 16px;opacity:0;transform:translateY(30px);">Everything You Need</h2>
      <p class="reveal" style="font-size:17px;color:rgba(255,255,255,0.5);margin:0 0 60px;opacity:0;transform:translateY(20px);">Powerful features designed for modern teams.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;">
        ${features.map((f, i) => `
          <div class="feature-card reveal" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;text-align:left;transition:transform 0.5s ease,opacity 0.5s ease,border-color 0.3s,background 0.3s;opacity:0;transform:translateY(40px);transition-delay:${i * 100}ms;" onmouseover="this.style.borderColor='rgba(${rgb},0.3)';this.style.background='rgba(${rgb},0.05)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.06)';this.style.background='rgba(255,255,255,0.03)'">
            <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,rgba(${rgb},0.15),rgba(${rgb2},0.1));display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:20px;">${f.icon}</div>
            <h3 style="font-size:18px;font-weight:700;color:#fff;margin:0 0 8px;">${f.title}</h3>
            <p style="font-size:14px;line-height:1.7;color:rgba(255,255,255,0.5);margin:0;">${f.desc}</p>
          </div>`).join("")}
      </div>
    </div>
  </section>`;

  // ---- ANIMATED STATS COUNTER ----
  html += `
  <section style="background:linear-gradient(180deg,#0f0f23,#0a0a1a);padding:80px 5%;">
    <div style="max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;text-align:center;">
      ${stats.map(s => `
        <div class="reveal" style="opacity:0;transform:translateY(30px);">
          <div class="counter" data-target="${s.n.replace(/[^0-9.]/g, '')}" style="font-size:clamp(32px,4vw,56px);font-weight:800;background:linear-gradient(135deg,${v.colorScheme.primary},${v.colorScheme.secondary});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">0${s.n.replace(/[0-9.]/g, '')}</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.4);margin-top:8px;">${s.l}</div>
        </div>`).join("")}
    </div>
  </section>`;

  // ---- SVG WAVE DIVIDER ----
  html += `
  <div style="background:#0a0a1a;">
    <svg viewBox="0 0 1440 100" preserveAspectRatio="none" style="display:block;width:100%;height:60px;">
      <path fill="${v.colorScheme.primary}" fill-opacity="0.05" d="M0,50 C360,100 720,0 1080,50 C1260,75 1380,50 1440,50 L1440,100 L0,100 Z">
        <animate attributeName="d" dur="8s" repeatCount="indefinite" values="M0,50 C360,100 720,0 1080,50 C1260,75 1380,50 1440,50 L1440,100 L0,100 Z;M0,60 C360,20 720,80 1080,40 C1260,20 1380,60 1440,40 L1440,100 L0,100 Z;M0,50 C360,100 720,0 1080,50 C1260,75 1380,50 1440,50 L1440,100 L0,100 Z"/>
      </path>
      <path fill="${v.colorScheme.secondary}" fill-opacity="0.03" d="M0,70 C480,30 960,90 1440,60 L1440,100 L0,100 Z">
        <animate attributeName="d" dur="6s" repeatCount="indefinite" values="M0,70 C480,30 960,90 1440,60 L1440,100 L0,100 Z;M0,50 C480,80 960,30 1440,70 L1440,100 L0,100 Z;M0,70 C480,30 960,90 1440,60 L1440,100 L0,100 Z"/>
      </path>
    </svg>
  </div>`;

  // ---- GRADIENT CTA BANNER ----
  html += `
  <section class="animated-gradient" style="padding:100px 5%;text-align:center;background:linear-gradient(135deg,${v.colorScheme.primary},${v.colorScheme.secondary},${v.colorScheme.primary});background-size:200% 200%;">
    <div style="max-width:600px;margin:0 auto;">
      <h2 class="reveal" style="font-size:clamp(28px,4vw,48px);font-weight:800;color:#fff;margin:0 0 16px;opacity:0;transform:translateY(30px);">Ready to Get Started?</h2>
      <p style="font-size:17px;color:rgba(255,255,255,0.8);margin:0 0 36px;">Join thousands of teams already building with us.</p>
      <a href="#" class="glow-btn" style="display:inline-block;padding:18px 48px;background:#fff;color:${v.colorScheme.primary};border-radius:12px;text-decoration:none;font-weight:700;font-size:17px;box-shadow:0 4px 20px rgba(0,0,0,0.15);transition:transform 0.3s;">${ctaLabel}</a>
    </div>
  </section>`;

  return html;
}

function interactiveStyles(v: TemplateVariant): string {
  const rgb = hexToRgb(v.colorScheme.primary);
  return `
    /* Hero entrance animations */
    .hero-headline.visible { opacity: 1 !important; transform: translateY(0) !important; transition: opacity 0.8s ease, transform 0.8s ease; }
    .hero-subtitle.visible { opacity: 1 !important; transform: translateY(0) !important; transition: opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s; }
    .hero-cta.visible { opacity: 1 !important; transform: translateY(0) !important; transition: opacity 0.8s ease 0.6s, transform 0.8s ease 0.6s; }

    /* Scroll reveal */
    .reveal.visible { opacity: 1 !important; transform: translateY(0) !important; }
    .feature-card.visible { opacity: 1 !important; transform: translateY(0) !important; }

    /* Glow button hover */
    .glow-btn:hover { transform: translateY(-2px); box-shadow: 0 0 30px rgba(${rgb}, 0.4); }

    /* Floating orbs */
    .floating-orb { animation: float 6s ease-in-out infinite; }
    .orb2 { animation-delay: -3s; }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }

    /* Animated gradient CTA */
    .animated-gradient { animation: gradientShift 4s ease-in-out infinite; }
    @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

    /* 3D tilt card glow */
    #tiltInner:hover { box-shadow: 0 20px 60px rgba(${rgb}, 0.15); }

    /* Responsive — mobile */
    @media (max-width: 768px) {
      div[style*="grid-template-columns:repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
      #hero { min-height: 80vh !important; }
      #hero .hero-cta { flex-direction: column !important; align-items: stretch !important; }
      #hero .hero-cta a { text-align: center !important; padding: 14px 24px !important; width: 100% !important; }
      #tiltInner { padding: 24px !important; }
      #tiltInner div[style*="grid-template-columns:repeat(3"] { grid-template-columns: 1fr !important; }
      .feature-card { padding: 20px !important; }
    }
  `;
}

function interactiveScript(): string {
  return `
  <script>
  (function() {
    // ---- Particle Canvas ----
    const canvas = document.getElementById('particleCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let w, h, particles = [];
      function resize() { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; }
      resize();
      window.addEventListener('resize', resize);
      for (let i = 0; i < 80; i++) {
        particles.push({ x: Math.random()*w, y: Math.random()*h, vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5, r: Math.random()*2+1 });
      }
      let mouse = { x: w/2, y: h/2 };
      canvas.addEventListener('mousemove', e => { mouse.x = e.offsetX; mouse.y = e.offsetY; });
      function drawParticles() {
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fill();
          // Connect nearby particles
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x, dy = p.y - p2.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 120) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = 'rgba(255,255,255,' + (0.12 * (1 - dist/120)) + ')';
              ctx.stroke();
            }
          }
          // Attract to mouse
          const mdx = mouse.x - p.x, mdy = mouse.y - p.y;
          const mdist = Math.sqrt(mdx*mdx + mdy*mdy);
          if (mdist < 200) {
            p.vx += mdx * 0.00005;
            p.vy += mdy * 0.00005;
          }
        }
        requestAnimationFrame(drawParticles);
      }
      drawParticles();
    }

    // ---- Hero entrance ----
    setTimeout(() => { document.querySelector('.hero-headline')?.classList.add('visible'); }, 200);
    setTimeout(() => { document.querySelector('.hero-subtitle')?.classList.add('visible'); }, 200);
    setTimeout(() => { document.querySelector('.hero-cta')?.classList.add('visible'); }, 200);

    // ---- Scroll reveal with IntersectionObserver ----
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal, .feature-card').forEach(el => observer.observe(el));

    // ---- 3D Tilt Card ----
    const tiltCard = document.getElementById('tiltCard');
    const tiltInner = document.getElementById('tiltInner');
    if (tiltCard && tiltInner) {
      tiltCard.addEventListener('mousemove', e => {
        const rect = tiltCard.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        tiltInner.style.transform = 'rotateY(' + (x * 15) + 'deg) rotateX(' + (-y * 15) + 'deg)';
      });
      tiltCard.addEventListener('mouseleave', () => {
        tiltInner.style.transform = 'rotateY(0) rotateX(0)';
      });
    }

    // ---- Counter Animation ----
    const counters = document.querySelectorAll('.counter');
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.counted) {
          entry.target.dataset.counted = 'true';
          const target = parseFloat(entry.target.dataset.target) || 0;
          const suffix = entry.target.textContent.replace(/[0-9.]/g, '');
          const duration = 2000;
          const start = performance.now();
          function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const current = Math.floor(target * eased);
            entry.target.textContent = current.toLocaleString() + suffix;
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(c => counterObserver.observe(c));
  })();
  </script>`;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateTemplatePreviewHtml(variant: TemplateVariant, pageType: string): string {
  const template = PAGE_TYPE_TEMPLATES[pageType];
  const textColor = isDark(variant.colorScheme.bg) ? "#ffffff" : "#111827";
  const isInteractive = variant.layout === "interactive";

  let body: string;
  switch (variant.layout) {
    case "video":
      body = buildVideoPage(variant, pageType);
      break;
    case "minimal":
      body = buildMinimalPage(variant, pageType);
      break;
    case "split":
      body = buildSplitPage(variant, pageType);
      break;
    case "dark":
      body = buildDarkPage(variant, pageType);
      break;
    case "interactive":
      body = buildInteractivePage(variant, pageType);
      break;
    default:
      body = buildStandardPage(variant, pageType);
  }

  body += footerHtml(variant);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${variant.name} — ${template?.name || "Template"} Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      background: ${variant.colorScheme.bg};
      color: ${textColor};
    }
    img { max-width: 100%; height: auto; }
    a { transition: opacity 0.2s; }
    a:hover { opacity: 0.85; }
    input:focus, button:focus { outline: 2px solid ${variant.colorScheme.primary}; outline-offset: 2px; }
    /* Mobile-first responsive overrides */
    @media (max-width: 768px) {
      div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
      div[style*="grid-template-columns:1fr 1fr"] { grid-template-columns: 1fr !important; }
      div[style*="grid-template-columns:repeat(3"] { grid-template-columns: 1fr !important; }
      div[style*="grid-template-columns:repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
      div[style*="grid-template-columns:repeat(auto-fit"] { grid-template-columns: 1fr !important; }
      section { padding-left: 16px !important; padding-right: 16px !important; }
      section[style*="padding:100px"] { padding-top: 48px !important; padding-bottom: 48px !important; }
      section[style*="padding:80px"] { padding-top: 40px !important; padding-bottom: 40px !important; }
      div[style*="display:flex"][style*="gap:16px"][style*="justify-content:center"] { flex-direction: column !important; align-items: stretch !important; }
      div[style*="display:flex"][style*="gap:16px"][style*="justify-content:center"] a { text-align: center !important; width: 100% !important; }
      #tiltCard { max-width: 100% !important; }
      .floating-orb { display: none !important; }
    }
    .preview-banner {
      position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
      background: linear-gradient(135deg, ${variant.colorScheme.primary}, ${variant.colorScheme.secondary});
      color: #fff; text-align: center; padding: 8px 16px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;
    }
    body { padding-top: 36px; }
    ${isInteractive ? interactiveStyles(variant) : ""}
  </style>
</head>
<body>
  <div class="preview-banner">&#9733; Template Preview: ${variant.name} &mdash; ${template?.name || pageType} (${variant.layout})</div>
  ${body}
  ${isInteractive ? interactiveScript() : ""}
</body>
</html>`;
}
