"use client";

import { use, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Send, AlertCircle } from "lucide-react";
import type { DataFormField } from "@/types/data-form";

interface BrandInfo {
  name: string;
  logo: string | null;
  iconLogo: string | null;
  colors: { primary?: string; secondary?: string; accent?: string };
  fonts: { heading?: string; body?: string };
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
}

interface FormPageData {
  title: string;
  description: string | null;
  fields: DataFormField[];
  thankYouMessage: string;
  brand: BrandInfo | null;
}

function PublicFormClient({ slug }: { slug: string }) {
  const [formData, setFormData] = useState<FormPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/data-forms/public/${slug}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setFormData(json.data);
        else setError(json.error?.message || "Form not found");
      })
      .catch(() => setError("Failed to load form"))
      .finally(() => setLoading(false));
  }, [slug]);

  const validate = (): boolean => {
    if (!formData) return false;
    const newErrors: Record<string, string> = {};
    for (const field of formData.fields) {
      const val = values[field.id];
      if (field.required && (!val || String(val).trim() === "")) {
        newErrors[field.id] = `${field.label} is required`;
      }
      if (val && field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
        newErrors[field.id] = "Please enter a valid email";
      }
      if (val && field.type === "url" && !/^https?:\/\/.+/.test(String(val))) {
        newErrors[field.id] = "Please enter a valid URL";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/data-forms/public/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: values }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
      } else {
        setError(json.error?.message || "Submission failed");
      }
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const setValue = (fieldId: string, value: unknown) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
  };

  const renderField = (field: DataFormField, index: number) => {
    const val = values[field.id] || "";
    const err = errors[field.id];
    const baseInputClass = "w-full px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-base";

    return (
      <motion.div
        key={field.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="space-y-1.5"
      >
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.helpText && <p className="text-xs text-gray-400">{field.helpText}</p>}

        {field.type === "textarea" ? (
          <textarea rows={4} value={String(val)} onChange={e => setValue(field.id, e.target.value)} placeholder={field.placeholder} className={baseInputClass} />
        ) : field.type === "select" ? (
          <select value={String(val)} onChange={e => setValue(field.id, e.target.value)} className={baseInputClass}>
            <option value="">{field.placeholder || "Select..."}</option>
            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : field.type === "radio" ? (
          <div className="space-y-2">
            {field.options?.map(opt => (
              <label key={opt} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <input type="radio" name={field.id} value={opt} checked={val === opt} onChange={() => setValue(field.id, opt)} className="w-4 h-4 text-blue-600" />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        ) : field.type === "checkbox" ? (
          <div className="space-y-2">
            {field.options?.map(opt => {
              const checked = Array.isArray(val) ? (val as string[]).includes(opt) : false;
              return (
                <label key={opt} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <input type="checkbox" checked={checked} onChange={e => {
                    const arr = Array.isArray(val) ? [...(val as string[])] : [];
                    if (e.target.checked) arr.push(opt); else arr.splice(arr.indexOf(opt), 1);
                    setValue(field.id, arr);
                  }} className="w-4 h-4 rounded text-blue-600" />
                  <span className="text-sm">{opt}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <input
            type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
            value={String(val)}
            onChange={e => setValue(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={baseInputClass}
          />
        )}

        {err && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {err}
          </motion.p>
        )}
      </motion.div>
    );
  };

  const primaryColor = formData?.brand?.colors?.primary || "#2563eb";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Form Unavailable</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!formData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header with brand */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          {formData.brand?.logo ? (
            <img src={formData.brand.logo} alt={formData.brand.name} className="h-12 mx-auto mb-3 object-contain" />
          ) : formData.brand?.iconLogo ? (
            <img src={formData.brand.iconLogo} alt={formData.brand.name} className="h-10 w-10 mx-auto mb-3 rounded-lg object-cover" />
          ) : null}
          {formData.brand?.name && (
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{formData.brand.name}</p>
          )}
        </div>
      </div>

      {/* Form content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="text-center py-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ backgroundColor: primaryColor + "20" }}
              >
                <Check className="h-10 w-10" style={{ color: primaryColor }} />
              </motion.div>
              <h2 className="text-2xl font-bold mb-3">{formData.thankYouMessage}</h2>
              <p className="text-gray-500">Your response has been recorded.</p>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">{formData.title}</h1>
                {formData.description && <p className="text-gray-500 text-base">{formData.description}</p>}
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                {formData.fields.map((field, i) => renderField(field, i))}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: formData.fields.length * 0.05 }}
                >
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {submitting ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</>
                    ) : (
                      <><Send className="h-5 w-5" /> Submit</>
                    )}
                  </button>
                </motion.div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer with brand contact + powered by */}
      <div className="border-t border-gray-200 dark:border-gray-800 mt-16">
        {formData.brand && (formData.brand.email || formData.brand.phone || formData.brand.website || formData.brand.address) && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="flex flex-wrap gap-4 justify-center text-sm text-gray-500">
              {formData.brand.email && <a href={`mailto:${formData.brand.email}`} className="hover:text-gray-700">{formData.brand.email}</a>}
              {formData.brand.phone && <a href={`tel:${formData.brand.phone}`} className="hover:text-gray-700">{formData.brand.phone}</a>}
              {formData.brand.website && <a href={formData.brand.website} target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">{formData.brand.website}</a>}
              {formData.brand.address && <span>{formData.brand.address}</span>}
            </div>
          </div>
        )}
        <div className="text-center py-4 text-xs text-gray-400">
          Powered by <a href="https://flowsmartly.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">FlowSmartly</a>
        </div>
      </div>
    </div>
  );
}

export default function FormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <PublicFormClient slug={slug} />;
}
