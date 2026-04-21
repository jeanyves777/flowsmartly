"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, LayoutGrid, Image as ImageIcon, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { confirmDialog } from "@/components/shared/confirm-dialog";
import { addImageToCanvas, createTextbox, safeLoadFromJSON } from "../utils/canvas-helpers";
import { DESIGN_CATEGORIES } from "@/lib/constants/design-presets";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { AISpinner } from "@/components/shared/ai-generation-loader";

interface DesignTemplate {
  id: string;
  name: string;
  category: string;
  preset: string;
  thumbnail: string;
  image: string;
  tags: string[];
  canvasData?: string;
}

interface StarterTemplate {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  bgColor: string;
  gradient: string;
  elements: StarterElement[];
}

// Discriminated union — each element type carries only the props that apply.
type StarterElement =
  | StarterTextElement
  | StarterRectElement
  | StarterCircleElement
  | StarterLineElement;

interface StarterTextElement {
  type: "textbox";
  text: string;
  fontSize: number;
  fontWeight?: string;
  fontStyle?: string;
  fontFamily?: string;
  fill: string;
  textAlign: string;
  top: number;
  left: number;
  width: number;
  charSpacing?: number;
  lineHeight?: number;
  shadow?: string;
  opacity?: number;
}

interface StarterRectElement {
  type: "rect";
  top: number;
  left: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  ry?: number;
  opacity?: number;
  angle?: number;
}

