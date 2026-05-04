"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { illustrationImages } from "@/components/marketing/public-page-visuals";

const proofItems = ["No credit card", "Free workspace", "Upgrade anytime"];

function HeroImagePair() {
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-[620px] sm:h-[460px] lg:h-[560px] lg:max-w-none">
      <div className="absolute inset-0">
        <Image
          src={illustrationImages.humanCreator}
          alt="A creator operating FlowSmartly campaigns"
          fill
          sizes="(min-width: 1024px) 560px, 92vw"
          unoptimized
          className="object-contain object-bottom drop-shadow-[0_30px_60px_rgba(15,23,42,0.24)] dark:drop-shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
          priority
        />
      </div>
    </div>
  );
}

export function HeroSection() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    router.push(
      trimmedEmail ? `/register?email=${encodeURIComponent(trimmedEmail)}` : "/register"
    );
  }

  return (
    <section className="relative isolate overflow-visible bg-background px-4 pb-2 pt-20 text-foreground sm:px-6 sm:pt-24 lg:px-8 dark:bg-[#020807] dark:text-white">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(240,249,255,0.84),rgba(255,255,255,0)_56%)] dark:bg-[linear-gradient(180deg,rgba(8,47,73,0.22),rgba(2,8,7,0)_58%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 lg:min-h-[460px] lg:grid-cols-[0.88fr_1.12fr] lg:gap-10">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur dark:border-white/15 dark:bg-white/10">
            <Sparkles className="h-4 w-4 text-brand-600 dark:text-emerald-300" />
            AI-powered growth workspace
          </div>
          <h1 className="text-balance text-3xl font-extrabold leading-[1.08] sm:text-4xl lg:text-[2.95rem]">
            <span className="block">Create, sell, and</span>
            <span className="block bg-gradient-to-r from-sky-400 via-emerald-300 to-violet-300 bg-clip-text text-transparent">
              grow with AI
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-muted-foreground dark:text-slate-300 lg:mx-0">
            Run content, commerce, local listings, customer messages, and
            reporting from one focused workspace.
          </p>
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-6 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center lg:mx-0"
          >
            <label className="flex min-h-14 flex-1 items-center rounded-lg border border-input bg-card px-4 text-left text-sm text-muted-foreground shadow-lg focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-white/15 dark:bg-white dark:text-slate-500">
              <span className="sr-only">Email address</span>
              <MessageSquare className="mr-3 h-5 w-5 shrink-0 text-muted-foreground dark:text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground dark:text-slate-900 dark:placeholder:text-slate-500"
              />
            </label>
            <Button type="submit" size="lg" className="min-h-14 px-8 text-base font-bold">
                Try free
                <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </form>
          <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground dark:text-slate-300 lg:justify-start">
            {proofItems.map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                {item}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.15 }}
          className="relative z-20 -mb-3 sm:-mb-4 lg:-mb-5"
        >
          <HeroImagePair />
        </motion.div>
      </div>
    </section>
  );
}
