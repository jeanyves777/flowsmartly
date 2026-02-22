"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
  Copy, Check, ExternalLink, Download, Eye, Settings as SettingsIcon,
  FileText, Send, Users, Search, MoreVertical, RefreshCw, Mail, MessageSquare,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIELD_TYPES, FORM_STATUS_CONFIG, type DataFormField, type DataFormFieldType, type DataFormData, type DataFormSubmissionData } from "@/types/data-form";
import { QRCodeDisplay } from "@/components/data-forms/qr-code-display";

export default function DataFormDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [form, setForm] = useState<DataFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"builder" | "submissions" | "share" | "send" | "settings">("builder");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Builder state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<DataFormField[]>([]);
  const [thankYouMessage, setThankYouMessage] = useState("");
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  // Submissions state
  const [submissions, setSubmissions] = useState<DataFormSubmissionData[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subPage, setSubPage] = useState(1);
  const [subPagination, setSubPagination] = useState<{total:number;pages:number}>({total:0,pages:0});
  const [subSearch, setSubSearch] = useState("");
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());

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
  const [contactLists, setContactLists] = useState<{id: string; name: string; totalCount: number}[]>([]);
  const [sendListId, setSendListId] = useState("");
  const [sendChannel, setSendChannel] = useState<"email" | "sms">("email");
  const [isSending, setIsSending] = useState(false);

  // Fetch brand
  useEffect(() => {
    fetch("/api/brand")
      .then(r => r.json())
      .then(json => {
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

  // Fetch form
  const fetchForm = useCallback(async () => {
    try {
      const res = await fetch(`/api/data-forms/${id}`);
      const json = await res.json();
      if (json.success) {
        setForm(json.data);
        setTitle(json.data.title);
        setDescription(json.data.description || "");
        setFields(json.data.fields);
        setThankYouMessage(json.data.thankYouMessage);
      } else {
        router.push("/tools/data-collection");
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchForm(); }, [fetchForm]);

  // Fetch submissions
  const fetchSubmissions = useCallback(async () => {
    setSubLoading(true);
    try {
      const params = new URLSearchParams({ page: String(subPage), limit: "20" });
      if (subSearch) params.set("search", subSearch);
      const res = await fetch(`/api/data-forms/${id}/submissions?${params}`);
      const json = await res.json();
      if (json.success) {
        setSubmissions(json.data);
        setSubPagination(json.pagination);
      }
    } finally {
      setSubLoading(false);
    }
  }, [id, subPage, subSearch]);

  useEffect(() => {
    if (activeTab === "submissions") fetchSubmissions();
  }, [activeTab, fetchSubmissions]);

  // Fetch contact lists when send tab is active
  useEffect(() => {
    if (activeTab === "send") {
      fetch("/api/contact-lists?limit=100")
        .then(r => r.json())
        .then(json => {
          if (json.success) setContactLists(json.data || []);
        })
        .catch(() => {});
    }
  }, [activeTab]);

  // Send form handler
  const handleSendForm = async () => {
    if (!sendListId) {
      showToast("Please select a contact list");
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch(`/api/data-forms/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: sendChannel, contactListId: sendListId }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.data.message);
        fetchForm();
      } else {
        showToast(json.error?.message || "Failed to send form");
      }
    } catch {
      showToast("Failed to send form");
    } finally {
      setIsSending(false);
    }
  };

  // Save form (builder)
  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/data-forms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          fields,
          thankYouMessage: thankYouMessage.trim()
        }),
      });
      const json = await res.json();
      if (json.success) {
        setForm(json.data);
        showToast("Form saved!");
      }
    } finally {
      setSaving(false);
    }
  };

  // Field builder helpers
  const genId = () => Math.random().toString(36).slice(2, 9);

  const addField = (type: DataFormFieldType) => {
    const typeLabel = FIELD_TYPES.find(t => t.value === type)?.label || type;
    setFields(prev => [...prev, {
      id: genId(),
      type,
      label: typeLabel,
      required: false,
      placeholder: "",
      options: ["select","radio","checkbox"].includes(type) ? ["Option 1","Option 2"] : undefined
    }]);
    setShowTypeSelector(false);
  };

  const updateField = (fieldId: string, updates: Partial<DataFormField>) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const moveField = (index: number, dir: "up" | "down") => {
    const arr = [...fields];
    const swap = dir === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[index], arr[swap]] = [arr[swap], arr[index]];
    setFields(arr);
  };

  const deleteField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
  };

  // Submissions actions
  const handleSyncContacts = async () => {
    const ids = selectedSubs.size > 0 ? Array.from(selectedSubs) : undefined;
    const res = await fetch(`/api/data-forms/${id}/sync-contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionIds: ids }),
    });
    const json = await res.json();
    if (json.success) showToast(`${json.data.created} contacts created, ${json.data.linked} linked`);
  };

  const handleCreateFollowUp = async () => {
    const ids = selectedSubs.size > 0 ? Array.from(selectedSubs) : undefined;
    const res = await fetch(`/api/data-forms/${id}/create-followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionIds: ids }),
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Follow-up created with ${json.data.entriesCreated} entries`);
      router.push(`/tools/follow-ups/${json.data.followUpId}`);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedSubs.size} submissions?`)) return;
    const res = await fetch(`/api/data-forms/${id}/submissions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedSubs) }),
    });
    const json = await res.json();
    if (json.success) {
      setSelectedSubs(new Set());
      fetchSubmissions();
      fetchForm();
      showToast(`${json.data.deleted} submissions deleted`);
    }
  };

  // Settings actions
  const handleStatusChange = async (status: "DRAFT" | "ACTIVE" | "CLOSED") => {
    const res = await fetch(`/api/data-forms/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.success) {
      setForm(json.data);
      showToast(`Form status changed to ${FORM_STATUS_CONFIG[status].label}`);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this form? This action cannot be undone.")) return;
    const res = await fetch(`/api/data-forms/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      router.push("/tools/data-collection");
    }
  };

  // Toast helper
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // Tab configuration
  const tabs = [
    { key: "builder" as const, label: "Builder", icon: FileText },
    { key: "submissions" as const, label: `Submissions (${form?.responseCount || 0})`, icon: Users },
    { key: "share" as const, label: "Share", icon: Share2 },
    { key: "send" as const, label: "Send", icon: Send },
    { key: "settings" as const, label: "Settings", icon: SettingsIcon },
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
        <Link href="/tools/data-collection" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{form?.title || "Loading..."}</h1>
            {form && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${FORM_STATUS_CONFIG[form.status].color}`}>
                {FORM_STATUS_CONFIG[form.status].label}
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
        {tabs.map(tab => (
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
                <label className="block text-sm font-medium mb-1.5">Form Title</label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Enter form title"
                  className="text-lg font-semibold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description (optional)</label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of your form"
                />
              </div>
            </div>

            {/* Fields List */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Form Fields</h3>
              {fields.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                  <p className="text-gray-500 mb-4">No fields yet. Add your first field to get started.</p>
                </div>
              )}
              {fields.map((field, index) => (
                <div key={field.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <button className="mt-2 text-gray-400 hover:text-gray-600 cursor-move">
                      <GripVertical className="h-5 w-5" />
                    </button>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={field.label}
                          onChange={e => updateField(field.id, { label: e.target.value })}
                          placeholder="Field label"
                          className="flex-1"
                        />
                        <button
                          onClick={() => setExpandedField(expandedField === field.id ? null : field.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {expandedField === field.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-medium">
                          {FIELD_TYPES.find(t => t.value === field.type)?.label}
                        </span>
                        <label className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={e => updateField(field.id, { required: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-xs">Required</span>
                        </label>
                      </div>
                      {expandedField === field.id && (
                        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div>
                            <label className="block text-xs font-medium mb-1">Placeholder</label>
                            <Input
                              value={field.placeholder || ""}
                              onChange={e => updateField(field.id, { placeholder: e.target.value })}
                              placeholder="Placeholder text"
                              size={32}
                            />
                          </div>
                          {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && (
                            <div>
                              <label className="block text-xs font-medium mb-1">Options</label>
                              <div className="space-y-2">
                                {(field.options || []).map((opt, i) => (
                                  <div key={i} className="flex gap-2">
                                    <Input
                                      value={opt}
                                      onChange={e => {
                                        const newOpts = [...(field.options || [])];
                                        newOpts[i] = e.target.value;
                                        updateField(field.id, { options: newOpts });
                                      }}
                                      size={32}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const newOpts = (field.options || []).filter((_, idx) => idx !== i);
                                        updateField(field.id, { options: newOpts });
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
                                    const newOpts = [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`];
                                    updateField(field.id, { options: newOpts });
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
                        onClick={() => moveField(index, "up")}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveField(index, "down")}
                        disabled={index === fields.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteField(field.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Field Button */}
            <div className="relative">
              <Button onClick={() => setShowTypeSelector(!showTypeSelector)} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
              {showTypeSelector && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-10">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FIELD_TYPES.map(type => (
                      <button
                        key={type.value}
                        onClick={() => addField(type.value)}
                        className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                      >
                        <span className="text-xs font-mono text-gray-400 uppercase w-5 text-center">{type.value.charAt(0)}</span>
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
                onChange={e => setThankYouMessage(e.target.value)}
                placeholder="Thank you for your submission!"
              />
            </div>
          </div>
        )}

        {/* Submissions Tab */}
        {activeTab === "submissions" && (
          <div className="space-y-4">
            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSyncContacts} disabled={submissions.length === 0}>
                  <Users className="h-4 w-4 mr-1" />
                  Sync to Contacts
                </Button>
                <Button variant="outline" size="sm" onClick={handleCreateFollowUp} disabled={submissions.length === 0}>
                  <Send className="h-4 w-4 mr-1" />
                  Create Follow-Up
                </Button>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={subSearch}
                    onChange={e => setSubSearch(e.target.value)}
                    placeholder="Search submissions..."
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                {selectedSubs.size > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete ({selectedSubs.size})
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            {subLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500">No submissions yet</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={submissions.length > 0 && selectedSubs.size === submissions.length}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedSubs(new Set(submissions.map(s => s.id)));
                              } else {
                                setSelectedSubs(new Set());
                              }
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Email</th>
                        {fields.slice(0, 4).map(field => (
                          <th key={field.id} className="px-4 py-3 text-left font-medium">{field.label}</th>
                        ))}
                        <th className="px-4 py-3 text-left font-medium">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {submissions.map(sub => (
                        <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedSubs.has(sub.id)}
                              onChange={e => {
                                const newSet = new Set(selectedSubs);
                                if (e.target.checked) {
                                  newSet.add(sub.id);
                                } else {
                                  newSet.delete(sub.id);
                                }
                                setSelectedSubs(newSet);
                              }}
                              className="rounded"
                            />
                          </td>
                          <td className="px-4 py-3">{sub.respondentName || "-"}</td>
                          <td className="px-4 py-3">{sub.respondentEmail || "-"}</td>
                          {fields.slice(0, 4).map(field => (
                            <td key={field.id} className="px-4 py-3 max-w-xs truncate">
                              {String(sub.data[field.id] ?? "-")}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(sub.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {subPagination.pages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Showing {submissions.length} of {subPagination.total} submissions
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubPage(p => Math.max(1, p - 1))}
                        disabled={subPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="px-3 py-1.5 text-sm">
                        Page {subPage} of {subPagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubPage(p => Math.min(subPagination.pages, p + 1))}
                        disabled={subPage === subPagination.pages}
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
        {activeTab === "share" && form && (
          <div className="max-w-lg mx-auto space-y-8">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Share Your Form</h3>
              <p className="text-sm text-gray-500">Share this link or QR code to collect responses</p>
            </div>

            {/* Brand Preview */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Public Page Preview</span>
              </div>
              <div className="p-6 space-y-4">
                {/* Header: Logo + Business Name */}
                <div className="text-center space-y-2">
                  {brand?.logo ? (
                    <img src={brand.logo} alt={brand.name} className="h-10 mx-auto object-contain" />
                  ) : brand?.iconLogo ? (
                    <img src={brand.iconLogo} alt={brand.name} className="h-10 w-10 mx-auto rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 mx-auto rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400">Logo</div>
                  )}
                  <p className="text-sm font-medium text-gray-500">{brand?.name || "Your Business Name"}</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold">{form.title}</p>
                  {form.description && <p className="text-sm text-gray-400">{form.description}</p>}
                </div>
                {/* Footer: Contact Info */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="flex flex-wrap gap-3 justify-center text-xs text-gray-400">
                    {brand?.email && <span>{brand.email}</span>}
                    {brand?.phone && <span>{brand.phone}</span>}
                    {brand?.website && <span>{brand.website}</span>}
                    {brand?.address && <span>{brand.address}</span>}
                    {!brand?.email && !brand?.phone && !brand?.website && !brand?.address && (
                      <span className="italic">No contact info — set up your Brand Kit in Settings</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {!brand && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">No Brand Kit found</p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  Set up your <a href="/settings" className="underline font-medium">Brand Kit</a> to display your logo, business name, and contact info on the public form page.
                </p>
              </div>
            )}

            <QRCodeDisplay url={`${typeof window !== "undefined" ? window.location.origin : ""}/form/${form.slug}`} />

            <div className="space-y-2">
              <label className="text-sm font-medium">Embed Code</label>
              <textarea
                readOnly
                rows={3}
                className="w-full text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                value={`<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/form/${form.slug}" width="100%" height="600" frameborder="0"></iframe>`}
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
            </div>
          </div>
        )}

        {/* Send Tab */}
        {activeTab === "send" && form && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Send Your Form</h3>
              <p className="text-sm text-gray-500">Send this form to a contact list via email or SMS</p>
            </div>

            {form.status !== "ACTIVE" && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">Form is not active</p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  Change the form status to <span className="font-medium">Active</span> in the Settings tab before sending.
                </p>
              </div>
            )}

            {/* Send Stats */}
            <div className="flex gap-4">
              <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{form.sendCount || 0}</p>
                <p className="text-xs text-gray-500">Times Sent</p>
              </div>
              <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-sm font-medium">
                  {form.lastSentAt
                    ? new Date(form.lastSentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
                    : "Never"}
                </p>
                <p className="text-xs text-gray-500">Last Sent</p>
              </div>
            </div>

            {/* Form Link */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Form Link</label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/form/${form.slug}`}
                  className="flex-1 bg-gray-50 dark:bg-gray-800 text-sm"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/form/${form.slug}`);
                    showToast("Link copied!");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Channel Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Send via</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSendChannel("email")}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                    sendChannel === "email"
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <Mail className={`h-5 w-5 ${sendChannel === "email" ? "text-blue-600" : "text-gray-400"}`} />
                  <div className="text-left">
                    <p className={`text-sm font-medium ${sendChannel === "email" ? "text-blue-600" : ""}`}>Email</p>
                    <p className="text-xs text-gray-500">Send via email</p>
                  </div>
                </button>
                <button
                  onClick={() => setSendChannel("sms")}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                    sendChannel === "sms"
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <MessageSquare className={`h-5 w-5 ${sendChannel === "sms" ? "text-blue-600" : "text-gray-400"}`} />
                  <div className="text-left">
                    <p className={`text-sm font-medium ${sendChannel === "sms" ? "text-blue-600" : ""}`}>SMS</p>
                    <p className="text-xs text-gray-500">Send via text</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Contact List Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact List</label>
              <select
                value={sendListId}
                onChange={e => setSendListId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a contact list...</option>
                {contactLists.map(cl => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name} ({cl.totalCount} contacts)
                  </option>
                ))}
              </select>
              {contactLists.length === 0 && (
                <p className="text-xs text-gray-500">
                  No contact lists found.{" "}
                  <a href="/contacts" className="text-blue-600 hover:underline">Create one</a> first.
                </p>
              )}
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSendForm}
              disabled={isSending || !sendListId || form.status !== "ACTIVE"}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {isSending ? "Sending..." : `Send Form via ${sendChannel === "email" ? "Email" : "SMS"}`}
            </Button>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && form && (
          <div className="max-w-lg space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Form Status</label>
              <div className="flex gap-2">
                {(["DRAFT", "ACTIVE", "CLOSED"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.status === s
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {FORM_STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Thank You Message</label>
              <Input
                value={thankYouMessage}
                onChange={e => setThankYouMessage(e.target.value)}
                placeholder="Thank you for your submission!"
              />
              <Button variant="outline" size="sm" className="mt-2" onClick={handleSave}>
                Save
              </Button>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-sm font-semibold text-red-600 mb-2">Danger Zone</h3>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Form
              </Button>
            </div>
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