interface StarterCircleElement {
  type: "circle";
  top: number;
  left: number;
  radius: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

interface StarterLineElement {
  type: "line";
  /** [x1, y1, x2, y2] */
  coords: [number, number, number, number];
  stroke: string;
  strokeWidth?: number;
  opacity?: number;
}

// Each template is a composition of shapes + lines + textboxes layered to
// produce a real designed look — not just text on a gradient. Every element
// is fully editable after apply (each one lands on the canvas as a Fabric
// object) so the user can swap colors, move things around, or replace text.
const STARTER_TEMPLATES: StarterTemplate[] = [
  // 1. BOLD STATEMENT — oversized display type, decorative blob + halo ring
  {
    id: "t-bold-statement",
    name: "Bold Statement",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#4c1d95",
    gradient: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 60%, #ec4899 100%)",
    elements: [
      // Decorative halo ring (outlined circle, offset to upper-right)
      { type: "circle", top: 60, left: 680, radius: 320, fill: "transparent", stroke: "rgba(255,255,255,0.18)", strokeWidth: 2 },
      // Accent blob
      { type: "circle", top: 780, left: -140, radius: 260, fill: "rgba(236,72,153,0.35)", opacity: 0.9 },
      // Small solid accent circle
      { type: "circle", top: 140, left: 170, radius: 14, fill: "#fef08a" },
      // Eyebrow text
      { type: "textbox", text: "NEW \u2022 2026", fontSize: 18, fontWeight: "bold", fill: "rgba(255,255,255,0.7)", textAlign: "center", top: 350, left: 90, width: 900, charSpacing: 400 },
      // Main display
      { type: "textbox", text: "YOUR BIG\nIDEA HERE", fontSize: 128, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 400, left: 40, width: 1000, lineHeight: 0.95 },
      // Underline bar
      { type: "rect", top: 700, left: 480, width: 120, height: 5, fill: "#fef08a", rx: 2, ry: 2 },
      // Sub text
      { type: "textbox", text: "Share your message with the world", fontSize: 24, fill: "rgba(255,255,255,0.75)", textAlign: "center", top: 740, left: 140, width: 800 },
    ],
  },

  // 2. FLASH SALE — angled ribbon + stamp + bold pricing
  {
    id: "t-flash-sale",
    name: "Flash Sale",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#b91c1c",
    gradient: "linear-gradient(135deg, #b91c1c 0%, #ef4444 50%, #f97316 100%)",
    elements: [
      // Angled ribbon strip across the top-left
      { type: "rect", top: 140, left: -60, width: 720, height: 90, fill: "#fef08a", angle: -8, opacity: 0.95 },
      // Stamp circle (corner discount)
      { type: "circle", top: 130, left: 820, radius: 120, fill: "#ffffff", stroke: "#b91c1c", strokeWidth: 6 },
      { type: "textbox", text: "50%\nOFF", fontSize: 44, fontWeight: "bold", fill: "#b91c1c", textAlign: "center", top: 180, left: 780, width: 240, lineHeight: 1.0 },
      // Eyebrow on ribbon
      { type: "textbox", text: "FLASH SALE \u2022 48 HOURS ONLY", fontSize: 26, fontWeight: "bold", fill: "#b91c1c", textAlign: "left", top: 160, left: 40, width: 540, charSpacing: 200 },
      // Main big word
      { type: "textbox", text: "BUY NOW", fontSize: 160, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 380, left: 20, width: 1040, charSpacing: 80 },
      // Accent divider
      { type: "rect", top: 580, left: 440, width: 200, height: 4, fill: "#fef08a" },
      // Sub message
      { type: "textbox", text: "Everything in store\nFree shipping included", fontSize: 28, fill: "rgba(255,255,255,0.9)", textAlign: "center", top: 620, left: 140, width: 800, lineHeight: 1.3 },
      // CTA "button" pill
      { type: "rect", top: 820, left: 380, width: 320, height: 76, fill: "#fef08a", rx: 38, ry: 38 },
      { type: "textbox", text: "Shop the sale \u2192", fontSize: 24, fontWeight: "bold", fill: "#b91c1c", textAlign: "center", top: 845, left: 380, width: 320 },
    ],
  },

  // 3. ELEGANT QUOTE — serif display type, decorative quotation marks + rule
  {
    id: "t-elegant-quote",
    name: "Elegant Quote",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#faf7f2",
    gradient: "linear-gradient(180deg, #faf7f2 0%, #e8dfd0 100%)",
    elements: [
      // Large decorative quote mark
      { type: "textbox", text: "\u201C", fontSize: 360, fill: "#c9b8a0", textAlign: "center", top: 60, left: 90, width: 900, fontFamily: "Playfair Display", opacity: 0.7 },
      // Horizontal rule top
      { type: "line", coords: [140, 260, 940, 260], stroke: "#c9b8a0", strokeWidth: 1 },
      // Quote body
      { type: "textbox", text: "The best way\nto predict the future\nis to create it.", fontSize: 48, fontStyle: "italic", fill: "#2d2419", textAlign: "center", top: 340, left: 140, width: 800, fontFamily: "Playfair Display", lineHeight: 1.25 },
      // Horizontal rule bottom
      { type: "line", coords: [440, 720, 640, 720], stroke: "#c9b8a0", strokeWidth: 2 },
      // Attribution
      { type: "textbox", text: "PETER DRUCKER", fontSize: 18, fontWeight: "bold", fill: "#8b7355", textAlign: "center", top: 750, left: 290, width: 500, charSpacing: 500 },
    ],
  },

  // 4. DARK PREMIUM — gold accent bar, all-caps spacing, brand mark
  {
    id: "t-dark-promo",
    name: "Dark Premium",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#0a0a0a",
    gradient: "linear-gradient(135deg, #0a0a0a 0%, #1e1e1e 100%)",
    elements: [
      // Gold top bar
      { type: "rect", top: 60, left: 440, width: 200, height: 2, fill: "#d4af37" },
      // Eyebrow
      { type: "textbox", text: "LIMITED EDITION", fontSize: 16, fontWeight: "bold", fill: "#d4af37", textAlign: "center", top: 85, left: 240, width: 600, charSpacing: 800 },
      // Main title
      { type: "textbox", text: "PREMIUM\nCOLLECTION", fontSize: 96, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 320, left: 40, width: 1000, charSpacing: 200, lineHeight: 1.0 },
      // Gold divider between title and sub
      { type: "rect", top: 600, left: 490, width: 100, height: 3, fill: "#d4af37" },
      // Sub text
      { type: "textbox", text: "Crafted for those who demand more", fontSize: 22, fontStyle: "italic", fill: "rgba(255,255,255,0.65)", textAlign: "center", top: 630, left: 140, width: 800 },
      // Bottom logo placeholder (circle with monogram)
      { type: "circle", top: 850, left: 480, radius: 60, fill: "transparent", stroke: "#d4af37", strokeWidth: 2 },
      { type: "textbox", text: "A", fontSize: 44, fontFamily: "Playfair Display", fontStyle: "italic", fill: "#d4af37", textAlign: "center", top: 878, left: 480, width: 120 },
    ],
  },

  // 5. EVENT INVITE — ticket card with dashed border, date block, brand mark
  {
    id: "t-event-invite",
    name: "Event Invite",
    category: "social_post",
    width: 1080, height: 1350, bgColor: "#0b3b34",
    gradient: "linear-gradient(135deg, #0b3b34 0%, #0d9488 60%, #22d3ee 100%)",
    elements: [
      // Inner ticket card
      { type: "rect", top: 90, left: 90, width: 900, height: 1170, fill: "rgba(255,255,255,0.05)", stroke: "rgba(255,255,255,0.25)", strokeWidth: 2, rx: 24, ry: 24 },
      // Top eyebrow
      { type: "textbox", text: "YOU'RE INVITED", fontSize: 22, fontWeight: "bold", fill: "#fef08a", textAlign: "center", top: 170, left: 190, width: 700, charSpacing: 600 },
      // Separator dot row
      { type: "circle", top: 225, left: 520, radius: 4, fill: "#fef08a" },
      { type: "circle", top: 225, left: 540, radius: 4, fill: "rgba(255,255,255,0.5)" },
      { type: "circle", top: 225, left: 560, radius: 4, fill: "#fef08a" },
      // Main event name
      { type: "textbox", text: "Summer\nLaunch Party", fontSize: 84, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 290, left: 40, width: 1000, fontFamily: "Playfair Display", fontStyle: "italic", lineHeight: 1.0 },
      // Hairline
      { type: "line", coords: [340, 560, 740, 560], stroke: "#fef08a", strokeWidth: 1 },
      // Date block
      { type: "textbox", text: "SATURDAY", fontSize: 18, fontWeight: "bold", fill: "rgba(255,255,255,0.75)", textAlign: "center", top: 610, left: 290, width: 500, charSpacing: 400 },
      { type: "textbox", text: "MARCH 15", fontSize: 72, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 650, left: 140, width: 800 },
      { type: "textbox", text: "7:00 PM", fontSize: 26, fill: "#fef08a", textAlign: "center", top: 760, left: 290, width: 500, charSpacing: 200 },
      // Divider
      { type: "rect", top: 830, left: 490, width: 100, height: 2, fill: "rgba(255,255,255,0.4)" },
      // Location
      { type: "textbox", text: "Main Hall, 123 Market Street", fontSize: 22, fill: "rgba(255,255,255,0.85)", textAlign: "center", top: 870, left: 140, width: 800 },
      { type: "textbox", text: "Brooklyn, NY", fontSize: 22, fill: "rgba(255,255,255,0.85)", textAlign: "center", top: 905, left: 140, width: 800 },
      // RSVP button
      { type: "rect", top: 1040, left: 390, width: 300, height: 76, fill: "#fef08a", rx: 38, ry: 38 },
      { type: "textbox", text: "RSVP NOW", fontSize: 22, fontWeight: "bold", fill: "#0b3b34", textAlign: "center", top: 1065, left: 390, width: 300, charSpacing: 400 },
    ],
  },

  // 6. THANK YOU — handwritten-feel script on pastel with confetti dots
  {
    id: "t-thank-you",
    name: "Thank You",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#fce7f3",
    gradient: "linear-gradient(135deg, #fce7f3 0%, #fecaca 50%, #fed7aa 100%)",
    elements: [
      // Confetti dots scattered
      { type: "circle", top: 120, left: 160, radius: 8, fill: "#ec4899" },
      { type: "circle", top: 200, left: 880, radius: 12, fill: "#f97316" },
      { type: "circle", top: 160, left: 720, radius: 6, fill: "#a855f7" },
      { type: "circle", top: 820, left: 120, radius: 10, fill: "#f97316" },
      { type: "circle", top: 900, left: 900, radius: 8, fill: "#ec4899" },
      { type: "circle", top: 880, left: 640, radius: 14, fill: "#a855f7" },
      { type: "circle", top: 280, left: 140, radius: 5, fill: "#f59e0b" },
      { type: "circle", top: 760, left: 870, radius: 6, fill: "#f59e0b" },
      // Main
      { type: "textbox", text: "Thank you", fontSize: 160, fontStyle: "italic", fontWeight: "bold", fill: "#db2777", textAlign: "center", top: 380, left: 40, width: 1000, fontFamily: "Playfair Display" },
      // Decorative rule
      { type: "line", coords: [440, 580, 640, 580], stroke: "#db2777", strokeWidth: 2 },
      // Sub
      { type: "textbox", text: "we truly appreciate your support", fontSize: 26, fill: "#9d174d", textAlign: "center", top: 610, left: 140, width: 800, charSpacing: 200 },
      // Signature block
      { type: "textbox", text: "\u2014 With love, the team", fontSize: 22, fontStyle: "italic", fill: "#831843", textAlign: "center", top: 720, left: 290, width: 500, fontFamily: "Playfair Display" },
    ],
  },

  // 7. STORY BOLD — fullscreen vertical with corner blocks + CTA
  {
    id: "t-story-bold",
    name: "Story Bold",
    category: "social_post",
    width: 1080, height: 1920, bgColor: "#ea580c",
    gradient: "linear-gradient(180deg, #ea580c 0%, #dc2626 60%, #7f1d1d 100%)",
    elements: [
      // Top accent block
      { type: "rect", top: 0, left: 0, width: 1080, height: 180, fill: "rgba(0,0,0,0.2)" },
      // Eyebrow
      { type: "textbox", text: "\u2192 NEW THIS WEEK", fontSize: 24, fontWeight: "bold", fill: "#fef08a", textAlign: "left", top: 80, left: 60, width: 960, charSpacing: 400 },
      // Big stacked display
      { type: "textbox", text: "YOUR\nSTORY\nHERE", fontSize: 220, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 620, left: 20, width: 1040, lineHeight: 0.95 },
      // Decorative bar
      { type: "rect", top: 1280, left: 440, width: 200, height: 6, fill: "#fef08a" },
      // Sub line
      { type: "textbox", text: "Swipe up for the full story", fontSize: 28, fill: "rgba(255,255,255,0.85)", textAlign: "center", top: 1320, left: 140, width: 800 },
      // Bottom arrow + cta
      { type: "circle", top: 1600, left: 490, radius: 50, fill: "transparent", stroke: "#fef08a", strokeWidth: 4 },
      { type: "textbox", text: "\u2191", fontSize: 52, fontWeight: "bold", fill: "#fef08a", textAlign: "center", top: 1605, left: 480, width: 120 },
      { type: "textbox", text: "swipe", fontSize: 18, fontWeight: "bold", fill: "rgba(255,255,255,0.7)", textAlign: "center", top: 1720, left: 440, width: 200, charSpacing: 400 },
    ],
  },

  // 8. YOUTUBE THUMB — high-contrast split layout with arrow
  {
    id: "t-youtube-thumb",
    name: "YouTube Thumb",
    category: "banner",
    width: 1280, height: 720, bgColor: "#0a0a0a",
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0a0a0a 100%)",
    elements: [
      // Red accent bar (left)
      { type: "rect", top: 0, left: 0, width: 14, height: 720, fill: "#ef4444" },
      // Glow circle bottom-right
      { type: "circle", top: 400, left: 900, radius: 240, fill: "rgba(239,68,68,0.25)", opacity: 0.8 },
      // Eyebrow
      { type: "textbox", text: "EPISODE 12", fontSize: 26, fontWeight: "bold", fill: "#ef4444", textAlign: "left", top: 90, left: 70, width: 800, charSpacing: 300 },
      // Massive display
      { type: "textbox", text: "WATCH\nTHIS!", fontSize: 180, fontWeight: "bold", fill: "#ffffff", textAlign: "left", top: 150, left: 70, width: 800, lineHeight: 0.9 },
      // Subtitle in red
      { type: "textbox", text: "you won't believe what happens", fontSize: 32, fill: "#ef4444", textAlign: "left", top: 580, left: 70, width: 800, fontStyle: "italic" },
      // Play-button circle
      { type: "circle", top: 300, left: 1020, radius: 90, fill: "#ef4444" },
      { type: "textbox", text: "\u25B6", fontSize: 72, fill: "#ffffff", textAlign: "center", top: 335, left: 1000, width: 180 },
    ],
  },

