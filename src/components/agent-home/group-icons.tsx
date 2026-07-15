"use client";

/**
 * Maps the lucide icon NAMES stored in the agent-groups taxonomy
 * (`AGENT_GROUPS`) to their components, so both the composer switcher and the
 * home card-grid menus can render them. Keep in sync with the `icon` fields in
 * `@/lib/ai/flow-agent/agent-groups`.
 */

import {
  Palette, Clapperboard, Send, TrendingUp, Users, ShoppingBag, Globe, Building2,
  Image, Sparkles, Printer, Scissors, Images, Video, Film, UserSquare2, Mic,
  SquarePen, CalendarDays, Link2, Rss, Mail, MessageSquare, Workflow, Megaphone,
  Search, Target, FileText, Star, ClipboardList, UsersRound, Store, Package, Truck,
  LayoutTemplate, Briefcase, BarChart3, Brain, CreditCard, type LucideIcon,
} from "lucide-react";

export const GROUP_ICON: Record<string, LucideIcon> = {
  Palette, Clapperboard, Send, TrendingUp, Users, ShoppingBag, Globe, Building2,
  Image, Sparkles, Printer, Scissors, Images, Video, Film, UserSquare2, Mic,
  SquarePen, CalendarDays, Link2, Rss, Mail, MessageSquare, Workflow, Megaphone,
  Search, Target, FileText, Star, ClipboardList, UsersRound, Store, Package, Truck,
  LayoutTemplate, Briefcase, BarChart3, Brain, CreditCard,
};

/** Resolve an icon name to a component, falling back to Sparkles. */
export function groupIcon(name: string | undefined): LucideIcon {
  return (name && GROUP_ICON[name]) || Sparkles;
}
