"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  // Communication
  Mail, Phone, MessageCircle, MessageSquare, Send, Bell, AtSign,
  // Social
  Heart, Star, ThumbsUp, Share2, Bookmark, Award,
  // Navigation
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ArrowUpRight, ChevronRight, ExternalLink, MapPin, Compass, Navigation,
  // Status
  Check, CheckCircle, X, XCircle, AlertTriangle, AlertCircle, Info, HelpCircle, ShieldCheck, Lock,
  // Commerce
  ShoppingCart, ShoppingBag, CreditCard, DollarSign, Tag, Percent, Gift, Wallet, Receipt, TrendingUp,
  // Time
  Clock, Calendar, CalendarDays, Timer, History,
  // Media
  Image as ImageIcon, Camera, Video, Music, Headphones, Mic, Play, Pause,
  // Files
  FileText, File, FileImage, FileVideo, FolderOpen, Download, Upload, Save, Paperclip,
  // People
  User, Users, UserCheck, UserPlus,
  // Tools
  Search, Filter, Settings, Sliders, Wrench, Pencil, Eraser, Eye, EyeOff,
  // Tech
  Wifi, Battery, Cpu, Monitor, Smartphone, Laptop, Cloud, Database,
  // Misc
  Sparkles, Zap, Flame, Sun, Moon, Cloud as CloudIcon, Coffee, Pizza, Truck, Plane, Car,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";
import { useCanvasStore } from "../hooks/use-canvas-store";

interface IconItem {
  Icon: React.ElementType;
  label: string;
  keywords: string;
}