  // 9. FACEBOOK COVER — clean personal-brand header
  {
    id: "t-facebook-cover",
    name: "Facebook Cover",
    category: "banner",
    width: 820, height: 312, bgColor: "#1e3a8a",
    gradient: "linear-gradient(90deg, #1e3a8a 0%, #4338ca 50%, #7c3aed 100%)",
    elements: [
      // Hero accent circle left
      { type: "circle", top: -40, left: -60, radius: 140, fill: "rgba(255,255,255,0.06)" },
      { type: "circle", top: 220, left: 760, radius: 100, fill: "rgba(255,255,255,0.08)" },
      // Yellow accent bar
      { type: "rect", top: 100, left: 60, width: 5, height: 110, fill: "#fef08a" },
      // Name
      { type: "textbox", text: "Your Brand", fontSize: 56, fontWeight: "bold", fill: "#ffffff", textAlign: "left", top: 90, left: 90, width: 600 },
      // Tagline
      { type: "textbox", text: "Helping businesses grow since 2015", fontSize: 20, fill: "rgba(255,255,255,0.75)", textAlign: "left", top: 165, left: 90, width: 600 },
      // Social row
      { type: "textbox", text: "@yourbrand \u2022 yourbrand.com", fontSize: 16, fill: "#fef08a", textAlign: "left", top: 210, left: 90, width: 600, charSpacing: 200 },
    ],
  },

