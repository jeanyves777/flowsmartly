"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { SurveyQuestion } from "@/types/follow-up";

interface SurveyFormProps {
  slug: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  thankYouMessage: string;
}

export function SurveyForm({ slug, title, description, questions, thankYouMessage }: SurveyFormProps) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateAnswer = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    for (const q of questions) {
      if (q.required && (!answers[q.id] || String(answers[q.id]).trim() === "")) {
        setError(`"${q.label}" is required`);
        return;
      }
    }

    // Extract respondent info from answers
    let respondentName: string | undefined;
    let respondentEmail: string | undefined;
    let respondentPhone: string | undefined;

    for (const q of questions) {
      const val = answers[q.id];
      if (!val) continue;
      if (q.type === "email") respondentEmail = String(val);
      else if (q.type === "phone") respondentPhone = String(val);
      else if (q.label.toLowerCase().includes("name") && q.type === "text" && !respondentName) {
        respondentName = String(val);
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/surveys/public/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          respondentName,
          respondentEmail,
          respondentPhone,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || "Failed to submit");
      }

      setIsSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">Response Submitted!</h2>
        <p className="text-muted-foreground">{thankYouMessage}</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-2">{description}</p>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {questions.map((q, index) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="space-y-2"
          >
            <Label className="text-sm font-medium">
              {q.label}
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </Label>

            {/* Text Input */}
            {q.type === "text" && (
              <Input
                value={String(answers[q.id] || "")}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                placeholder={q.placeholder || "Your answer..."}
              />
            )}

            {/* Textarea */}
            {q.type === "textarea" && (
              <Textarea
                value={String(answers[q.id] || "")}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                placeholder={q.placeholder || "Your answer..."}
                rows={3}
              />
            )}

            {/* Email */}
            {q.type === "email" && (
              <Input
                type="email"
                value={String(answers[q.id] || "")}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                placeholder={q.placeholder || "your@email.com"}
              />
            )}

            {/* Phone */}
            {q.type === "phone" && (
              <Input
                type="tel"
                value={String(answers[q.id] || "")}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                placeholder={q.placeholder || "+1 (555) 000-0000"}
              />
            )}

            {/* Star Rating */}
            {q.type === "rating" && (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => updateAnswer(q.id, star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= (answers[q.id] as number || 0)
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300 hover:text-amber-300"
                      }`}
                    />
                  </button>
                ))}
                {answers[q.id] && (
                  <span className="text-sm text-muted-foreground ml-2">
                    {answers[q.id]}/5
                  </span>
                )}
              </div>
            )}

            {/* Multiple Choice */}
            {q.type === "multiple_choice" && q.options && (
              <div className="space-y-2">
                {q.options.map((option) => (
                  <label
                    key={option}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      answers[q.id] === option
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        answers[q.id] === option ? "border-brand-500" : "border-gray-300"
                      }`}
                    >
                      {answers[q.id] === option && (
                        <div className="w-2 h-2 rounded-full bg-brand-500" />
                      )}
                    </div>
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Yes/No */}
            {q.type === "yes_no" && (
              <div className="flex gap-3">
                {["Yes", "No"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateAnswer(q.id, option.toLowerCase())}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium text-sm transition-colors ${
                      answers[q.id] === option.toLowerCase()
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
          </motion.div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Submit */}
      <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        Submit Response
      </Button>
    </form>
  );
}
