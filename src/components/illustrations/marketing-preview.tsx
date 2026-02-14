"use client";

import { motion } from "framer-motion";
import { Mail, MessageSquare, Users, Megaphone, Send, CheckCircle2 } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const slideIn = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4 } },
};

const contacts = [
  { name: "Sarah M.", email: "sarah@...com", status: "Subscribed" },
  { name: "James K.", email: "james@...com", status: "Subscribed" },
  { name: "Emily R.", email: "emily@...com", status: "New" },
  { name: "Michael T.", email: "mike@...com", status: "Subscribed" },
];

export function MarketingPreview() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={container}
      className="relative rounded-xl overflow-hidden border shadow-xl bg-card"
    >
      <div className="p-6">
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold">Marketing Suite</h4>
            <p className="text-xs text-muted-foreground">Email & SMS campaigns</p>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Campaign cards */}
          <motion.div variants={container} className="space-y-3">
            {/* Email campaign */}
            <motion.div variants={fadeUp} className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-4 h-4 text-brand-500" />
                <span className="text-sm font-medium">Email Campaign</span>
                <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs">
                  Active
                </span>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Sent</span>
                  <span className="font-medium text-foreground">2,450</span>
                </div>
                <div className="flex justify-between">
                  <span>Opened</span>
                  <span className="font-medium text-foreground">1,832 (74.8%)</span>
                </div>
                <div className="flex justify-between">
                  <span>Clicked</span>
                  <span className="font-medium text-foreground">643 (26.2%)</span>
                </div>
              </div>
              <motion.div
                className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden"
                variants={fadeUp}
              >
                <motion.div
                  className="h-full rounded-full bg-brand-500"
                  initial={{ width: 0 }}
                  whileInView={{ width: "74.8%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                />
              </motion.div>
            </motion.div>

            {/* SMS campaign */}
            <motion.div variants={fadeUp} className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-accent-purple" />
                <span className="text-sm font-medium">SMS Campaign</span>
                <span className="ml-auto px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 text-xs">
                  Scheduled
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 rounded-lg bg-card border p-2.5">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-accent-purple mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Hey! Check out our latest AI features...
                    </p>
                  </div>
                </div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="w-8 h-8 rounded-full bg-accent-purple flex items-center justify-center flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </motion.div>
              </div>
            </motion.div>
          </motion.div>

          {/* Contact list */}
          <motion.div variants={fadeUp} className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-accent-purple" />
              <span className="text-sm font-medium">Contacts</span>
              <span className="ml-auto text-xs text-muted-foreground">2,450 total</span>
            </div>
            <motion.div variants={container} className="space-y-2">
              {contacts.map((contact) => (
                <motion.div
                  key={contact.name}
                  variants={slideIn}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-card transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-500/10 flex items-center justify-center text-xs font-medium text-brand-500">
                    {contact.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{contact.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{contact.email}</div>
                  </div>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