  // 10. PRODUCT FEATURE — clean ecommerce hero with badge + price
  {
    id: "t-product-feature",
    name: "Product Feature",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#ffffff",
    gradient: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
    elements: [
      // Image placeholder frame (top half)
      { type: "rect", top: 90, left: 90, width: 900, height: 500, fill: "#e2e8f0", rx: 16, ry: 16 },
      { type: "rect", top: 90, left: 90, width: 900, height: 500, fill: "transparent", stroke: "rgba(99,102,241,0.35)", strokeWidth: 2, rx: 16, ry: 16 },
      { type: "textbox", text: "\u2295  drop your product photo here", fontSize: 22, fill: "#94a3b8", textAlign: "center", top: 315, left: 90, width: 900 },
      // Badge pill
      { type: "rect", top: 640, left: 440, width: 200, height: 40, fill: "#6366f1", rx: 20, ry: 20 },
      { type: "textbox", text: "NEW ARRIVAL", fontSize: 14, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 653, left: 440, width: 200, charSpacing: 400 },
      // Product name
      { type: "textbox", text: "Product Name", fontSize: 64, fontWeight: "bold", fill: "#0f172a", textAlign: "center", top: 700, left: 40, width: 1000 },
      // Description
      { type: "textbox", text: "The perfect addition to your collection.\nFree shipping on orders over $50.", fontSize: 20, fill: "#64748b", textAlign: "center", top: 800, left: 140, width: 800, lineHeight: 1.4 },
      // Price + strike
      { type: "textbox", text: "$79", fontSize: 56, fontWeight: "bold", fill: "#6366f1", textAlign: "center", top: 900, left: 390, width: 160 },
      { type: "textbox", text: "$99", fontSize: 28, fill: "#94a3b8", textAlign: "center", top: 920, left: 560, width: 130 },
      // Strike-through line over the $99
      { type: "line", coords: [575, 943, 660, 933], stroke: "#94a3b8", strokeWidth: 2 },
    ],
  },

  // 11. ANNOUNCEMENT — megaphone-inspired with chevron badge
  {
    id: "t-announcement",
    name: "Big Announcement",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#047857",
    gradient: "linear-gradient(135deg, #047857 0%, #10b981 60%, #6ee7b7 100%)",
    elements: [
      // Decorative chevron strokes top
      { type: "line", coords: [140, 220, 280, 160], stroke: "rgba(255,255,255,0.35)", strokeWidth: 3 },
      { type: "line", coords: [280, 160, 420, 220], stroke: "rgba(255,255,255,0.35)", strokeWidth: 3 },
      { type: "line", coords: [660, 220, 800, 160], stroke: "rgba(255,255,255,0.35)", strokeWidth: 3 },
      { type: "line", coords: [800, 160, 940, 220], stroke: "rgba(255,255,255,0.35)", strokeWidth: 3 },
      // Badge
      { type: "rect", top: 300, left: 390, width: 300, height: 50, fill: "#fef08a", rx: 25, ry: 25 },
      { type: "textbox", text: "\u2727  ANNOUNCEMENT", fontSize: 18, fontWeight: "bold", fill: "#047857", textAlign: "center", top: 315, left: 390, width: 300, charSpacing: 200 },
      // Title
      { type: "textbox", text: "BIG NEWS!", fontSize: 120, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 420, left: 40, width: 1000 },
      // Divider
      { type: "rect", top: 590, left: 490, width: 100, height: 4, fill: "#fef08a" },
      // Body
      { type: "textbox", text: "Share your exciting announcement here.\nYour audience is waiting to hear from you.", fontSize: 28, fill: "rgba(255,255,255,0.92)", textAlign: "center", top: 630, left: 90, width: 900, lineHeight: 1.4 },
      // Date tag
      { type: "rect", top: 820, left: 430, width: 220, height: 50, fill: "transparent", stroke: "#fef08a", strokeWidth: 2, rx: 25, ry: 25 },
      { type: "textbox", text: "MARCH 15, 2026", fontSize: 18, fontWeight: "bold", fill: "#fef08a", textAlign: "center", top: 835, left: 430, width: 220, charSpacing: 300 },
    ],
  },

  // 12. LINKEDIN BANNER — professional with avatar ring space
  {
    id: "t-linkedin-banner",
    name: "LinkedIn Banner",
    category: "banner",
    width: 1584, height: 396, bgColor: "#0f172a",
    gradient: "linear-gradient(90deg, #0f172a 0%, #1e293b 60%, #334155 100%)",
    elements: [
      // Right-side decorative blobs (behind where avatar overlay goes)
      { type: "circle", top: 60, left: 1340, radius: 160, fill: "rgba(99,102,241,0.18)" },
      { type: "circle", top: 200, left: 1420, radius: 80, fill: "rgba(59,130,246,0.25)" },
      // Left vertical accent
      { type: "rect", top: 100, left: 60, width: 4, height: 200, fill: "#6366f1" },
      // Name
      { type: "textbox", text: "Your Name", fontSize: 52, fontWeight: "bold", fill: "#ffffff", textAlign: "left", top: 100, left: 100, width: 1000 },
      // Title
      { type: "textbox", text: "Founder & CEO, Company Inc.", fontSize: 26, fill: "#94a3b8", textAlign: "left", top: 175, left: 100, width: 1000 },
      // Pills / keywords
      { type: "rect", top: 245, left: 100, width: 140, height: 34, fill: "transparent", stroke: "rgba(99,102,241,0.6)", strokeWidth: 1, rx: 17, ry: 17 },
      { type: "textbox", text: "Speaker", fontSize: 14, fontWeight: "bold", fill: "#a5b4fc", textAlign: "center", top: 254, left: 100, width: 140, charSpacing: 200 },
      { type: "rect", top: 245, left: 260, width: 120, height: 34, fill: "transparent", stroke: "rgba(99,102,241,0.6)", strokeWidth: 1, rx: 17, ry: 17 },
      { type: "textbox", text: "Author", fontSize: 14, fontWeight: "bold", fill: "#a5b4fc", textAlign: "center", top: 254, left: 260, width: 120, charSpacing: 200 },
      { type: "rect", top: 245, left: 400, width: 160, height: 34, fill: "transparent", stroke: "rgba(99,102,241,0.6)", strokeWidth: 1, rx: 17, ry: 17 },
      { type: "textbox", text: "Investor", fontSize: 14, fontWeight: "bold", fill: "#a5b4fc", textAlign: "center", top: 254, left: 400, width: 160, charSpacing: 200 },
      // Bottom tagline
      { type: "textbox", text: "\u2192 Helping early-stage teams ship faster", fontSize: 18, fontStyle: "italic", fill: "#cbd5e1", textAlign: "left", top: 320, left: 100, width: 1000 },
    ],
  },