// Curated icon library — ~80 of the most-useful design icons. Each entry is
// keyword-tagged so the search box matches synonyms (e.g. typing "love"
// surfaces Heart even though "love" isn't in the icon name).
const ICONS: IconItem[] = [
  // Communication
  { Icon: Mail, label: "Mail", keywords: "email message inbox letter" },
  { Icon: Phone, label: "Phone", keywords: "call telephone contact" },
  { Icon: MessageCircle, label: "Message", keywords: "chat bubble talk comment" },
  { Icon: MessageSquare, label: "Chat", keywords: "comment talk reply discussion" },
  { Icon: Send, label: "Send", keywords: "submit deliver paper-plane share" },
  { Icon: Bell, label: "Bell", keywords: "notification alert ring reminder" },
  { Icon: AtSign, label: "At Sign", keywords: "email mention handle social" },

  // Social
  { Icon: Heart, label: "Heart", keywords: "love like favorite romance" },
  { Icon: Star, label: "Star", keywords: "favorite rating bookmark feature" },
  { Icon: ThumbsUp, label: "Thumbs Up", keywords: "like approve good positive vote" },
  { Icon: Share2, label: "Share", keywords: "send social network distribute" },
  { Icon: Bookmark, label: "Bookmark", keywords: "save read later flag" },
  { Icon: Award, label: "Award", keywords: "trophy badge winner achievement medal" },

  // Navigation
  { Icon: ArrowRight, label: "Arrow Right", keywords: "next forward continue" },
  { Icon: ArrowLeft, label: "Arrow Left", keywords: "back previous return" },
  { Icon: ArrowUp, label: "Arrow Up", keywords: "top scroll rise increase" },
  { Icon: ArrowDown, label: "Arrow Down", keywords: "bottom scroll fall decrease" },
  { Icon: ArrowUpRight, label: "Arrow Diagonal", keywords: "external launch open" },
  { Icon: ChevronRight, label: "Chevron", keywords: "next forward menu disclose" },
  { Icon: ExternalLink, label: "External", keywords: "link open new-tab" },
  { Icon: MapPin, label: "Map Pin", keywords: "location address place geo" },
  { Icon: Compass, label: "Compass", keywords: "direction navigate explore" },
  { Icon: Navigation, label: "Navigation", keywords: "compass arrow direction location" },

  // Status
  { Icon: Check, label: "Check", keywords: "done complete success ok yes" },
  { Icon: CheckCircle, label: "Check Circle", keywords: "done complete success verified" },
  { Icon: X, label: "Close", keywords: "cancel dismiss remove no" },
  { Icon: XCircle, label: "X Circle", keywords: "error fail invalid no" },
  { Icon: AlertTriangle, label: "Warning", keywords: "caution alert danger attention" },
  { Icon: AlertCircle, label: "Alert", keywords: "warning notice attention" },
  { Icon: Info, label: "Info", keywords: "information help tip note" },
  { Icon: HelpCircle, label: "Help", keywords: "question support faq info" },
  { Icon: ShieldCheck, label: "Shield Check", keywords: "secure safe verified protected" },
  { Icon: Lock, label: "Lock", keywords: "secure private protected closed" },

  // Commerce
  { Icon: ShoppingCart, label: "Cart", keywords: "shop buy ecommerce checkout" },
  { Icon: ShoppingBag, label: "Bag", keywords: "shop buy purchase store" },
  { Icon: CreditCard, label: "Credit Card", keywords: "payment pay checkout money" },
  { Icon: DollarSign, label: "Dollar", keywords: "money price cost currency usd" },
  { Icon: Tag, label: "Tag", keywords: "price sale label discount" },
  { Icon: Percent, label: "Percent", keywords: "discount sale off promotion" },
  { Icon: Gift, label: "Gift", keywords: "present box reward bonus" },
  { Icon: Wallet, label: "Wallet", keywords: "money pay payment balance" },
  { Icon: Receipt, label: "Receipt", keywords: "invoice bill payment order" },
  { Icon: TrendingUp, label: "Trending Up", keywords: "growth chart increase rise stocks" },

  // Time
  { Icon: Clock, label: "Clock", keywords: "time hour schedule" },
  { Icon: Calendar, label: "Calendar", keywords: "date schedule month event" },
  { Icon: CalendarDays, label: "Calendar Days", keywords: "date schedule planner appointment" },
  { Icon: Timer, label: "Timer", keywords: "stopwatch countdown duration" },
  { Icon: History, label: "History", keywords: "past recent log timeline" },

  // Media
  { Icon: ImageIcon, label: "Image", keywords: "photo picture gallery media" },
  { Icon: Camera, label: "Camera", keywords: "photo picture snap capture" },
  { Icon: Video, label: "Video", keywords: "movie film clip recording" },
  { Icon: Music, label: "Music", keywords: "audio song note sound" },
  { Icon: Headphones, label: "Headphones", keywords: "audio music podcast listen" },
  { Icon: Mic, label: "Microphone", keywords: "audio record voice speak" },
  { Icon: Play, label: "Play", keywords: "start video media run" },
  { Icon: Pause, label: "Pause", keywords: "stop break wait media" },

  // Files
  { Icon: FileText, label: "Document", keywords: "file paper text article" },
  { Icon: File, label: "File", keywords: "document blank paper" },
  { Icon: FileImage, label: "File Image", keywords: "photo document attachment" },
  { Icon: FileVideo, label: "File Video", keywords: "movie document attachment" },
  { Icon: FolderOpen, label: "Folder", keywords: "directory storage organize" },
  { Icon: Download, label: "Download", keywords: "save get arrow-down" },
  { Icon: Upload, label: "Upload", keywords: "send arrow-up share" },
  { Icon: Save, label: "Save", keywords: "disk store keep persist" },
  { Icon: Paperclip, label: "Paperclip", keywords: "attach attachment file link" },

  // People
  { Icon: User, label: "User", keywords: "person profile account avatar" },
  { Icon: Users, label: "Users", keywords: "people team group members" },
  { Icon: UserCheck, label: "User Check", keywords: "verified approved person" },
  { Icon: UserPlus, label: "User Plus", keywords: "add invite signup person" },

  // Tools
  { Icon: Search, label: "Search", keywords: "find magnify lookup" },
  { Icon: Filter, label: "Filter", keywords: "sort funnel narrow refine" },
  { Icon: Settings, label: "Settings", keywords: "gear cog options preferences" },
  { Icon: Sliders, label: "Sliders", keywords: "adjust controls preferences" },
  { Icon: Wrench, label: "Wrench", keywords: "tool repair fix maintenance" },
  { Icon: Pencil, label: "Pencil", keywords: "edit write modify draw" },
  { Icon: Eraser, label: "Eraser", keywords: "delete remove clean" },
  { Icon: Eye, label: "Eye", keywords: "view show visible see" },
  { Icon: EyeOff, label: "Eye Off", keywords: "hide invisible private" },

  // Tech
  { Icon: Wifi, label: "Wifi", keywords: "wireless internet network signal" },
  { Icon: Battery, label: "Battery", keywords: "power energy charge level" },
  { Icon: Cpu, label: "CPU", keywords: "processor chip tech computing" },
  { Icon: Monitor, label: "Monitor", keywords: "screen display tv computer" },
  { Icon: Smartphone, label: "Phone", keywords: "mobile device smartphone" },
  { Icon: Laptop, label: "Laptop", keywords: "computer notebook macbook" },
  { Icon: Cloud, label: "Cloud", keywords: "weather sky storage online" },
  { Icon: Database, label: "Database", keywords: "storage data server" },

  // Misc
  { Icon: Sparkles, label: "Sparkles", keywords: "ai magic shine new feature" },
  { Icon: Zap, label: "Zap", keywords: "lightning fast power energy" },
  { Icon: Flame, label: "Flame", keywords: "fire hot trending popular" },
  { Icon: Sun, label: "Sun", keywords: "weather day light bright sunny" },
  { Icon: Moon, label: "Moon", keywords: "night dark sleep weather" },
  { Icon: CloudIcon, label: "Cloud", keywords: "weather sky cloudy" },
  { Icon: Coffee, label: "Coffee", keywords: "drink cafe morning food" },
  { Icon: Pizza, label: "Pizza", keywords: "food restaurant meal" },
  { Icon: Truck, label: "Truck", keywords: "delivery shipping vehicle transport" },
  { Icon: Plane, label: "Plane", keywords: "travel flight airplane transport" },
  { Icon: Car, label: "Car", keywords: "vehicle transport drive auto" },
];

