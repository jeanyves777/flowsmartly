"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, GripVertical, Eye, Save, Send, ChevronDown, ChevronUp, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import type { SurveyQuestion } from "@/types/follow-up";

type SurveyQuestionType = SurveyQuestion["type"];

const QUESTION_TYPES: { value: SurveyQuestionType; label: string }[] = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "rating", label: "Star Rating" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "yes_no", label: "Yes / No" },
];

export default function NewSurveyPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("Thank you for your response!");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const genId = () => Math.random().toString(36).slice(2, 9);

  const addQuestion = (type: SurveyQuestionType) => {
    const typeLabel = QUESTION_TYPES.find(t => t.value === type)?.label || type;
    const newQuestion: SurveyQuestion = {
      id: genId(),
      type,
      label: typeLabel,
      required: false,
      placeholder: "",
      options: type === "multiple_choice" ? ["Option 1", "Option 2"] : undefined,
    };
    setQuestions(prev => [...prev, newQuestion]);
    setExpandedQuestion(newQuestion.id);
    setShowTypeSelector(false);
  };

  const updateQuestion = (id: string, updates: Partial<SurveyQuestion>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newQuestions = [...questions];
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= newQuestions.length) return;
    [newQuestions[index], newQuestions[swap]] = [newQuestions[swap], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        questions,
        thankYouMessage: thankYouMessage.trim(),
        status: publish && questions.length > 0 ? "ACTIVE" : "DRAFT",
      };
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/tools/surveys/${json.data.id}`);
      } else {
        alert(json.error || "Failed to save survey");
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save survey");
    } finally {
      setSaving(false);
    }
  };

  const hasPlaceholder = (type: SurveyQuestionType) =>
    ["text", "textarea", "email", "phone"].includes(type);

  const renderQuestionPreview = (question: SurveyQuestion) => {
    const baseClasses = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";

    switch (question.type) {
      case "text":
      case "email":
      case "phone":
        return (
          <input
            type={question.type === "phone" ? "tel" : question.type}
            placeholder={question.placeholder || ""}
            className={baseClasses}
            disabled
          />
        );
      case "textarea":
        return (
          <textarea
            placeholder={question.placeholder || ""}
            className={`${baseClasses} resize-none`}
            rows={3}
            disabled
          />
        );
      case "rating":
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className="h-6 w-6 text-gray-300 dark:text-gray-600" />
            ))}
          </div>
        );
      case "multiple_choice":
        return (
          <div className="space-y-2">
            {question.options?.map((opt, i) => (
              <label key={i} className="flex items-center gap-2">
                <input type="radio" name={question.id} disabled />
                <span className="text-sm text-gray-900 dark:text-gray-100">{opt}</span>
              </label>
            ))}
          </div>
        );
      case "yes_no":
        return (
          <div className="flex gap-2">
            <span className="px-4 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800">
              Yes
            </span>
            <span className="px-4 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800">
              No
            </span>
          </div>
        );
      default:
        return <input type="text" className={baseClasses} disabled />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/tools/surveys">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Create Survey
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="lg:hidden"
              >
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? "Hide" : "Show"} Preview
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={saving || !title.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={saving || !title.trim() || questions.length === 0}
              >
                <Send className="h-4 w-4 mr-2" />
                Publish
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Builder Section */}
          <div className={`space-y-6 ${showPreview ? "hidden lg:block" : ""}`}>
            {/* Survey Settings */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Survey Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Customer Satisfaction Survey"
                  className="text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a brief description of this survey..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Thank You Message
                </label>
                <Input
                  value={thankYouMessage}
                  onChange={(e) => setThankYouMessage(e.target.value)}
                  placeholder="Message shown after submission"
                />
              </div>
            </div>

            {/* Questions */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Questions
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTypeSelector(!showTypeSelector)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>

              {/* Question Type Selector */}
              {showTypeSelector && (
                <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      Select Question Type
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTypeSelector(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {QUESTION_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => addQuestion(type.value)}
                        className="p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm transition-all"
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {type.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Question List */}
              {questions.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p>No questions added yet.</p>
                  <p className="text-sm mt-1">Click &quot;Add Question&quot; to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div
                      key={question.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                    >
                      <div
                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setExpandedQuestion(expandedQuestion === question.id ? null : question.id)}
                      >
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-medium text-gray-400 uppercase">
                          {question.type}
                        </span>
                        <span className="font-medium flex-1 text-gray-900 dark:text-white">
                          {question.label}
                        </span>
                        {question.required && (
                          <span className="text-xs text-red-500 font-medium">Required</span>
                        )}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            expandedQuestion === question.id ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                      {expandedQuestion === question.id && (
                        <div className="p-3 pt-0 space-y-3 border-t border-gray-100 dark:border-gray-700">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Label
                            </label>
                            <Input
                              value={question.label}
                              onChange={(e) => updateQuestion(question.id, { label: e.target.value })}
                              placeholder="Question label"
                            />
                          </div>
                          {hasPlaceholder(question.type) && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Placeholder
                              </label>
                              <Input
                                value={question.placeholder || ""}
                                onChange={(e) =>
                                  updateQuestion(question.id, { placeholder: e.target.value })
                                }
                                placeholder="Placeholder text"
                              />
                            </div>
                          )}
                          {question.type === "multiple_choice" && (
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                Options
                              </label>
                              {question.options?.map((opt, i) => (
                                <div key={i} className="flex gap-2">
                                  <Input
                                    value={opt}
                                    onChange={(e) => {
                                      const newOpts = [...question.options!];
                                      newOpts[i] = e.target.value;
                                      updateQuestion(question.id, { options: newOpts });
                                    }}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateQuestion(question.id, {
                                        options: question.options!.filter((_, j) => j !== i),
                                      })
                                    }
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateQuestion(question.id, {
                                    options: [
                                      ...(question.options || []),
                                      `Option ${(question.options?.length || 0) + 1}`,
                                    ],
                                  })
                                }
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add Option
                              </Button>
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-2">
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <input
                                type="checkbox"
                                checked={question.required}
                                onChange={(e) =>
                                  updateQuestion(question.id, { required: e.target.checked })
                                }
                                className="rounded"
                              />
                              Required
                            </label>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveQuestion(index, "up")}
                                disabled={index === 0}
                                title="Move up"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveQuestion(index, "down")}
                                disabled={index === questions.length - 1}
                                title="Move down"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setQuestions((prev) => prev.filter((q) => q.id !== question.id))
                                }
                                className="text-red-500 hover:text-red-700"
                                title="Remove question"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview Section */}
          <div className={`${!showPreview ? "hidden lg:block" : ""}`}>
            <div className="sticky top-24">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Live Preview
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(false)}
                    className="lg:hidden"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Phone Frame */}
                <div className="mx-auto max-w-sm">
                  <div className="border-8 border-gray-800 dark:border-gray-600 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="bg-white dark:bg-gray-900 h-[600px] overflow-y-auto">
                      <div className="p-6 space-y-6">
                        {/* Survey Header */}
                        {title && (
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                              {title}
                            </h3>
                            {description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {description}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Survey Questions */}
                        {questions.length > 0 ? (
                          <div className="space-y-4">
                            {questions.map((question) => (
                              <div key={question.id}>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  {question.label}
                                  {question.required && (
                                    <span className="text-red-500 ml-1">*</span>
                                  )}
                                </label>
                                {renderQuestionPreview(question)}
                              </div>
                            ))}
                            <button
                              disabled
                              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md font-medium opacity-50 cursor-not-allowed"
                            >
                              Submit
                            </button>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-gray-400">
                            <p className="text-sm">Your survey questions will appear here</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
