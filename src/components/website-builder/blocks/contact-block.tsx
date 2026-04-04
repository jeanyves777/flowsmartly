"use client";

import { useState } from "react";
import type { WebsiteBlock, WebsiteTheme, ContactContent } from "@/types/website-builder";
import { Mail, Phone, MapPin, Send, CheckCircle } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; siteSlug?: string; }

export function ContactBlock({ block, isEditing, siteSlug }: Props) {
  const content = block.content as ContactContent;
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isEditing) return;
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const data: Record<string, string> = {};
      formData.forEach((v, k) => { data[k] = v.toString(); });
      await fetch(`/sites/${siteSlug}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId: block.id, data }),
      });
      setSubmitted(true);
    } catch {}
    setLoading(false);
  };

  const isSplit = block.variant === "split" || block.variant === "with-map";

  return (
    <div className="py-16 sm:py-24">
      {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
      {content.description && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-12 max-w-2xl mx-auto">{content.description}</p>}

      <div className={`${isSplit ? "grid grid-cols-1 lg:grid-cols-2 gap-12" : "max-w-xl mx-auto"}`}>
        {submitted ? (
          <div className="text-center py-12 space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <p className="text-lg font-medium">{content.successMessage || "Thank you! We'll be in touch."}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {content.fields.map((field, i) => (
              <div key={i}>
                <label className="block text-sm font-medium mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    name={field.name}
                    required={field.required}
                    placeholder={field.placeholder}
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-[var(--wb-button-radius)] border border-[var(--wb-border)] bg-[var(--wb-background)] focus:outline-none focus:ring-2 focus:ring-[var(--wb-primary)]/30 focus:border-[var(--wb-primary)] transition-colors resize-none"
                  />
                ) : field.type === "select" ? (
                  <select
                    name={field.name}
                    required={field.required}
                    className="w-full px-4 py-2.5 rounded-[var(--wb-button-radius)] border border-[var(--wb-border)] bg-[var(--wb-background)] focus:outline-none focus:ring-2 focus:ring-[var(--wb-primary)]/30 focus:border-[var(--wb-primary)]"
                  >
                    <option value="">{field.placeholder || "Select..."}</option>
                    {field.options?.map((opt, j) => <option key={j} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type === "phone" ? "tel" : field.type}
                    name={field.name}
                    required={field.required}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2.5 rounded-[var(--wb-button-radius)] border border-[var(--wb-border)] bg-[var(--wb-background)] focus:outline-none focus:ring-2 focus:ring-[var(--wb-primary)]/30 focus:border-[var(--wb-primary)] transition-colors"
                  />
                )}
              </div>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[var(--wb-primary)] text-white rounded-[var(--wb-button-radius)] font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {loading ? "Sending..." : content.submitText || "Send Message"}
            </button>
          </form>
        )}

        {isSplit && content.showInfo && (
          <div className="space-y-6">
            {content.email && (
              <div className="flex items-start gap-4">
                <Mail className="w-5 h-5 text-[var(--wb-primary)] mt-1" />
                <div>
                  <p className="font-medium">Email</p>
                  <a href={`mailto:${content.email}`} className="text-[var(--wb-text-muted)] hover:text-[var(--wb-primary)]">{content.email}</a>
                </div>
              </div>
            )}
            {content.phone && (
              <div className="flex items-start gap-4">
                <Phone className="w-5 h-5 text-[var(--wb-primary)] mt-1" />
                <div>
                  <p className="font-medium">Phone</p>
                  <a href={`tel:${content.phone}`} className="text-[var(--wb-text-muted)] hover:text-[var(--wb-primary)]">{content.phone}</a>
                </div>
              </div>
            )}
            {content.address && (
              <div className="flex items-start gap-4">
                <MapPin className="w-5 h-5 text-[var(--wb-primary)] mt-1" />
                <div>
                  <p className="font-medium">Address</p>
                  <p className="text-[var(--wb-text-muted)]">{content.address}</p>
                </div>
              </div>
            )}
            {block.variant === "with-map" && content.mapAddress && (
              <div className="mt-6 rounded-xl overflow-hidden border border-[var(--wb-border)] h-64">
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(content.mapAddress)}&output=embed`}
                  className="w-full h-full"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
