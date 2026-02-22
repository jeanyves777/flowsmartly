"use client";

import { use, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Send, AlertCircle, Star } from "lucide-react";
import type { SurveyQuestion } from "@/types/follow-up";

interface BrandInfo {
  name: string;
  logo: string | null;
  iconLogo: string | null;
  colors: { primary?: string; secondary?: string; accent?: string } | null;
  fonts: { heading?: string; body?: string } | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
}

interface SurveyPageData {
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  thankYouMessage: string;
  brand: BrandInfo | null;
}

function PublicSurveyClient({ slug }: { slug: string }) {
  const [surveyData, setSurveyData] = useState<SurveyPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/surveys/public/${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setSurveyData(json.data);
        else setError(json.error?.message || "Survey not found");
      })
      .catch(() => setError("Failed to load survey"))
      .finally(() => setLoading(false));
  }, [slug]);

  const primaryColor = surveyData?.brand?.colors?.primary || "#2563eb";

  const updateAnswer = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (fieldErrors[questionId])
      setFieldErrors((prev) => {
        const n = { ...prev };
        delete n[questionId];
        return n;
      });
  };

  const validate = (): boolean => {
    if (!surveyData) return false;
    const newErrors: Record<string, string> = {};
    for (const q of surveyData.questions) {
      if (q.required && (!answers[q.id] || String(answers[q.id]).trim() === "")) {
        newErrors[q.id] = `${q.label} is required`;
      }
      if (answers[q.id] && q.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(answers[q.id]))) {
        newErrors[q.id] = "Please enter a valid email";
      }
    }
    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    let respondentName: string | undefined;
    let respondentEmail: string | undefined;
    let respondentPhone: string | undefined;

    for (const q of surveyData!.questions) {
      const val = answers[q.id];
      if (!val) continue;
      if (q.type === "email") respondentEmail = String(val);
      else if (q.type === "phone") respondentPhone = String(val);
      else if (q.label.toLowerCase().includes("name") && q.type === "text" && !respondentName) {
        respondentName = String(val);
      }
    }

    try {
      const res = await fetch(`/api/surveys/public/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, respondentName, respondentEmail, respondentPhone }),
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

  const renderQuestion = (q: SurveyQuestion, index: number) => {
    const val = answers[q.id];
    const err = fieldErrors[q.id];
    const baseInputClass =
      "w-full px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-base";

    return (
      <motion.div
        key={q.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="space-y-1.5"
      >
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          {q.label}
          {q.required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {q.type === "text" && (
          <input type="text" value={String(val || "")} onChange={(e) => updateAnswer(q.id, e.target.value)} placeholder={q.placeholder || "Your answer..."} className={baseInputClass} />
        )}

        {q.type === "textarea" && (
          <textarea rows={3} value={String(val || "")} onChange={(e) => updateAnswer(q.id, e.target.value)} placeholder={q.placeholder || "Your answer..."} className={baseInputClass} />
        )}

        {q.type === "email" && (
          <input type="email" value={String(val || "")} onChange={(e) => updateAnswer(q.id, e.target.value)} placeholder={q.placeholder || "your@email.com"} className={baseInputClass} />
        )}

        {q.type === "phone" && (
          <input type="tel" value={String(val || "")} onChange={(e) => updateAnswer(q.id, e.target.value)} placeholder={q.placeholder || "+1 (555) 000-0000"} className={baseInputClass} />
        )}

        {q.type === "rating" && (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => updateAnswer(q.id, star)} className="p-1 transition-transform hover:scale-110">
                <Star className={`w-8 h-8 ${star <= ((val as number) || 0) ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-300"}`} />
              </button>
            ))}
            {val && <span className="text-sm text-gray-400 ml-2">{val}/5</span>}
          </div>
        )}

        {q.type === "multiple_choice" && q.options && (
          <div className="space-y-2">
            {q.options.map((option) => (
              <label
                key={option}
                onClick={() => updateAnswer(q.id, option)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  val === option ? "bg-blue-50 dark:bg-blue-950/20" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                style={val === option ? { borderColor: primaryColor } : undefined}
              >
                <div
                  className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={val === option ? { borderColor: primaryColor } : { borderColor: "#d1d5db" }}
                >
                  {val === option && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />}
                </div>
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        )}

        {q.type === "yes_no" && (
          <div className="flex gap-3">
            {["Yes", "No"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updateAnswer(q.id, option.toLowerCase())}
                className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium text-sm transition-colors ${
                  val === option.toLowerCase()
                    ? option === "Yes"
                      ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
                      : "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {err && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {err}
          </motion.p>
        )}
      </motion.div>
    );
  };

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
          <h1 className="text-xl font-bold mb-2">Survey Unavailable</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!surveyData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header with brand */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          {surveyData.brand?.logo ? (
            <img src={surveyData.brand.logo} alt={surveyData.brand.name} className="h-12 mx-auto mb-3 object-contain" />
          ) : surveyData.brand?.iconLogo ? (
            <img src={surveyData.brand.iconLogo} alt={surveyData.brand.name} className="h-10 w-10 mx-auto mb-3 rounded-lg object-cover" />
          ) : null}
          {surveyData.brand?.name && <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{surveyData.brand.name}</p>}
        </div>
      </div>

      {/* Survey content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div key="thanks" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", duration: 0.5 }} className="text-center py-16">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ backgroundColor: primaryColor + "20" }}
              >
                <Check className="h-10 w-10" style={{ color: primaryColor }} />
              </motion.div>
              <h2 className="text-2xl font-bold mb-3">Response Submitted!</h2>
              <p className="text-gray-500">{surveyData.thankYouMessage}</p>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">{surveyData.title}</h1>
                {surveyData.description && <p className="text-gray-500 text-base">{surveyData.description}</p>}
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                {surveyData.questions.map((q, i) => renderQuestion(q, i))}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: surveyData.questions.length * 0.05 }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" /> Submit Response
                      </>
                    )}
                  </button>
                </motion.div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-800 mt-16">
        {surveyData.brand && (surveyData.brand.email || surveyData.brand.phone || surveyData.brand.website || surveyData.brand.address) && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="flex flex-wrap gap-4 justify-center text-sm text-gray-500">
              {surveyData.brand.email && (
                <a href={`mailto:${surveyData.brand.email}`} className="hover:text-gray-700">
                  {surveyData.brand.email}
                </a>
              )}
              {surveyData.brand.phone && (
                <a href={`tel:${surveyData.brand.phone}`} className="hover:text-gray-700">
                  {surveyData.brand.phone}
                </a>
              )}
              {surveyData.brand.website && (
                <a href={surveyData.brand.website} target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">
                  {surveyData.brand.website}
                </a>
              )}
              {surveyData.brand.address && <span>{surveyData.brand.address}</span>}
            </div>
          </div>
        )}
        <div className="text-center py-4 text-xs text-gray-400">
          Powered by{" "}
          <a href="https://flowsmartly.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
            FlowSmartly
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SurveyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <PublicSurveyClient slug={slug} />;
}
