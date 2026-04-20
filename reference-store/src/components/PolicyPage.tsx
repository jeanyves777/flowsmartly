"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Mail, Phone, MapPin } from "lucide-react";
import { storeInfo } from "@/lib/data";

interface PolicyPageProps {
  title: string;
  icon?: React.ReactNode;
  content: string;
  lastUpdated?: string;
}

export default function PolicyPage({ title, icon, content, lastUpdated }: PolicyPageProps) {
  return (
    <div className="pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 mb-6 mt-6">
          <Link href="/" className="hover:text-primary-600 transition-colors">Home</Link>
          <ChevronRight size={14} />
          <span className="text-gray-700 dark:text-gray-200 font-medium">{title}</span>
        </nav>

        {/* Branded header — uses store's primary color from globals.css */}
        <div className="mb-10">
          <div className="flex items-center gap-4">
            {icon && (
              <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                {title}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {storeInfo.name} · Last updated: {lastUpdated || "April 2026"}
              </p>
            </div>
          </div>
          <div className="h-1 w-20 rounded-full bg-primary-500 mt-5" />
        </div>

        {/* Policy content */}
        <article className="bg-white dark:bg-gray-900/30 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 sm:p-10">
          <div
            className="prose prose-lg dark:prose-invert max-w-none
              prose-headings:text-gray-900 dark:prose-headings:text-white
              prose-headings:font-semibold prose-headings:mt-8 prose-headings:mb-3
              prose-h2:text-2xl prose-h3:text-xl
              prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed
              prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline
              prose-li:text-gray-700 dark:prose-li:text-gray-300
              prose-strong:text-gray-900 dark:prose-strong:text-white"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </article>

        {/* Store contact card — on-brand, per-store */}
        <div className="mt-10 rounded-2xl border border-primary-200 dark:border-primary-900/50 bg-primary-50/50 dark:bg-primary-900/10 p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Questions about this policy?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Reach out to the {storeInfo.name} team — we're happy to help.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            {storeInfo.email && (
              <a
                href={`mailto:${storeInfo.email}`}
                className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <Mail size={16} className="text-primary-600 dark:text-primary-400" />
                {storeInfo.email}
              </a>
            )}
            {storeInfo.phone && (
              <a
                href={`tel:${storeInfo.phone}`}
                className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <Phone size={16} className="text-primary-600 dark:text-primary-400" />
                {storeInfo.phone}
              </a>
            )}
            {storeInfo.address && (
              <span className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <MapPin size={16} className="text-primary-600 dark:text-primary-400" />
                {storeInfo.address}
              </span>
            )}
          </div>
        </div>

        {/* Back to shop */}
        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to {storeInfo.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
