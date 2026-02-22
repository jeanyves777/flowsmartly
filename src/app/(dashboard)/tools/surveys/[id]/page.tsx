"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
  ExternalLink, FileText, Send, Users, Search,
  RefreshCw, Star, Mail, Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SURVEY_STATUS_CONFIG, type SurveyData, type SurveyStatus, type SurveyResponseData } from "@/types/survey";
import { QUESTION_TYPES, type SurveyQuestion } from "@/types/follow-up";
import { QRCodeDisplay } from "@/components/data-forms/qr-code-display";

const QUESTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.value, t.label])
);

interface ContactList {
  id: string;
  name: string;
  totalCount: number;
}

export default function SurveyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"builder" | "responses" | "share" | "send">("builder");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Builder state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [thankYouMessage, setThankYouMessage] = useState("Thank you for your response!");
  const [isActive, setIsActive] = useState(true);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  // Responses state
  const [responses, setResponses] = useState<SurveyResponseData[]>([]);
  const [resLoading, setResLoading] = useState(false);
  const [resPage, setResPage] = useState(1);
  const [resPagination, setResPagination] = useState<{ total: number; pages: number }>({ total: 0, pages: 0 });
  const [resSearch, setResSearch] = useState("");
  const [selectedRes, setSelectedRes] = useState<Set<string>>(new Set());

  // Brand state
  const [brand, setBrand] = useState<{
    name: string;
    logo: string | null;
    iconLogo: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
  } | null>(null);

  // Send state
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [sendListId, setSendListId] = useState("");
  const [sendChannel, setSendChannel] = useState<"email" | "sms">("email");
  const [isSending, setIsSending] = useState(false);

  // Fetch brand
  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.brandKit) {
          const bk = json.data.brandKit;
          setBrand({
            name: bk.name,
            logo: bk.logo,
            iconLogo: bk.iconLogo,
            email: bk.email,
            phone: bk.phone,
            website: bk.website,
            address: bk.address,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch survey
  const fetchSurvey = useCallback(async () => {
    try {
      const res = await fetch(`/api/surveys/${id}`);
      const json = await res.json();
      if (json.success) {
        setSurvey(json.data);
        setTitle(json.data.title);
        setDescription(json.data.description || "");
        setQuestions(json.data.questions || []);
        setThankYouMessage(json.data.thankYouMessage || "Thank you for your response!");
        setIsActive(json.data.isActive);
        if (json.data.contactListId) setSendListId(json.data.contactListId);
      } else {
        router.push("/tools/surveys");
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  // Fetch responses
  const fetchResponses = useCallback(async () => {
    setResLoading(true);
    try {
      const p = new URLSearchParams({ page: String(resPage), limit: "25" });
      if (resSearch) p.set("search", resSearch);
      const res = await fetch(`/api/surveys/${id}/responses?${p}`);
      const json = await res.json();
      if (json.submissions) {
        setResponses(json.submissions);
        setResPagination({ total: json.total || 0, pages: json.totalPages || 0 });
      }
    } finally {
      setResLoading(false);
    }
  }, [id, resPage, resSearch]);

  useEffect(() => {
    if (activeTab === "responses") fetchResponses();
  }, [activeTab, fetchResponses]);

  // Fetch contact lists for Send tab
  useEffect(() => {
    if (activeTab === "send" && contactLists.length === 0) {
      fetch("/api/contact-lists?limit=100")
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setContactLists(json.data?.lists || json.data || []);
        })
        .catch(() => {});
    }
  }, [activeTab, contactLists.length]);

  // Save survey (builder)
  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/surveys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          questions,
          thankYouMessage: thankYouMessage.trim(),
          isActive,
          status: isActive ? "ACTIVE" : "DRAFT",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSurvey(json.data);
        showToast("Survey saved!");
      }
    } finally {
      setSaving(false);
    }
  };

  // Question builder helpers
  const genId = () => `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const addQuestion = (type: SurveyQuestion["type"]) => {
    setQuestions((prev) => [
      ...prev,
      {
        id: genId(),
        type,
        label: "",
        required: false,
        placeholder: "",
        ...(type === "multiple_choice" ? { options: ["Option 1", "Option 2"] } : {}),
      },
    ]);
    setShowTypeSelector(false);
  };

  const updateQuestion = (questionId: string, updates: Partial<SurveyQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, ...updates } : q)));
  };

  const moveQuestion = (index: number, dir: "up" | "down") => {
    const arr = [...questions];
    const swap = dir === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[index], arr[swap]] = [arr[swap], arr[index]];
    setQuestions(arr);
  };

  const deleteQuestion = (questionId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  };

  // Responses: bulk delete
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedRes.size} responses?`)) return;
    const res = await fetch(`/api/surveys/${id}/responses`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedRes) }),
    });
    const json = await res.json();
    if (json.success) {
      setSelectedRes(new Set());
      fetchResponses();
      fetchSurvey();
      showToast(`${json.data?.deleted || selectedRes.size} responses deleted`);
    }
  };

  // Send survey
  const handleSend = async () => {
    if (!sendListId || sendListId === "none") {
      showToast("Select a contact list");
      return;
    }
    if (questions.length === 0) {
      showToast("Add at least one question before sending");
      return;
    }

    setIsSending(true);
    try {
      // Save survey first to ensure it's active
      await fetch(`/api/surveys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          thankYouMessage: thankYouMessage.trim(),
          questions,
          isActive: true,
          status: "ACTIVE",
          contactListId: sendListId,
        }),
      });

      const res = await fetch(`/api/surveys/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: sendChannel, contactListId: sendListId }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.data?.message || "Survey sent!");
        fetchSurvey();
      }
    } finally {
      setIsSending(false);
    }
  };

  // Toast helper
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // Survey public URL
  const surveyUrl = survey?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/survey/${survey.slug}`
    : "";

  // Tab configuration
  const tabs = [
    { key: "builder" as const, label: "Builder", icon: FileText },
    { key: "responses" as const, label: `Responses (${survey?.responseCount || 0})`, icon: Users },
    { key: "share" as const, label: "Share", icon: ExternalLink },
    { key: "send" as const, label: "Send", icon: Send },
  ];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tools/surveys" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{survey?.title || "Loading..."}</h1>
            {survey && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  SURVEY_STATUS_CONFIG[survey.status as SurveyStatus]?.color || SURVEY_STATUS_CONFIG.DRAFT.color
                }`}
              >
                {SURVEY_STATUS_CONFIG[survey.status as SurveyStatus]?.label || "Draft"}
              </span>
            )}
          </div>
        </div>
        {activeTab === "builder" && (
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Builder Tab */}
        {activeTab === "builder" && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Survey Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter survey title"
                  className="text-lg font-semibold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description (optional)</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description shown to respondents"
                />
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Questions</h3>
              {questions.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                  <p className="text-gray-500 mb-4">No questions yet. Add your first question to get started.</p>
                </div>
              )}
              {questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <button className="mt-2 text-gray-400 hover:text-gray-600 cursor-move">
                      <GripVertical className="h-5 w-5" />
                    </button>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={question.label}
                          onChange={(e) => updateQuestion(question.id, { label: e.target.value })}
                          placeholder="Enter your question..."
                          className="flex-1"
                        />
                        <button
                          onClick={() =>
                            setExpandedQuestion(expandedQuestion === question.id ? null : question.id)
                          }
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {expandedQuestion === question.id ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-medium">
                          {QUESTION_TYPE_LABELS[question.type] || question.type}
                        </span>
                        <label className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-xs">Required</span>
                        </label>
                      </div>
                      {expandedQuestion === question.id && (
                        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div>
                            <label className="block text-xs font-medium mb-1">Placeholder</label>
                            <Input
                              value={question.placeholder || ""}
                              onChange={(e) => updateQuestion(question.id, { placeholder: e.target.value })}
                              placeholder="Placeholder text"
                              size={32}
                            />
                          </div>
                          {question.type === "multiple_choice" && (
                            <div>
                              <label className="block text-xs font-medium mb-1">Options</label>
                              <div className="space-y-2">
                                {(question.options || []).map((opt, i) => (
                                  <div key={i} className="flex gap-2">
                                    <Input
                                      value={opt}
                                      onChange={(e) => {
                                        const newOpts = [...(question.options || [])];
                                        newOpts[i] = e.target.value;
                                        updateQuestion(question.id, { options: newOpts });
                                      }}
                                      size={32}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const newOpts = (question.options || []).filter((_, idx) => idx !== i);
                                        updateQuestion(question.id, { options: newOpts });
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const newOpts = [
                                      ...(question.options || []),
                                      `Option ${(question.options?.length || 0) + 1}`,
                                    ];
                                    updateQuestion(question.id, { options: newOpts });
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Option
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveQuestion(index, "up")}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveQuestion(index, "down")}
                        disabled={index === questions.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteQuestion(question.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Question Button */}
            <div className="relative">
              <Button onClick={() => setShowTypeSelector(!showTypeSelector)} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
              {showTypeSelector && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-10">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {QUESTION_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => addQuestion(type.value as SurveyQuestion["type"])}
                        className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                      >
                        <span className="text-xs font-mono text-gray-400 uppercase w-5 text-center">
                          {type.value.charAt(0)}
                        </span>
                        <span className="text-sm font-medium">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Thank You Message */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Thank You Message</label>
              <Input
                value={thankYouMessage}
                onChange={(e) => setThankYouMessage(e.target.value)}
                placeholder="Thank you for your response!"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <label className="text-sm font-medium">Survey Active</label>
              <button
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isActive ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isActive ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm text-gray-500">{isActive ? "Active" : "Inactive"}</span>
            </div>
          </div>
        )}

        {/* Responses Tab */}
        {activeTab === "responses" && (
          <div className="space-y-4">
            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={resSearch}
                    onChange={(e) => setResSearch(e.target.value)}
                    placeholder="Search responses..."
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                {selectedRes.size > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete ({selectedRes.size})
                  </Button>
                )}
              </div>
            </div>

            {/* Response Cards */}
            {resLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              </div>
            ) : responses.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500">No responses yet</p>
                <p className="text-sm text-gray-400 mt-1">Share your survey link to start collecting feedback.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {responses.map((resp) => {
                    const answers =
                      typeof resp.answers === "string"
                        ? JSON.parse(resp.answers as string)
                        : resp.answers;
                    return (
                      <div
                        key={resp.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedRes.has(resp.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedRes);
                              if (e.target.checked) {
                                newSet.add(resp.id);
                              } else {
                                newSet.delete(resp.id);
                              }
                              setSelectedRes(newSet);
                            }}
                            className="rounded mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 text-sm">
                                {resp.respondentName && (
                                  <span className="font-medium">{resp.respondentName}</span>
                                )}
                                {resp.respondentEmail && (
                                  <span className="text-gray-500">{resp.respondentEmail}</span>
                                )}
                                {resp.respondentPhone && (
                                  <span className="text-gray-500">{resp.respondentPhone}</span>
                                )}
                                {!resp.respondentName && !resp.respondentEmail && !resp.respondentPhone && (
                                  <span className="text-gray-400 italic">Anonymous</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {resp.rating != null && resp.rating > 0 && (
                                  <div className="flex items-center gap-0.5">
                                    {[...Array(5)].map((_, si) => (
                                      <Star
                                        key={si}
                                        className={`h-3 w-3 ${
                                          si < resp.rating!
                                            ? "fill-amber-400 text-amber-400"
                                            : "text-gray-300"
                                        }`}
                                      />
                                    ))}
                                  </div>
                                )}
                                <span className="text-xs text-gray-500">
                                  {new Date(resp.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                              {Object.entries(answers as Record<string, unknown>).map(([qId, answer]) => {
                                const question = questions.find((q) => q.id === qId);
                                return (
                                  <div key={qId} className="text-xs">
                                    <span className="text-gray-500">
                                      {question?.label || qId}:
                                    </span>{" "}
                                    <span className="font-medium">{String(answer)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {resPagination.pages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Showing {responses.length} of {resPagination.total} responses
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResPage((p) => Math.max(1, p - 1))}
                        disabled={resPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="px-3 py-1.5 text-sm">
                        Page {resPage} of {resPagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResPage((p) => Math.min(resPagination.pages, p + 1))}
                        disabled={resPage === resPagination.pages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Share Tab */}
        {activeTab === "share" && survey && (
          <div className="max-w-lg mx-auto space-y-8">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Share Your Survey</h3>
              <p className="text-sm text-gray-500">Share this link or QR code to collect responses</p>
            </div>

            {/* Brand Preview */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Public Page Preview
                </span>
              </div>
              <div className="p-6 space-y-4">
                {/* Header: Logo + Business Name */}
                <div className="text-center space-y-2">
                  {brand?.logo ? (
                    <img src={brand.logo} alt={brand.name} className="h-10 mx-auto object-contain" />
                  ) : brand?.iconLogo ? (
                    <img
                      src={brand.iconLogo}
                      alt={brand.name}
                      className="h-10 w-10 mx-auto rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 mx-auto rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                      Logo
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-500">
                    {brand?.name || "Your Business Name"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-semibold">{survey.title}</p>
                  {survey.description && (
                    <p className="text-sm text-gray-400">{survey.description}</p>
                  )}
                </div>
                {/* Footer: Contact Info */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="flex flex-wrap gap-3 justify-center text-xs text-gray-400">
                    {brand?.email && <span>{brand.email}</span>}
                    {brand?.phone && <span>{brand.phone}</span>}
                    {brand?.website && <span>{brand.website}</span>}
                    {brand?.address && <span>{brand.address}</span>}
                    {!brand?.email && !brand?.phone && !brand?.website && !brand?.address && (
                      <span className="italic">
                        No contact info -- set up your Brand Kit in Settings
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {!brand && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">No Brand Kit found</p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  Set up your{" "}
                  <a href="/settings" className="underline font-medium">
                    Brand Kit
                  </a>{" "}
                  to display your logo, business name, and contact info on the public survey page.
                </p>
              </div>
            )}

            <QRCodeDisplay url={surveyUrl} />

            <div className="space-y-2">
              <label className="text-sm font-medium">Embed Code</label>
              <textarea
                readOnly
                rows={3}
                className="w-full text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                value={`<iframe src="${surveyUrl}" width="100%" height="600" frameborder="0"></iframe>`}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </div>
          </div>
        )}

        {/* Send Tab */}
        {activeTab === "send" && survey && (
          <div className="max-w-lg space-y-6">
            {questions.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="font-medium mb-1">Add questions first</p>
                <p className="text-sm text-gray-500 mb-4">
                  You need at least one question before you can send your survey.
                </p>
                <Button variant="outline" onClick={() => setActiveTab("builder")}>
                  Go to Builder
                </Button>
              </div>
            ) : (
              <>
                {/* Contact List Selector */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Contact List</label>
                  <select
                    value={sendListId}
                    onChange={(e) => setSendListId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  >
                    <option value="">Select a contact list...</option>
                    {contactLists.map((cl) => (
                      <option key={cl.id} value={cl.id}>
                        {cl.name} ({cl.totalCount} contacts)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Channel Toggle */}
                <div>
                  <label className="block text-sm font-medium mb-2">Channel</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSendChannel("email")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                        sendChannel === "email"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-blue-200"
                      }`}
                    >
                      <Mail
                        className={`h-6 w-6 ${
                          sendChannel === "email" ? "text-blue-500" : "text-gray-400"
                        }`}
                      />
                      <span className="text-sm font-medium">Email</span>
                      <span className="text-xs text-gray-500">Send via email marketing</span>
                    </button>
                    <button
                      onClick={() => setSendChannel("sms")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                        sendChannel === "sms"
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-green-200"
                      }`}
                    >
                      <Phone
                        className={`h-6 w-6 ${
                          sendChannel === "sms" ? "text-green-500" : "text-gray-400"
                        }`}
                      />
                      <span className="text-sm font-medium">SMS</span>
                      <span className="text-xs text-gray-500">Send via text message</span>
                    </button>
                  </div>
                </div>

                {/* Survey Link */}
                {survey.slug && (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 mb-1">Survey link that will be sent:</p>
                    <code className="text-xs break-all">{surveyUrl}</code>
                  </div>
                )}

                {/* Send Count + Last Sent */}
                {(survey.sendCount > 0 || survey.lastSentAt) && (
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {survey.sendCount > 0 && <span>Total sent: {survey.sendCount}</span>}
                    {survey.lastSentAt && (
                      <span>Last sent: {new Date(survey.lastSentAt).toLocaleString()}</span>
                    )}
                  </div>
                )}

                {/* Send Button */}
                <Button
                  onClick={handleSend}
                  disabled={isSending || !sendListId}
                  className="w-full"
                >
                  {isSending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {isSending ? "Sending..." : `Send via ${sendChannel === "email" ? "Email" : "SMS"}`}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
