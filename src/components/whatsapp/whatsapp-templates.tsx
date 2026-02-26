"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  X,
  CheckCircle,
  Clock,
  XCircle,
  Copy,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { WhatsAppAccount, Template } from "./types";

interface WhatsAppTemplatesProps {
  account: WhatsAppAccount;
}

const CATEGORIES = [
  { value: "MARKETING", label: "Marketing", description: "Promotional messages" },
  { value: "UTILITY", label: "Utility", description: "Account updates, order confirmations" },
  { value: "AUTHENTICATION", label: "Authentication", description: "OTP and verification codes" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "en_US", label: "English (US)" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "pt_BR", label: "Portuguese (BR)" },
  { value: "de", label: "German" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "zh_CN", label: "Chinese (Simplified)" },
];

interface TemplateForm {
  name: string;
  category: string;
  language: string;
  headerText: string;
  bodyText: string;
  footerText: string;
}

const defaultForm: TemplateForm = {
  name: "",
  category: "MARKETING",
  language: "en",
  headerText: "",
  bodyText: "",
  footerText: "",
};

export function WhatsAppTemplates({ account }: WhatsAppTemplatesProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreview, setShowPreview] = useState<Template | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(defaultForm);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const loadTemplates = useCallback(async () => {
    try {
      let url = "/api/whatsapp/templates?";
      if (filterCategory) url += `category=${filterCategory}&`;
      if (filterStatus) url += `status=${filterStatus}&`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        // Filter to current account
        setTemplates(
          (data.templates || []).filter(
            (t: Template) => t.socialAccountId === account.id
          )
        );
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  }, [account.id, filterCategory, filterStatus]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  async function handleCreate() {
    if (!form.name.trim() || !form.bodyText.trim()) {
      toast({ title: "Name and body text are required", variant: "destructive" });
      return;
    }

    // Validate name format (lowercase, no spaces)
    const validName = form.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (validName !== form.name) {
      setForm({ ...form, name: validName });
      toast({
        title: "Name adjusted",
        description: `Template name must be lowercase with underscores. Changed to: ${validName}`,
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          language: form.language,
          bodyText: form.bodyText,
          headerText: form.headerText || undefined,
          footerText: form.footerText || undefined,
          socialAccountId: account.id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: "Template created", description: "Submitted to WhatsApp for approval." });
        setShowCreateDialog(false);
        setForm(defaultForm);
        await loadTemplates();
      } else {
        toast({ title: "Failed to create", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error creating template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(
        `/api/whatsapp/templates?templateId=${id}&socialAccountId=${account.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        toast({ title: "Template deleted" });
        setDeleteConfirm(null);
        await loadTemplates();
      } else {
        toast({ title: "Failed to delete", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-[10px]">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  }

  function getCategoryBadge(category: string) {
    const colors: Record<string, string> = {
      MARKETING: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      UTILITY: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      AUTHENTICATION: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    };
    return (
      <Badge className={`${colors[category] || ""} text-[10px]`}>
        {category.charAt(0) + category.slice(1).toLowerCase()}
      </Badge>
    );
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Message Templates</h3>
          <p className="text-xs text-muted-foreground">
            {templates.length} template{templates.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          size="sm"
          className="bg-green-500 hover:bg-green-600"
          onClick={() => {
            setForm(defaultForm);
            setShowCreateDialog(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-8 text-xs rounded-md border bg-background px-2"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-8 text-xs rounded-md border bg-background px-2"
        >
          <option value="">All Status</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Templates</h3>
            <p className="text-sm text-muted-foreground max-w-sm text-center">
              Create message templates for sending to customers. Templates must be approved by WhatsApp before use.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-green-500 hover:bg-green-600"
              onClick={() => {
                setForm(defaultForm);
                setShowCreateDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((template) => (
            <Card key={template.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{template.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {template.language} &middot; Used {template.usageCount} time{template.usageCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setShowPreview(template)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600"
                      onClick={() => setDeleteConfirm(template.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-1.5 mb-3">
                  {getStatusBadge(template.status)}
                  {getCategoryBadge(template.category)}
                </div>

                {/* Preview snippet */}
                <div className="bg-muted/30 rounded-lg p-3 border">
                  {template.headerText && (
                    <p className="text-xs font-semibold mb-1">{template.headerText}</p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-3">{template.bodyText}</p>
                  {template.footerText && (
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{template.footerText}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">New Template</h3>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Form */}
                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Template Name</label>
                    <Input
                      placeholder="e.g. order_confirmation"
                      value={form.name}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          name: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
                        })
                      }
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Lowercase letters, numbers, and underscores only
                    </p>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Category</label>
                    <div className="space-y-2">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setForm({ ...form, category: c.value })}
                          className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                            form.category === c.value
                              ? "border-green-500 bg-green-500/5"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <p className="font-medium text-xs">{c.label}</p>
                          <p className="text-[10px] text-muted-foreground">{c.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Language</label>
                    <select
                      value={form.language}
                      onChange={(e) => setForm({ ...form, language: e.target.value })}
                      className="w-full h-9 text-sm rounded-md border bg-background px-3"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Header */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Header (optional)</label>
                    <Input
                      placeholder="Header text..."
                      value={form.headerText}
                      onChange={(e) => setForm({ ...form, headerText: e.target.value })}
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Body Text</label>
                    <Textarea
                      placeholder="Hello {{1}}, your order {{2}} has been confirmed..."
                      value={form.bodyText}
                      onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
                      rows={4}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Use {"{{1}}"}, {"{{2}}"}, etc. for variable placeholders
                    </p>
                  </div>

                  {/* Footer */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Footer (optional)</label>
                    <Input
                      placeholder="Footer text..."
                      value={form.footerText}
                      onChange={(e) => setForm({ ...form, footerText: e.target.value })}
                    />
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Preview</label>
                  <div className="bg-[#e5ddd5] dark:bg-[#0b141a] rounded-xl p-4 min-h-[300px]">
                    <div className="bg-white dark:bg-[#1f2c34] rounded-lg p-3 max-w-[280px] shadow-sm">
                      {form.headerText && (
                        <p className="font-semibold text-sm mb-1">{form.headerText}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">
                        {form.bodyText || (
                          <span className="text-muted-foreground italic">Body text goes here...</span>
                        )}
                      </p>
                      {form.footerText && (
                        <p className="text-xs text-muted-foreground mt-2">{form.footerText}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground text-right mt-1">
                        {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600"
                  onClick={handleCreate}
                  disabled={saving || !form.name.trim() || !form.bodyText.trim()}
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit for Approval
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Preview Dialog */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="max-w-md w-full mx-4">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{showPreview.name}</h3>
                  <div className="flex gap-1.5 mt-1">
                    {getStatusBadge(showPreview.status)}
                    {getCategoryBadge(showPreview.category)}
                  </div>
                </div>
                <button
                  onClick={() => setShowPreview(null)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* WhatsApp-style preview */}
              <div className="bg-[#e5ddd5] dark:bg-[#0b141a] rounded-xl p-4">
                <div className="bg-white dark:bg-[#1f2c34] rounded-lg p-3 max-w-[280px] shadow-sm">
                  {showPreview.headerText && (
                    <p className="font-semibold text-sm mb-1">{showPreview.headerText}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{showPreview.bodyText}</p>
                  {showPreview.footerText && (
                    <p className="text-xs text-muted-foreground mt-2">{showPreview.footerText}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground text-right mt-1">
                    {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Language: {showPreview.language}</p>
                <p>Used: {showPreview.usageCount} time{showPreview.usageCount !== 1 ? "s" : ""}</p>
                {showPreview.whatsappTemplateId && (
                  <p>WhatsApp ID: {showPreview.whatsappTemplateId}</p>
                )}
              </div>

              <Button variant="outline" className="w-full" onClick={() => setShowPreview(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="max-w-sm w-full mx-4">
            <div className="p-6 space-y-4">
              <h3 className="font-semibold">Delete Template?</h3>
              <p className="text-sm text-muted-foreground">
                This will delete the template from both WhatsApp and your account. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleDelete(deleteConfirm)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