  // 13. TESTIMONIAL CARD — avatar circle + quoted review + 5-star rating
  {
    id: "t-testimonial",
    name: "Testimonial",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#f8fafc",
    gradient: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
    elements: [
      // Decorative oversized quote mark
      { type: "textbox", text: "\u201C", fontSize: 240, fill: "#6366f1", textAlign: "center", top: 80, left: 40, width: 1000, fontFamily: "Playfair Display", opacity: 0.25 },
      // Avatar placeholder (large circle)
      { type: "circle", top: 260, left: 440, radius: 100, fill: "#e0e7ff", stroke: "#6366f1", strokeWidth: 4 },
      { type: "textbox", text: "\u2295", fontSize: 64, fill: "#818cf8", textAlign: "center", top: 310, left: 440, width: 200 },
      // Quote body
      { type: "textbox", text: "\"This completely changed how our team works.\nWorth every penny, and the support is stellar.\"", fontSize: 32, fontStyle: "italic", fill: "#1e293b", textAlign: "center", top: 520, left: 90, width: 900, fontFamily: "Playfair Display", lineHeight: 1.4 },
      // Star rating row (5 yellow star approximations using filled text chars)
      { type: "textbox", text: "\u2605  \u2605  \u2605  \u2605  \u2605", fontSize: 32, fill: "#f59e0b", textAlign: "center", top: 720, left: 190, width: 700, charSpacing: 200 },
      // Divider
      { type: "line", coords: [440, 790, 640, 790], stroke: "#6366f1", strokeWidth: 2 },
      // Name + title
      { type: "textbox", text: "Sarah Chen", fontSize: 28, fontWeight: "bold", fill: "#0f172a", textAlign: "center", top: 820, left: 140, width: 800 },
      { type: "textbox", text: "CEO, Acme Corp", fontSize: 18, fill: "#64748b", textAlign: "center", top: 865, left: 240, width: 600, charSpacing: 200 },
    ],
  },

  // 14. INSTAGRAM POST — avatar header + photo frame + caption
  {
    id: "t-ig-post",
    name: "Instagram Post",
    category: "social_post",
    width: 1080, height: 1350, bgColor: "#ffffff",
    gradient: "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)",
    elements: [
      // Header bar (avatar + username)
      { type: "circle", top: 40, left: 40, radius: 36, fill: "#ddd6fe", stroke: "#a78bfa", strokeWidth: 3 },
      { type: "textbox", text: "\u2295", fontSize: 28, fill: "#8b5cf6", textAlign: "center", top: 60, left: 20, width: 80 },
      { type: "textbox", text: "@yourbrand", fontSize: 22, fontWeight: "bold", fill: "#0f172a", textAlign: "left", top: 60, left: 130, width: 500 },
      { type: "textbox", text: "Brooklyn, NY", fontSize: 14, fill: "#64748b", textAlign: "left", top: 90, left: 130, width: 400 },
      // Photo placeholder frame (square)
      { type: "rect", top: 160, left: 40, width: 1000, height: 1000, fill: "#f1f5f9", rx: 8, ry: 8 },
      { type: "rect", top: 160, left: 40, width: 1000, height: 1000, fill: "transparent", stroke: "#cbd5e1", strokeWidth: 2, rx: 8, ry: 8 },
      // Decorative circle inside photo area
      { type: "circle", top: 580, left: 430, radius: 80, fill: "rgba(99,102,241,0.15)" },
      { type: "textbox", text: "\u2295  drop your photo here", fontSize: 28, fill: "#94a3b8", textAlign: "center", top: 620, left: 140, width: 800 },
      // Caption
      { type: "textbox", text: "Your caption starts here. Share the moment, tell the story, add a few #hashtags.", fontSize: 18, fill: "#0f172a", textAlign: "left", top: 1210, left: 40, width: 1000, lineHeight: 1.5 },
      // Action row icons (heart/comment/share approximated)
      { type: "textbox", text: "\u2661      \uD83D\uDCAC      \u2197", fontSize: 28, fill: "#0f172a", textAlign: "left", top: 1290, left: 40, width: 400 },
    ],
  },

  // 15. PODCAST COVER — microphone-inspired circular mark + episode info
  {
    id: "t-podcast",
    name: "Podcast Cover",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#1e1b4b",
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #be185d 100%)",
    elements: [
      // Concentric decorative rings (mic iconography)
      { type: "circle", top: 260, left: 340, radius: 220, fill: "transparent", stroke: "rgba(255,255,255,0.15)", strokeWidth: 2 },
      { type: "circle", top: 310, left: 390, radius: 170, fill: "transparent", stroke: "rgba(255,255,255,0.25)", strokeWidth: 2 },
      { type: "circle", top: 360, left: 440, radius: 120, fill: "#fef08a" },
      // Mic glyph (use a unicode mic)
      { type: "textbox", text: "\uD83C\uDFA4", fontSize: 140, fill: "#1e1b4b", textAlign: "center", top: 385, left: 400, width: 280 },
      // Show badge
      { type: "rect", top: 680, left: 380, width: 320, height: 48, fill: "#fef08a", rx: 24, ry: 24 },
      { type: "textbox", text: "EPISODE 47", fontSize: 20, fontWeight: "bold", fill: "#1e1b4b", textAlign: "center", top: 694, left: 380, width: 320, charSpacing: 400 },
      // Episode title
      { type: "textbox", text: "The Future of\nRemote Work", fontSize: 64, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 760, left: 40, width: 1000, fontFamily: "Playfair Display", fontStyle: "italic", lineHeight: 1.0 },
      // Host
      { type: "textbox", text: "with Jamie Rivera", fontSize: 20, fill: "rgba(255,255,255,0.7)", textAlign: "center", top: 930, left: 190, width: 700, charSpacing: 200 },
      // Waveform hint (a row of vertical bars)
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((i) => ({
        type: "rect" as const,
        top: 990 + (i % 2 === 0 ? 0 : -8),
        left: 420 + i * 16,
        width: 4,
        height: 20 + (i % 3) * 10,
        fill: "rgba(254,240,138,0.8)",
      })),
    ],
  },

