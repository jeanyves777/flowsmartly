"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  HelpCircle,
  BookOpen,
  MessageCircle,
  Mail,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Palette,
  Image,
  Megaphone,
  BarChart3,
  DollarSign,
  Users,
  Shield,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    category: "Getting Started",
    question: "How do I create my first design?",
    answer: "Go to Visual Studio from the sidebar, select a design category (Social Post, Banner, etc.), choose a size preset, pick a visual style, and describe what you want. Click Generate and our AI will create a professional design for you.",
  },
  {
    category: "Getting Started",
    question: "What is Brand Identity and why should I set it up?",
    answer: "Brand Identity stores your brand name, logo, colors, voice tone, and contact information. Once set up, all AI-generated content and designs automatically use your branding for a consistent look across everything you create.",
  },
  {
    category: "Getting Started",
    question: "How do AI credits work?",
    answer: "Each AI generation (posts, designs, logos) costs credits. Your plan includes a monthly credit allowance. Credit costs vary by feature — check the credit badge on each tool for the current rate. You can view all pricing in Buy Credits. Credits reset monthly.",
  },
  {
    category: "Visual Studio",
    question: "What is the difference between 'AI Creative' and 'Use My Text' mode?",
    answer: "In 'AI Creative' mode, the AI generates compelling marketing copy based on your description. In 'Use My Text' mode, your exact words appear on the design without modification. Use 'AI Creative' for inspiration and 'Use My Text' when you have specific copy requirements.",
  },
  {
    category: "Visual Studio",
    question: "Can I add my contact information to designs?",
    answer: "Yes! First add your contact details (email, phone, website, address) in Brand Identity settings. Then in Visual Studio, use the 'Include in Design' checkboxes to select which contact details appear on your design.",
  },
  {
    category: "Visual Studio",
    question: "What design sizes are available?",
    answer: "We support 29 size presets across 6 categories: Social Media Posts (Instagram, Facebook, Twitter, LinkedIn), Advertisements (display ads), Flyers (A4, A5, US Letter), Posters (A3, A2, event), Banners (web, YouTube, social covers), and Signboards.",
  },
  {
    category: "Content Creation",
    question: "How does AI content generation work?",
    answer: "Our AI uses your brand context (voice tone, keywords, target audience) to generate platform-optimized content. You can generate posts, captions, hashtags, and content ideas. Each generation is tailored to the social media platform you select.",
  },
  {
    category: "Content Creation",
    question: "Can I generate content for multiple platforms at once?",
    answer: "Yes, when creating a post you can select multiple platforms. The AI will optimize the content for each platform's character limits, hashtag conventions, and audience expectations.",
  },
  {
    category: "Feed & Social",
    question: "How does the FlowSocial feed work?",
    answer: "FlowSocial is our built-in social network. You can publish posts, interact with other creators through likes, comments, and shares, follow other users, and build your audience. Content you create in the studio can be published directly to your feed.",
  },
  {
    category: "Feed & Social",
    question: "How do I share content to external platforms?",
    answer: "Use the share button on any post to share via native share dialogs to Instagram, Facebook, Twitter, LinkedIn, and more. No API keys or business verification required.",
  },
  {
    category: "Marketing",
    question: "What marketing tools are available?",
    answer: "Premium plans include Campaign Management for organizing marketing efforts, Email Marketing for newsletter campaigns, and SMS Marketing for text message outreach. All integrate with your contact lists and brand identity.",
  },
  {
    category: "Monetization",
    question: "How does the earnings system work?",
    answer: "You earn through the View-to-Earn model. When your content gets views and engagement on FlowSocial, you earn credits that can be converted to real earnings. Track your performance in the Earnings dashboard.",
  },
  {
    category: "Monetization",
    question: "How do ads work on FlowSmartly?",
    answer: "You can create ad campaigns to promote your content to a wider audience. Set your budget, target audience, and campaign duration. Track performance with impressions, clicks, and conversion metrics in the Ads dashboard.",
  },
  {
    category: "Account",
    question: "How do I upgrade my plan?",
    answer: "Go to Settings > Billing to view available plans. Upgrade to Pro, Business, or Enterprise for more AI credits, marketing tools, and advanced features.",
  },
  {
    category: "Account",
    question: "Is my data secure?",
    answer: "Yes. We use encrypted passwords, secure session management, and follow industry best practices for data protection. You can manage your security settings including password changes in Settings > Security.",
  },
];

const categories = [
  { id: "all", label: "All Topics", icon: BookOpen },
  { id: "Getting Started", label: "Getting Started", icon: Sparkles },
  { id: "Visual Studio", label: "Visual Studio", icon: Palette },
  { id: "Content Creation", label: "Content", icon: Image },
  { id: "Feed & Social", label: "Feed & Social", icon: Users },
  { id: "Marketing", label: "Marketing", icon: Megaphone },
  { id: "Monetization", label: "Monetization", icon: DollarSign },
  { id: "Account", label: "Account", icon: Shield },
];

const quickLinks = [
  { label: "Visual Studio", href: "/studio", icon: Palette, desc: "Create AI-powered designs" },
  { label: "Brand Identity", href: "/brand", icon: Image, desc: "Set up your brand" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, desc: "View your performance" },
  { label: "Settings", href: "/settings", icon: Shield, desc: "Manage your account" },
];

export default function HelpPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const filteredFaqs = selectedCategory === "all"
    ? faqs
    : faqs.filter(f => f.category === selectedCategory);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8 p-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <HelpCircle className="w-8 h-8 text-brand-500" />
          Help Center
        </h1>
        <p className="text-muted-foreground mt-2">
          Find answers, learn features, and get the most out of FlowSmartly
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <a key={link.href} href={link.href}>
            <Card className="hover:border-brand-500 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <link.icon className="w-6 h-6 text-brand-500" />
                <p className="text-sm font-medium">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.desc}</p>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-500" />
            Frequently Asked Questions
          </CardTitle>
          <CardDescription>Browse by category or view all topics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setExpandedFaq(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                  selectedCategory === cat.id
                    ? "bg-brand-500 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            ))}
          </div>

          {/* FAQ List */}
          <div className="space-y-2">
            {filteredFaqs.map((faq, index) => (
              <div
                key={index}
                className="border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-sm pr-4">{faq.question}</span>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {expandedFaq === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="px-4 pb-4"
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact Support */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <MessageCircle className="w-6 h-6 text-blue-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Community</h3>
              <p className="text-sm text-muted-foreground">
                Connect with other FlowSmartly users, share tips, and get help from the community.
              </p>
              <Button variant="link" className="p-0 h-auto text-brand-500" asChild>
                <a href="/feed">
                  Visit FlowSocial Feed
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <Mail className="w-6 h-6 text-green-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Email Support</h3>
              <p className="text-sm text-muted-foreground">
                Need more help? Reach out to our support team and we will get back to you within 24 hours.
              </p>
              <Button variant="link" className="p-0 h-auto text-brand-500">
                info@flowsmartly.com
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Info */}
      <Card className="border-dashed">
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            FlowSmartly v2.0 — AI-Powered Social Media Content Platform
          </p>
          <p className="text-xs text-muted-foreground">
            Powered by Claude AI and gpt-image-1 for intelligent content creation
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
