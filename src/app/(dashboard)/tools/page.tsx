"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ClipboardList,
  ArrowRight,
  FileQuestion,
  Scissors,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const tools = [
  {
    name: "Follow-Ups",
    description: "Track contacts, record calls, and manage follow-up campaigns for sales and outreach.",
    href: "/tools/follow-ups",
    icon: ClipboardList,
    color: "from-blue-500 to-indigo-600",
    bgLight: "bg-blue-50 dark:bg-blue-950/30",
    available: true,
  },
  {
    name: "Surveys",
    description: "Create shareable surveys and forms to collect reviews, opinions, and customer feedback.",
    href: "/tools/surveys",
    icon: FileQuestion,
    color: "from-violet-500 to-purple-600",
    bgLight: "bg-violet-50 dark:bg-violet-950/30",
    available: true,
  },
  {
    name: "Events",
    description: "Create and manage events with registration, RSVP, ticket sales, and branded public pages.",
    href: "/tools/events",
    icon: CalendarDays,
    color: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
    available: true,
  },
  {
    name: "Background Remover",
    description: "Remove backgrounds from any image with AI precision. Perfect for product photos, logos, and design assets.",
    href: "/tools/background-remover",
    icon: Scissors,
    color: "from-rose-500 to-pink-600",
    bgLight: "bg-rose-50 dark:bg-rose-950/30",
    available: true,
  },
  {
    name: "More Tools",
    description: "Additional utilities coming soon — stay tuned for more powerful tools to grow your business.",
    href: "#",
    icon: BarChart3,
    color: "from-gray-400 to-gray-500",
    bgLight: "bg-gray-50 dark:bg-gray-950/30",
    available: false,
  },
];

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tools</h1>
        <p className="text-muted-foreground mt-1">
          Additional utilities to boost your workflow
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tools.map((tool, index) => (
          <motion.div
            key={tool.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            {tool.available ? (
              <Link href={tool.href}>
                <Card className="h-full hover:shadow-lg transition-all duration-200 group cursor-pointer border-2 hover:border-brand-500/30">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-4`}>
                      <tool.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-brand-500 transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {tool.description}
                    </p>
                    <div className="flex items-center text-sm font-medium text-brand-500 group-hover:gap-2 transition-all">
                      Open
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Card className="h-full opacity-60 border-dashed">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-4 opacity-50`}>
                    <tool.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {tool.description}
                  </p>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Coming Soon
                  </span>
                </CardContent>
              </Card>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