  // 16. BEFORE / AFTER — split layout with diagonal divider
  {
    id: "t-before-after",
    name: "Before / After",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#f8fafc",
    gradient: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
    elements: [
      // Left half — "Before" muted
      { type: "rect", top: 0, left: 0, width: 540, height: 1080, fill: "#e2e8f0" },
      { type: "textbox", text: "BEFORE", fontSize: 28, fontWeight: "bold", fill: "#64748b", textAlign: "center", top: 60, left: 0, width: 540, charSpacing: 400 },
      { type: "rect", top: 200, left: 70, width: 400, height: 400, fill: "#cbd5e1", rx: 16, ry: 16 },
      { type: "textbox", text: "\u2295  old photo", fontSize: 24, fill: "#64748b", textAlign: "center", top: 380, left: 70, width: 400 },
      // Right half — "After" with brand color
      { type: "rect", top: 0, left: 540, width: 540, height: 1080, fill: "#6366f1" },
      { type: "textbox", text: "AFTER", fontSize: 28, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 60, left: 540, width: 540, charSpacing: 400 },
      { type: "rect", top: 200, left: 610, width: 400, height: 400, fill: "#818cf8", rx: 16, ry: 16 },
      { type: "textbox", text: "\u2295  new photo", fontSize: 24, fill: "#c7d2fe", textAlign: "center", top: 380, left: 610, width: 400 },
      // Center circle with VS
      { type: "circle", top: 440, left: 470, radius: 70, fill: "#fef08a", stroke: "#1e293b", strokeWidth: 6 },
      { type: "textbox", text: "VS", fontSize: 44, fontWeight: "bold", fill: "#1e293b", textAlign: "center", top: 475, left: 470, width: 140 },
      // Bottom headline spanning full width
      { type: "rect", top: 720, left: 0, width: 1080, height: 360, fill: "#0f172a" },
      { type: "textbox", text: "The Transformation", fontSize: 52, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 770, left: 40, width: 1000, fontFamily: "Playfair Display", fontStyle: "italic" },
      { type: "textbox", text: "See the difference our solution makes", fontSize: 22, fill: "rgba(255,255,255,0.7)", textAlign: "center", top: 870, left: 140, width: 800 },
      // CTA
      { type: "rect", top: 940, left: 390, width: 300, height: 64, fill: "#fef08a", rx: 32, ry: 32 },
      { type: "textbox", text: "LEARN MORE", fontSize: 18, fontWeight: "bold", fill: "#0f172a", textAlign: "center", top: 961, left: 390, width: 300, charSpacing: 400 },
    ],
  },

  // 17. TEAM SPOTLIGHT — 3 avatar circles + names
  {
    id: "t-team",
    name: "Team Spotlight",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#0f172a",
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    elements: [
      // Eyebrow
      { type: "textbox", text: "MEET THE TEAM", fontSize: 20, fontWeight: "bold", fill: "#fef08a", textAlign: "center", top: 120, left: 240, width: 600, charSpacing: 600 },
      // Title
      { type: "textbox", text: "The People Behind\nYour Favorite Brand", fontSize: 52, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 180, left: 40, width: 1000, fontFamily: "Playfair Display", lineHeight: 1.2 },
      // Divider
      { type: "rect", top: 360, left: 490, width: 100, height: 3, fill: "#fef08a" },
      // Three avatar circles
      { type: "circle", top: 440, left: 180, radius: 90, fill: "#818cf8", stroke: "#6366f1", strokeWidth: 4 },
      { type: "circle", top: 440, left: 460, radius: 90, fill: "#f472b6", stroke: "#ec4899", strokeWidth: 4 },
      { type: "circle", top: 440, left: 740, radius: 90, fill: "#34d399", stroke: "#10b981", strokeWidth: 4 },
      // Avatar placeholder glyphs
      { type: "textbox", text: "\uD83D\uDC64", fontSize: 80, fill: "#ffffff", textAlign: "center", top: 475, left: 140, width: 180, opacity: 0.85 },
      { type: "textbox", text: "\uD83D\uDC64", fontSize: 80, fill: "#ffffff", textAlign: "center", top: 475, left: 420, width: 180, opacity: 0.85 },
      { type: "textbox", text: "\uD83D\uDC64", fontSize: 80, fill: "#ffffff", textAlign: "center", top: 475, left: 700, width: 180, opacity: 0.85 },
      // Names
      { type: "textbox", text: "Alex", fontSize: 24, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 650, left: 140, width: 180 },
      { type: "textbox", text: "Jordan", fontSize: 24, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 650, left: 420, width: 180 },
      { type: "textbox", text: "Taylor", fontSize: 24, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 650, left: 700, width: 180 },
      // Roles
      { type: "textbox", text: "Designer", fontSize: 14, fill: "#94a3b8", textAlign: "center", top: 685, left: 140, width: 180, charSpacing: 200 },
      { type: "textbox", text: "Engineer", fontSize: 14, fill: "#94a3b8", textAlign: "center", top: 685, left: 420, width: 180, charSpacing: 200 },
      { type: "textbox", text: "Founder", fontSize: 14, fill: "#94a3b8", textAlign: "center", top: 685, left: 700, width: 180, charSpacing: 200 },
      // Footer bar
      { type: "rect", top: 830, left: 0, width: 1080, height: 250, fill: "rgba(254,240,138,0.05)" },
      { type: "textbox", text: "Together we build things\nthat matter.", fontSize: 28, fontStyle: "italic", fill: "#fef08a", textAlign: "center", top: 870, left: 90, width: 900, fontFamily: "Playfair Display", lineHeight: 1.3 },
    ],
  },
];

/**
 * Renders a scaled-down layered preview of a starter template as stacked
 * absolutely-positioned divs. Each shape/line/text becomes its own element
 * scaled by (containerWidth / template.width), so the visual layout matches
 * what will actually land on the canvas on apply. Much better than the
 * previous "gradient + one line of text" thumbnail which made every
 * template look the same.
 *
 * Text is heavily downscaled and clamped to a minimum visible size to keep
 * it readable at ~140px wide. Font-family isn't loaded for thumbnails —
 * the browser falls back to a generic sans-serif, which is fine at this
 * scale.
 */
