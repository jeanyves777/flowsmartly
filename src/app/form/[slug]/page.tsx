"use client";

import { use, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Send, AlertCircle, UserCheck, Camera } from "lucide-react";
import type { DataFormField, DataFormType } from "@/types/data-form";
import { AISpinner } from "@/components/shared/ai-generation-loader";

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
            {submitting ? (<><AISpinner className="h-5 w-5 animate-spin" /> Submitting...</>) : (<><Send className="h-5 w-5" /> Submit</>)}
          </button>
        </motion.div>
      </form>
    </motion.div>
  );
}

// ─── SELF-ENTRY FORM (Smart Collect / Attendance) ────────────────────
// This form used to look the respondent up by name and prefill their stored
// details. That lookup handed the form owner's contact records to anyone who
// could type a name, so it is closed. Respondents now type their own details.
//
// What they type is stored as a form submission and touches no contact record.
// The owner turns submissions into contacts from the back office, where the
// request is authenticated and reviewed.

interface SelfEntryField {
  key: string;
  label: string;
  type: "text" | "email" | "tel";
  placeholder?: string;
  required?: boolean;
}

const SELF_ENTRY_FIELDS: SelfEntryField[] = [
  { key: "firstName", label: "First name", type: "text", required: true },
  { key: "lastName", label: "Last name", type: "text", required: true },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "birthday", label: "Birthday", type: "text", placeholder: "MM-DD (e.g. 08-15)" },
  { key: "address", label: "Address", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "state", label: "State", type: "text" },
];

function SelfEntryForm({
  formData,
  slug,
  primaryColor,
}: {
  formData: FormPageData;
  slug: string;
  primaryColor: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

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
      if (json.success) setValue("imageUrl", json.data.url);
      else setErrors((prev) => ({ ...prev, imageUrl: json.error?.message || "Upload failed" }));
    } catch {
      setErrors((prev) => ({ ...prev, imageUrl: "Upload failed" }));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const firstName = (values.firstName || "").trim();
    const lastName = (values.lastName || "").trim();
    const email = (values.email || "").trim();
    const phone = (values.phone || "").trim();
    const birthday = (values.birthday || "").trim();

    const nextErrors: Record<string, string> = {};
    if (!firstName) nextErrors.firstName = "First name is required";
    if (!lastName) nextErrors.lastName = "Last name is required";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Please enter a valid email";
    }
    if (birthday && !/^\d{2}-\d{2}$/.test(birthday)) {
      nextErrors.birthday = "Format: MM-DD (e.g. 03-14)";
    }
    // One reachable channel, so the submission is usable to the form owner.
    if (!email && !phone) {
      nextErrors.email = nextErrors.email || "Enter an email or a phone number";
      nextErrors.phone = "Enter an email or a phone number";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const data: Record<string, string> = {};
      for (const field of SELF_ENTRY_FIELDS) {
        const value = (values[field.key] || "").trim();
        if (value) data[field.key] = value;
      }
      if (values.imageUrl) data.imageUrl = values.imageUrl;

      const res = await fetch(`/api/data-forms/public/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          respondentName: `${firstName} ${lastName}`.trim(),
          respondentEmail: email || undefined,
          respondentPhone: phone || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) setSubmitted(true);
      else setSubmitError(json.error?.message || "Failed to submit. Please try again.");
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
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
          Thanks {(values.firstName || "").trim()}, your details have been sent.
        </p>
      </motion.div>
    );
  }

  const photoUrl = values.imageUrl || "";
  const inputClass =
    "w-full px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-base";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center mb-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: primaryColor + "15" }}
        >
          <UserCheck className="h-8 w-8" style={{ color: primaryColor }} />
        </motion.div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{formData.title}</h1>
        {formData.description && <p className="text-gray-500 text-base">{formData.description}</p>}
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePhotoUpload(file);
          e.target.value = "";
        }}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Optional photo */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 transition-colors disabled:opacity-60"
            style={photoUrl ? { borderStyle: "solid", borderColor: primaryColor } : undefined}
          >
            {uploadingPhoto ? (
              <AISpinner className="h-6 w-6 animate-spin text-gray-400" />
            ) : photoUrl ? (
              <img src={photoUrl} alt="" className="w-20 h-20 object-cover" />
            ) : (
              <Camera className="h-6 w-6 text-gray-400" />
            )}
          </button>
          <span className="text-xs text-gray-400">Photo (optional)</span>
          {errors.imageUrl && (
            <span className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {errors.imageUrl}
            </span>
          )}
        </div>

        {SELF_ENTRY_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type={field.type}
              value={values[field.key] || ""}
              onChange={(e) => setValue(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={inputClass}
              style={errors[field.key] ? { borderColor: "#ef4444" } : undefined}
            />
            {errors[field.key] && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors[field.key]}
              </p>
            )}
          </div>
        ))}

        <p className="text-xs text-gray-400">
          Please give us an email address or a phone number so we can reach you.
        </p>

        {submitError && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || uploadingPhoto}
          className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor }}
        >
          {submitting ? (
            <>
              <AISpinner className="h-5 w-5 animate-spin" /> Sending...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" /> Submit
            </>
          )}
        </button>
      </form>
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
        <AISpinner className="h-8 w-8 animate-spin text-gray-400" />
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
          {(formData.type === "SMART_COLLECT" || formData.type === "ATTENDANCE") &&
          formData.fields.length === 0 ? (
            // Smart Collect / Attendance forms carry no field definitions of
            // their own — they collect a fixed set of contact details, which
            // the respondent now types themselves.
            <SelfEntryForm key="self" formData={formData} slug={slug} primaryColor={primaryColor} />
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
