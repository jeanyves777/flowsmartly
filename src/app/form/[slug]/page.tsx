"use client";

import { use, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Send, AlertCircle, Search, UserCheck, Sparkles, Camera } from "lucide-react";
import type { DataFormField, DataFormType } from "@/types/data-form";

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
  type: DataFormType;
  title: string;
  description: string | null;
  fields: DataFormField[];
  thankYouMessage: string;
  brand: BrandInfo | null;
}

interface SearchResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  birthday: string | null;
}

interface MissingFieldInfo {
  key: string;
  label: string;
  type: string;
}

interface ExistingFieldInfo {
  key: string;
  label: string;
  value: string;
  fromSibling?: boolean;
}

// ─── STANDARD FORM ───────────────────────────────────────────────────
function StandardForm({
  formData,
  slug,
  primaryColor,
}: {
  formData: FormPageData;
  slug: string;
  primaryColor: string;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): boolean => {
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
      if (json.success) setSubmitted(true);
      else setError(json.error?.message || "Submission failed");
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const setValue = (fieldId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
  };

  const renderField = (field: DataFormField, index: number) => {
    const val = values[field.id] || "";
    const err = errors[field.id];
    const baseInputClass = "w-full px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-base";

    return (
      <motion.div key={field.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.helpText && <p className="text-xs text-gray-400">{field.helpText}</p>}

        {field.type === "textarea" ? (
          <textarea rows={4} value={String(val)} onChange={(e) => setValue(field.id, e.target.value)} placeholder={field.placeholder} className={baseInputClass} />
        ) : field.type === "select" ? (
          <select value={String(val)} onChange={(e) => setValue(field.id, e.target.value)} className={baseInputClass}>
            <option value="">{field.placeholder || "Select..."}</option>
            {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : field.type === "radio" ? (
          <div className="space-y-2">
            {field.options?.map((opt) => (
              <label key={opt} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <input type="radio" name={field.id} value={opt} checked={val === opt} onChange={() => setValue(field.id, opt)} className="w-4 h-4 text-blue-600" />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        ) : field.type === "checkbox" ? (
          <div className="space-y-2">
            {field.options?.map((opt) => {
              const checked = Array.isArray(val) ? (val as string[]).includes(opt) : false;
              return (
                <label key={opt} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <input type="checkbox" checked={checked} onChange={(e) => {
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
            onChange={(e) => setValue(field.id, e.target.value)}
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

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="text-center py-16"
      >
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: primaryColor + "20" }}>
          <Check className="h-10 w-10" style={{ color: primaryColor }} />
        </motion.div>
        <h2 className="text-2xl font-bold mb-3">{formData.thankYouMessage}</h2>
        <p className="text-gray-500">Your response has been recorded.</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{formData.title}</h1>
        {formData.description && <p className="text-gray-500 text-base">{formData.description}</p>}
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        {formData.fields.map((field, i) => renderField(field, i))}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: formData.fields.length * 0.05 }}>
          <button type="submit" disabled={submitting} className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: primaryColor }}>
            {submitting ? (<><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</>) : (<><Send className="h-5 w-5" /> Submit</>)}
          </button>
        </motion.div>
      </form>
    </motion.div>
  );
}

// ─── SMART COLLECT FORM ──────────────────────────────────────────────
type SmartStep = "detecting" | "welcome_back" | "search" | "loading" | "confirm" | "form" | "complete" | "already_complete";

interface SiblingInfo {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

function SmartCollectForm({
  formData,
  slug,
  primaryColor,
}: {
  formData: FormPageData;
  slug: string;
  primaryColor: string;
}) {
  const [step, setStep] = useState<SmartStep>("detecting");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SearchResult | null>(null);
  const [missingFields, setMissingFields] = useState<MissingFieldInfo[]>([]);
  const [existingFields, setExistingFields] = useState<ExistingFieldInfo[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [siblingInfo, setSiblingInfo] = useState<SiblingInfo[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deviceFP, setDeviceFP] = useState<{ hash: string; deviceLabel: string } | null>(null);
  const [detectedContact, setDetectedContact] = useState<{ id: string; firstName: string | null; lastName: string | null; imageUrl: string | null } | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect returning user on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { generateFingerprint } = await import("@/lib/utils/device-fingerprint");
        const fp = await generateFingerprint();
        if (cancelled) return;
        setDeviceFP(fp);

        const res = await fetch(`/api/data-forms/public/${slug}/detect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint: fp.hash }),
        });
        const json = await res.json();
        if (cancelled) return;

        if (json.success && json.data?.detected) {
          setDetectedContact(json.data.contact);
          setStep("welcome_back");
        } else {
          setStep("search");
        }
      } catch {
        if (!cancelled) setStep("search");
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/data-forms/public/${slug}/search?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        if (json.success) setResults(json.data);
        else setResults([]);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [query, slug]);

  const handleSelectContact = async (contact: SearchResult) => {
    setSelectedContact(contact);
    setStep("loading");
    try {
      const res = await fetch(`/api/data-forms/public/${slug}/complete?contactId=${contact.id}`);
      const json = await res.json();
      if (json.success) {
        if (json.data.isComplete) {
          setStep("already_complete");
        } else {
          setMissingFields(json.data.missingFields);
          setExistingFields(json.data.existingFields);
          // Auto-fill existing values into the form
          const prefilled: Record<string, string> = {};
          for (const f of json.data.existingFields) {
            prefilled[f.key] = f.value;
          }
          setValues(prefilled);
          // If sibling data was merged, show confirmation first
          if (json.data.hasSiblingData) {
            setSiblingInfo(json.data.siblingInfo || []);
            setStep("confirm");
          } else {
            setStep("form");
          }
        }
      } else {
        setSubmitError("Could not load your information. Please try again.");
        setStep("search");
      }
    } catch {
      setSubmitError("Something went wrong. Please try again.");
      setStep("search");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact) return;

    // Validate missing fields — all required except photo
    const newErrors: Record<string, string> = {};
    for (const field of missingFields) {
      if (field.key === "imageUrl") continue; // photo is optional
      const val = values[field.key]?.trim();
      if (!val) {
        newErrors[field.key] = `${field.label} is required`;
      }
      if (val && field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        newErrors[field.key] = "Please enter a valid email";
      }
      if (val && field.key === "birthday" && !/^\d{2}-\d{2}$/.test(val)) {
        newErrors[field.key] = "Format: MM-DD (e.g. 03-14)";
      }
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/data-forms/public/${slug}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContact.id,
          data: values,
          fingerprint: deviceFP?.hash,
          deviceLabel: deviceFP?.deviceLabel,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setStep("complete");
      } else {
        setSubmitError(json.error?.message || "Failed to save. Please try again.");
      }
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── DETECTING STEP ──
  if (step === "detecting") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: primaryColor }} />
        <p className="text-gray-400 text-sm">Checking this device...</p>
      </motion.div>
    );
  }

  // ── WELCOME BACK STEP ──
  if (step === "welcome_back" && detectedContact) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="text-center mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            {detectedContact.imageUrl ? (
              <img src={detectedContact.imageUrl} alt="" className="w-20 h-20 object-cover" />
            ) : (
              <span className="text-white font-bold text-3xl">
                {(detectedContact.firstName || "?")[0].toUpperCase()}
              </span>
            )}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold mb-1"
          >
            Welcome back, {detectedContact.firstName}!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-gray-500 text-sm"
          >
            We recognized this device. Is this you?
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 text-center"
        >
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {detectedContact.firstName} {detectedContact.lastName || ""}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex gap-3"
        >
          <button
            onClick={() => {
              // Treat as if they selected this contact from search
              handleSelectContact({
                id: detectedContact.id,
                firstName: detectedContact.firstName,
                lastName: detectedContact.lastName,
                birthday: null,
              });
            }}
            className="flex-1 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <Check className="h-5 w-5" /> Yes, that&apos;s me
          </button>
          <button
            onClick={() => {
              setDetectedContact(null);
              setStep("search");
            }}
            className="flex-1 py-3.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 font-semibold text-base text-gray-600 dark:text-gray-300 transition-all hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2"
          >
            Not me
          </button>
        </motion.div>
      </motion.div>
    );
  }

  // ── SEARCH STEP ──
  if (step === "search") {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: primaryColor + "15" }}
          >
            <Search className="h-8 w-8" style={{ color: primaryColor }} />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{formData.title}</h1>
          {formData.description && <p className="text-gray-500 text-base">{formData.description}</p>}
        </div>

        <div className="relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing your first name..."
              autoFocus
              className="w-full pl-12 pr-4 py-4 text-lg rounded-2xl border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white dark:bg-gray-900 transition-all outline-none"
              style={{ borderColor: query.length >= 2 ? primaryColor + "60" : undefined }}
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-400" />
            )}
          </div>

          {/* Results dropdown */}
          <AnimatePresence>
            {query.length >= 2 && !searching && results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden"
              >
                {results.map((contact, i) => (
                  <motion.button
                    key={contact.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleSelectContact(contact)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: primaryColor }}>
                      {(contact.firstName || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {contact.firstName} {contact.lastName || ""}
                      </p>
                      {contact.birthday && (
                        <p className="text-sm text-gray-400">Birthday: {contact.birthday}</p>
                      )}
                    </div>
                    <UserCheck className="h-5 w-5 text-gray-300 flex-shrink-0" />
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* No results */}
          {query.length >= 2 && !searching && results.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-gray-400 mt-4 text-sm"
            >
              No contacts found for &quot;{query}&quot;. Please check the spelling and try again.
            </motion.p>
          )}
        </div>

        {submitError && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-500 text-center flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3" /> {submitError}
          </motion.p>
        )}
      </motion.div>
    );
  }

  // ── LOADING STEP ──
  if (step === "loading") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
        <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" style={{ color: primaryColor }} />
        <p className="text-gray-500 font-medium">Checking your info, {selectedContact?.firstName}...</p>
      </motion.div>
    );
  }

  // ── CONFIRM STEP — verify sibling data belongs to this person ──
  if (step === "confirm") {
    const siblingFields = existingFields.filter((f) => f.fromSibling && f.key !== "imageUrl");
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="text-center mb-2">
          <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: primaryColor }}>
            {(selectedContact?.firstName || "?")[0].toUpperCase()}
          </div>
          <h2 className="text-xl font-bold">
            Hi {selectedContact?.firstName}!
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            We found additional info that might be yours. Please confirm.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Is this information yours?</p>
          {siblingFields.map((f) => (
            <div key={f.key} className="flex items-center justify-between text-sm">
              <span className="text-blue-600 dark:text-blue-400">{f.label}</span>
              <span className="font-medium text-blue-900 dark:text-blue-200">{f.value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep("form")}
            className="flex-1 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <Check className="h-5 w-5" /> Yes, that&apos;s me
          </button>
          <button
            onClick={() => {
              // Remove sibling data — keep only own data
              const ownOnly: Record<string, string> = {};
              const ownExisting: ExistingFieldInfo[] = [];
              const newMissing: MissingFieldInfo[] = [];
              for (const f of existingFields) {
                if (!f.fromSibling) {
                  ownOnly[f.key] = f.value;
                  ownExisting.push(f);
                } else {
                  newMissing.push({ key: f.key, label: f.label, type: "text" });
                }
              }
              setExistingFields(ownExisting);
              setMissingFields([...missingFields, ...newMissing]);
              setValues(ownOnly);
              setSiblingInfo([]);
              setStep("form");
            }}
            className="flex-1 py-3.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 font-semibold text-base text-gray-600 dark:text-gray-300 transition-all hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2"
          >
            No, not me
          </button>
        </div>

        <button
          onClick={() => { setStep("search"); setSelectedContact(null); setQuery(""); setResults([]); setMissingFields([]); setExistingFields([]); setValues({}); setSiblingInfo([]); }}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors mx-auto block"
        >
          Search again
        </button>
      </motion.div>
    );
  }

  // ── ALREADY COMPLETE STEP ──
  if (step === "already_complete") {
    return (
      <motion.div
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
          <Sparkles className="h-10 w-10" style={{ color: primaryColor }} />
        </motion.div>
        <h2 className="text-2xl font-bold mb-3">
          You&apos;re all set, {selectedContact?.firstName}!
        </h2>
        <p className="text-gray-500 text-base">
          Your contact information is already complete. Thank you!
        </p>
      </motion.div>
    );
  }

  // ── COMPLETE (AFTER SUBMIT) STEP ──
  if (step === "complete") {
    return (
      <motion.div
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
          style={{ backgroundColor: "#10b98120" }}
        >
          <Check className="h-10 w-10 text-emerald-500" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-3">{formData.thankYouMessage}</h2>
        <p className="text-gray-500 text-base">
          Thanks {selectedContact?.firstName}, your information has been updated!
        </p>
      </motion.div>
    );
  }

  // ── FORM STEP — unified form with auto-filled existing + editable missing ──
  const baseInputClass = "w-full px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-base";
  const filledInputClass = "w-full px-4 py-3 rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-base text-gray-700 dark:text-gray-300 cursor-not-allowed";

  const allFields = [
    ...existingFields.map((f) => ({ key: f.key, label: f.label, type: "text", filled: true })),
    ...missingFields.map((f) => ({ key: f.key, label: f.label, type: f.type, filled: false })),
  ];
  // Sort by the SMART_COLLECT_FIELDS order, photo first
  const fieldOrder = ["imageUrl", "lastName", "email", "phone", "birthday", "address", "city", "state"];
  allFields.sort((a, b) => fieldOrder.indexOf(a.key) - fieldOrder.indexOf(b.key));

  // Photo upload handler
  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, imageUrl: "Photo must be under 5MB" }));
      return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/data-forms/public/${slug}/upload`, { method: "POST", body: fd });
      const json = await res.json();
      if (json.success) {
        setValues((prev) => ({ ...prev, imageUrl: json.data.url }));
        if (errors.imageUrl) setErrors((prev) => { const n = { ...prev }; delete n.imageUrl; return n; });
      } else {
        setErrors((prev) => ({ ...prev, imageUrl: json.error?.message || "Upload failed" }));
      }
    } catch {
      setErrors((prev) => ({ ...prev, imageUrl: "Upload failed" }));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Existing photo URL (from contact or sibling)
  const currentPhotoUrl = values.imageUrl || "";
  const photoField = allFields.find((f) => f.key === "imageUrl");
  const textFields = allFields.filter((f) => f.key !== "imageUrl");

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Greeting */}
      <div className="text-center mb-2">
        <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: primaryColor }}>
          {currentPhotoUrl ? (
            <img src={currentPhotoUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            (selectedContact?.firstName || "?")[0].toUpperCase()
          )}
        </div>
        <h2 className="text-xl font-bold">
          Hi {selectedContact?.firstName}!
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {missingFields.filter(f => f.key !== "imageUrl").length > 0
            ? "Please verify your info and fill in any missing details."
            : "Your contact information is complete!"}
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePhotoUpload(file);
          e.target.value = "";
        }}
      />

      {/* Unified form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Profile Photo — first field */}
        {photoField && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="space-y-1.5"
          >
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              Profile Photo
              {photoField.filled ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <span className="text-gray-400 text-xs font-normal">(optional)</span>
              )}
            </label>
            {currentPhotoUrl ? (
              <div className="flex items-center gap-4 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
                <img src={currentPhotoUrl} alt="Your photo" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <Check className="h-4 w-4" /> Photo uploaded
                  </p>
                  {!photoField.filled && (
                    <button type="button" onClick={() => photoInputRef.current?.click()} className="text-xs text-emerald-600 dark:text-emerald-400 underline mt-1">
                      Change photo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="w-full p-5 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all flex items-center gap-4"
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 flex-shrink-0" />
                    <span className="text-sm text-gray-500">Uploading...</span>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <Camera className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 block">Tap to upload your photo</span>
                      <span className="text-xs text-gray-400">PNG, JPG or WebP, max 5MB</span>
                    </div>
                  </>
                )}
              </button>
            )}
            {errors.imageUrl && (
              <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {errors.imageUrl}</p>
            )}
          </motion.div>
        )}

        {/* Text fields */}
        {textFields.map((field, i) => (
          <motion.div
            key={field.key}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.04 }}
            className="space-y-1.5"
          >
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              {field.label}
              {field.filled ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <span className="text-red-500">*</span>
              )}
            </label>
            <input
              type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
              value={values[field.key] || ""}
              disabled={field.filled}
              onChange={(e) => {
                if (field.filled) return;
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }));
                if (errors[field.key]) setErrors((prev) => { const n = { ...prev }; delete n[field.key]; return n; });
              }}
              placeholder={field.key === "birthday" ? "MM-DD (e.g. 08-15)" : `Enter your ${field.label.toLowerCase()}`}
              className={field.filled ? filledInputClass : baseInputClass}
            />
            {errors[field.key] && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors[field.key]}
              </motion.p>
            )}
          </motion.div>
        ))}

        {submitError && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-500 text-center flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3" /> {submitError}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 + missingFields.length * 0.06 }}
          className="pt-2"
        >
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</>
            ) : (
              <><Check className="h-5 w-5" /> Complete My Info</>
            )}
          </button>
        </motion.div>
      </form>

      {/* Back link */}
      <button
        onClick={() => { setStep("search"); setSelectedContact(null); setQuery(""); setResults([]); setMissingFields([]); setExistingFields([]); setValues({}); setErrors({}); setSubmitError(null); }}
        className="text-sm text-gray-400 hover:text-gray-600 transition-colors mx-auto block"
      >
        Not you? Search again
      </button>
    </motion.div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────
function PublicFormClient({ slug }: { slug: string }) {
  const [formData, setFormData] = useState<FormPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/data-forms/public/${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setFormData(json.data);
        else setError(json.error?.message || "Form not found");
      })
      .catch(() => setError("Failed to load form"))
      .finally(() => setLoading(false));
  }, [slug]);

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

  const primaryColor = formData.brand?.colors?.primary || "#2563eb";

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
          {(formData.type === "SMART_COLLECT" || formData.type === "ATTENDANCE") ? (
            <SmartCollectForm key="smart" formData={formData} slug={slug} primaryColor={primaryColor} />
          ) : (
            <StandardForm key="standard" formData={formData} slug={slug} primaryColor={primaryColor} />
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
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