function StarterThumbnail({ template }: { template: StarterTemplate }) {
  // Use useRef-style scale computation with CSS: the container is the full
  // panel-card size; we scale children by its own computed width at render.
  // To avoid layout-measurement cycles, we render the inner box at the
  // template's native dimensions and apply a CSS transform: scale().
  // Container uses padding-bottom trick to preserve the template's aspect
  // ratio regardless of thumbnail width.
  const aspectPct = (template.height / template.width) * 100;
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ paddingBottom: `${aspectPct}%`, background: template.gradient }}
    >
      {/* Absolute container at native template dimensions — scaled via CSS. */}
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: `${template.width}px`,
          height: `${template.height}px`,
          transform: `scale(calc(100% / ${template.width}))`,
        }}
      >
        {template.elements.map((el, idx) => {
          if (el.type === "rect") {
            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: el.left,
                  top: el.top,
                  width: el.width,
                  height: el.height,
                  background: el.fill !== "transparent" ? el.fill : undefined,
                  border: el.stroke ? `${el.strokeWidth ?? 1}px solid ${el.stroke}` : undefined,
                  borderRadius: el.rx ? el.rx : 0,
                  opacity: el.opacity ?? 1,
                  transform: el.angle ? `rotate(${el.angle}deg)` : undefined,
                  transformOrigin: "center",
                }}
              />
            );
          }
          if (el.type === "circle") {
            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: el.left,
                  top: el.top,
                  width: el.radius * 2,
                  height: el.radius * 2,
                  background: el.fill !== "transparent" ? el.fill : undefined,
                  border: el.stroke ? `${el.strokeWidth ?? 1}px solid ${el.stroke}` : undefined,
                  borderRadius: "50%",
                  opacity: el.opacity ?? 1,
                }}
              />
            );
          }
          if (el.type === "line") {
            const [x1, y1, x2, y2] = el.coords;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: x1,
                  top: y1,
                  width: length,
                  height: el.strokeWidth ?? 2,
                  background: el.stroke,
                  opacity: el.opacity ?? 1,
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: "0 50%",
                }}
              />
            );
          }
          if (el.type === "textbox") {
            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: el.left,
                  top: el.top,
                  width: el.width,
                  color: el.fill,
                  fontFamily: el.fontFamily || "Inter, system-ui, sans-serif",
                  fontSize: el.fontSize,
                  fontWeight: (el.fontWeight as React.CSSProperties["fontWeight"]) || "normal",
                  fontStyle: el.fontStyle || "normal",
                  textAlign: el.textAlign as React.CSSProperties["textAlign"],
                  lineHeight: el.lineHeight ?? 1.2,
                  letterSpacing: el.charSpacing ? `${el.charSpacing / 1000}em` : undefined,
                  opacity: el.opacity ?? 1,
                  whiteSpace: "pre-wrap",
                  pointerEvents: "none",
                  overflow: "hidden",
                }}
              >
                {el.text}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export function TemplatesPanel() {
  const canvas = useCanvasStore((s) => s.canvas);
  const setCanvasDimensions = useCanvasStore((s) => s.setCanvasDimensions);
  const refreshLayers = useCanvasStore((s) => s.refreshLayers);
  const { toast } = useToast();

  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/design-templates?${params}`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch {
      // fail silently
    }
    setLoading(false);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filteredStarters = STARTER_TEMPLATES.filter((t) => {
    if (selectedCategory && t.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.category.includes(q);
    }
    return true;
  });

  // Asks the user whether to save their current design before we clobber
  // the canvas with a new template. Returns true if the apply should
  // proceed (user picked either "save & continue" or "discard"), false
  // if they want to bail. Skipped when there are no unsaved changes.
  const confirmBeforeClobber = async (templateName: string): Promise<boolean> => {
    const store = useCanvasStore.getState();
    if (!store.isDirty) return true;
    const save = await confirmDialog({
      title: "Unsaved changes",
      description: `"${store.designName}" has unsaved changes. Save it before applying the "${templateName}" template?`,
      confirmText: "Save & continue",
      cancelText: "Discard changes",
    });
    if (save) {
      document.dispatchEvent(new Event("studio:save"));
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && useCanvasStore.getState().isDirty) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    // Whether user picked Save or Discard, we proceed with the apply.
    // (There's no "cancel" path — the two-button confirmDialog returns
    // true for confirm and false for cancel, which we treat as "discard
    // and proceed" since that's less confusing than a third option.)
    return true;
  };

  const handleApplyStarter = async (template: StarterTemplate) => {
    if (!canvas) return;
    if (!(await confirmBeforeClobber(template.name))) return;
    setApplyingId(template.id);
    try {
      canvas.clear();
      // Sync dimensions BOTH on the store and directly on Fabric so the
      // canvas is at the right size before we add elements — otherwise
      // positions apply to a canvas still at the previous template's size.
      setCanvasDimensions(template.width, template.height);
      canvas.setDimensions({ width: template.width, height: template.height });

      // Apply gradient background via a full-canvas rect since Fabric
      // doesn't apply CSS gradient strings. Starts/stops are parsed out
      // of the template.gradient string so templates stay declarative.
      const fabric = await import("fabric");
      if (template.gradient) {
        const stops = parseGradient(template.gradient);
        if (stops) {
          const bg = new fabric.Rect({
            left: 0,
            top: 0,
            originX: "left",
            originY: "top",
            width: template.width,
            height: template.height,
            selectable: false,
            evented: false,
            fill: new fabric.Gradient({
              type: "linear",
              coords: stops.coords(template.width, template.height),
              colorStops: stops.colorStops,
            }),
          });
          (bg as unknown as { id: string }).id = "starter-bg";
          canvas.add(bg);
        } else {
          canvas.backgroundColor = template.bgColor;
        }
      } else {
        canvas.backgroundColor = template.bgColor;
      }

      for (const el of template.elements) {
        if (el.type === "textbox") {
          const opts: Record<string, unknown> = {
            text: el.text,
            fontSize: el.fontSize,
            fontWeight: el.fontWeight || "normal",
            fontStyle: el.fontStyle || "normal",
            fontFamily: el.fontFamily || "Inter",
            fill: el.fill,
            textAlign: el.textAlign,
            top: el.top,
            left: el.left,
            width: el.width,
            originX: "left",
            originY: "top",
          };
          if (el.charSpacing) opts.charSpacing = el.charSpacing;
          if (el.lineHeight) opts.lineHeight = el.lineHeight;
          if (el.shadow) opts.shadow = el.shadow;
          if (el.opacity !== undefined) opts.opacity = el.opacity;
          canvas.add(createTextbox(fabric, opts));
        } else if (el.type === "rect") {
          canvas.add(new fabric.Rect({
            left: el.left,
            top: el.top,
            width: el.width,
            height: el.height,
            fill: el.fill,
            stroke: el.stroke,
            strokeWidth: el.strokeWidth,
            rx: el.rx,
            ry: el.ry,
            opacity: el.opacity ?? 1,
            angle: el.angle ?? 0,
            originX: "left",
            originY: "top",
          }));
        } else if (el.type === "circle") {
          canvas.add(new fabric.Circle({
            left: el.left,
            top: el.top,
            radius: el.radius,
            fill: el.fill,
            stroke: el.stroke,
            strokeWidth: el.strokeWidth,
            opacity: el.opacity ?? 1,
            originX: "left",
            originY: "top",
          }));
        } else if (el.type === "line") {
          canvas.add(new fabric.Line(el.coords, {
            stroke: el.stroke,
            strokeWidth: el.strokeWidth ?? 2,
            opacity: el.opacity ?? 1,
            selectable: true,
            originX: "left",
            originY: "top",
          }));
        }
      }
      canvas.renderAll();
      refreshLayers();
      toast({ title: "Template applied!" });
    } catch {
      toast({ title: "Failed to apply template", variant: "destructive" });
    } finally {
      setApplyingId(null);
    }
  };

  // Parses "linear-gradient(135deg, #xxx 0%, #yyy 100%)" into { coords, colorStops }.
  // Returns null on unrecognized input so caller falls back to bgColor.
  function parseGradient(spec: string): {
    coords: (w: number, h: number) => { x1: number; y1: number; x2: number; y2: number };
    colorStops: Array<{ offset: number; color: string }>;
  } | null {
    const m = spec.match(/linear-gradient\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(",").map((s) => s.trim());
    // First part is the angle (or "to {direction}"); remaining are stops
    const angleMatch = parts[0].match(/^(\d+)deg$/);
    const angle = angleMatch ? parseInt(angleMatch[1], 10) : 135;
    const stopParts = parts.slice(angleMatch ? 1 : 0);
    const colorStops: Array<{ offset: number; color: string }> = [];
    for (const sp of stopParts) {
      const mm = sp.match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*(\d+)%?$/);
      if (!mm) continue;
      colorStops.push({ color: mm[1], offset: parseInt(mm[2], 10) / 100 });
    }
    if (colorStops.length < 2) return null;
    const rad = (angle - 90) * (Math.PI / 180);
    return {
      colorStops,
      coords: (w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.max(w, h);
        return {
          x1: cx - Math.cos(rad) * r / 2,
          y1: cy - Math.sin(rad) * r / 2,
          x2: cx + Math.cos(rad) * r / 2,
          y2: cy + Math.sin(rad) * r / 2,
        };
      },
    };
  }

  const handleApplyTemplate = async (template: DesignTemplate) => {
    if (!canvas) return;
    if (!(await confirmBeforeClobber(template.name))) return;
    setApplyingId(template.id);
    try {
      if (template.canvasData) {
        // Sync dimensions from the template's preset BEFORE loading the
        // canvas JSON, otherwise objects land on a canvas that's still at
        // the previous design's size (same bug class as design reload).
        const presetMatch = template.preset?.match(/(\d+)\s*x\s*(\d+)/i);
        if (presetMatch) {
          const w = parseInt(presetMatch[1], 10);
          const h = parseInt(presetMatch[2], 10);
          if (w && h) {
            setCanvasDimensions(w, h);
            canvas.setDimensions({ width: w, height: h });
          }
        }
        await safeLoadFromJSON(canvas, template.canvasData);
        refreshLayers();
        setApplyingId(null);
        return;
      }
      const imageUrl = template.image || template.thumbnail;
      if (!imageUrl) return;

      const presetMatch = template.preset?.match(/(\d+)\s*x\s*(\d+)/i);
      if (presetMatch) {
        setCanvasDimensions(parseInt(presetMatch[1]), parseInt(presetMatch[2]));
      }
      const fabric = await import("fabric");
      await addImageToCanvas(canvas, imageUrl, fabric, { left: 0, top: 0, selectable: true });
      toast({ title: "Template applied!" });
    } catch {
      toast({ title: "Failed to apply template", variant: "destructive" });
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="p-3">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-brand-500" />
        Templates
      </h3>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <Badge
          variant={selectedCategory === null ? "default" : "outline"}
          className="cursor-pointer text-[10px] transition-all hover:scale-105"
          onClick={() => setSelectedCategory(null)}
        >
          <LayoutGrid className="h-3 w-3 mr-1" />
          All
        </Badge>
        {DESIGN_CATEGORIES.map((cat) => (
          <Badge
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            className="cursor-pointer text-[10px] transition-all hover:scale-105"
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            {cat.name}
          </Badge>
        ))}
      </div>

      {filteredStarters.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Starter Templates
          </div>
          <div className="grid grid-cols-2 gap-2">
            {filteredStarters.map((template, i) => (
              <motion.button
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                onClick={() => handleApplyStarter(template)}
                disabled={applyingId === template.id}
                className={cn(
                  "relative rounded-lg overflow-hidden border border-border hover:border-brand-500 transition-all group",
                  template.width > template.height ? "aspect-video" : template.height > template.width * 1.5 ? "aspect-[9/16]" : "aspect-square"
                )}
              >
                {/* Layered preview of the actual template composition */}
                <StarterThumbnail template={template} />
                {applyingId === template.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <AISpinner className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-white text-[10px] font-medium truncate">{template.name}</p>
                  <p className="text-white/60 text-[9px]">{template.width}x{template.height}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <AISpinner className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Gallery</div>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((template, i) => (
              <motion.button
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                onClick={() => handleApplyTemplate(template)}
                disabled={applyingId === template.id}
                className="relative aspect-[3/4] rounded-lg overflow-hidden border border-border hover:border-brand-500 transition-all group"
              >
                {applyingId === template.id ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <AISpinner className="h-5 w-5 animate-spin text-brand-500" />
                  </div>
                ) : (
                  <img src={template.thumbnail || template.image} alt={template.name} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-white text-xs font-medium truncate">{template.name}</p>
                    <p className="text-white/70 text-[10px]">{template.preset}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      ) : null}

      {filteredStarters.length === 0 && !loading && templates.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No templates found</p>
          <p className="text-xs mt-1">Try a different category or search</p>
        </div>
      )}
    </div>
  );
}