const DEFAULT_FILL = "#1f2937"; // gray-800 — neutral, easy to recolor after add
const DEFAULT_SIZE = 96; // canvas pixels — big enough to see, small enough to fit anywhere

export function IconsPanel() {
  const canvas = useCanvasStore((s) => s.canvas);
  const refreshLayers = useCanvasStore((s) => s.refreshLayers);
  const setDirty = useCanvasStore((s) => s.setDirty);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICONS;
    return ICONS.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.keywords.toLowerCase().includes(q),
    );
  }, [query]);

  const handleAddIcon = async (item: IconItem) => {
    if (!canvas) return;
    const fabric = await import("fabric");

    // Render the lucide icon to an SVG string at a known size, then load
    // it into Fabric. We give every Path the same fill so the user can
    // recolor in one click via the shape properties panel.
    const Icon = item.Icon;
    const svgMarkup = renderToStaticMarkup(
      <Icon
        width={DEFAULT_SIZE}
        height={DEFAULT_SIZE}
        stroke={DEFAULT_FILL}
        strokeWidth={1.75}
        fill="none"
      />,
    );

    try {
      const result = await fabric.loadSVGFromString(svgMarkup);
      // fabric.loadSVGFromString returns { objects, options, elements, allElements }
      const objects = (result.objects || []).filter(Boolean) as any[];
      if (objects.length === 0) return;

      // Group multi-path icons into a single object so they move/scale together
      const obj =
        objects.length === 1
          ? objects[0]
          : new fabric.Group(objects, { subTargetCheck: false });

      // Center on canvas
      const cw = canvas.getWidth();
      const ch = canvas.getHeight();
      const w = obj.width || DEFAULT_SIZE;
      const h = obj.height || DEFAULT_SIZE;
      obj.set({
        left: (cw - w) / 2,
        top: (ch - h) / 2,
        originX: "left",
        originY: "top",
      });
      (obj as any).id = `icon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      (obj as any).customName = item.label;

      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      refreshLayers();
      setDirty(true);
    } catch (err) {
      console.error("[IconsPanel] Failed to add icon:", err);
    }
  };

  return (
    <div className="p-3 space-y-3">
      <h3 className="text-sm font-semibold">Icons</h3>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons..."
          className="h-8 pl-7 text-xs"
          aria-label="Search icons"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {filtered.map((item) => {
          const Icon = item.Icon;
          return (
            <button
              key={item.label}
              onClick={() => handleAddIcon(item)}
              className="flex items-center justify-center aspect-square rounded-md border border-border hover:border-brand-500 hover:bg-brand-500/5 transition-colors"
              title={item.label}
              aria-label={`Add ${item.label} icon to canvas`}
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No icons match &ldquo;{query}&rdquo;
        </p>
      )}

      <p className="text-[10px] text-muted-foreground/80 text-center pt-1">
        Click an icon to add it to your canvas. Recolor it from the properties panel.
      </p>
    </div>
  );
}
