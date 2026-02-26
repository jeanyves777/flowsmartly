"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MessageSquare,
  Tag,
  Forward,
  Webhook,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { WhatsAppAccount, Automation } from "./types";

interface WhatsAppAutomationsProps {
  account: WhatsAppAccount;
}

const TRIGGER_TYPES = [
  { value: "keyword", label: "Keyword Match", description: "Trigger when a message contains specific keywords" },
  { value: "new_conversation", label: "New Conversation", description: "Trigger when a new conversation starts" },
  { value: "inbound_message", label: "Any Inbound Message", description: "Trigger on every incoming message" },
  { value: "missed_chat", label: "Missed Chat", description: "Trigger when no one replies within a set time" },
];

const ACTION_TYPES = [
  { value: "send_message", label: "Send Message", icon: MessageSquare },
  { value: "send_template", label: "Send Template", icon: MessageSquare },
  { value: "add_tag", label: "Add Tag", icon: Tag },
  { value: "webhook", label: "Call Webhook", icon: Webhook },
];

interface AutomationForm {
  name: string;
  triggerType: string;
  triggerConfig: { keywords?: string[] };
  actionType: string;
  actionValue: string;
  isActive: boolean;
}

const defaultForm: AutomationForm = {
  name: "",
  triggerType: "keyword",
  triggerConfig: { keywords: [] },
  actionType: "send_message",
  actionValue: "",
  isActive: true,
};

export function WhatsAppAutomations({ account }: WhatsAppAutomationsProps) {
  const { toast } = useToast();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AutomationForm>(defaultForm);
  const [keywordInput, setKeywordInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadAutomations = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/automations");
      const data = await res.json();
      if (data.success) {
        // Filter to current account
        setAutomations(
          (data.automations || []).filter(
            (a: Automation) => a.socialAccountId === account.id
          )
        );
      }
    } catch (error) {
      console.error("Error loading automations:", error);
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  function openCreateDialog() {
    setForm(defaultForm);
    setEditingId(null);
    setKeywordInput("");
    setShowDialog(true);
  }

  function openEditDialog(automation: Automation) {
    const triggerConfig = automation.triggerConfig
      ? JSON.parse(automation.triggerConfig)
      : { keywords: [] };
    setForm({
      name: automation.name,
      triggerType: automation.triggerType,
      triggerConfig,
      actionType: automation.actionType,
      actionValue: automation.actionValue || "",
      isActive: automation.isActive,
    });
    setKeywordInput("");
    setEditingId(automation.id);
    setShowDialog(true);
  }

  function addKeyword() {
    const keyword = keywordInput.trim().toLowerCase();
    if (keyword && !form.triggerConfig.keywords?.includes(keyword)) {
      setForm({
        ...form,
        triggerConfig: {
          ...form.triggerConfig,
          keywords: [...(form.triggerConfig.keywords || []), keyword],
        },
      });
    }
    setKeywordInput("");
  }

  function removeKeyword(kw: string) {
    setForm({
      ...form,
      triggerConfig: {
        ...form.triggerConfig,
        keywords: form.triggerConfig.keywords?.filter((k) => k !== kw) || [],
      },
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!form.actionValue.trim() && form.actionType === "send_message") {
      toast({ title: "Message text is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Update
        const res = await fetch("/api/whatsapp/automations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            automationId: editingId,
            name: form.name,
            triggerType: form.triggerType,
            triggerConfig: form.triggerConfig,
            actionType: form.actionType,
            actionValue: form.actionValue,
            isActive: form.isActive,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast({ title: "Automation updated" });
          setShowDialog(false);
          await loadAutomations();
        } else {
          toast({ title: "Failed to update", description: data.error, variant: "destructive" });
        }
      } else {
        // Create
        const res = await fetch("/api/whatsapp/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            triggerType: form.triggerType,
            triggerConfig: form.triggerConfig,
            actionType: form.actionType,
            actionValue: form.actionValue,
            socialAccountId: account.id,
            isActive: form.isActive,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast({ title: "Automation created" });
          setShowDialog(false);
          await loadAutomations();
        } else {
          toast({ title: "Failed to create", description: data.error, variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Error saving automation", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(automation: Automation) {
    try {
      const res = await fetch("/api/whatsapp/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          automationId: automation.id,
          isActive: !automation.isActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAutomations((prev) =>
          prev.map((a) =>
            a.id === automation.id ? { ...a, isActive: !a.isActive } : a
          )
        );
      }
    } catch {
      toast({ title: "Failed to toggle", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/whatsapp/automations?automationId=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Automation deleted" });
        setDeleteConfirm(null);
        await loadAutomations();
      } else {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  function getTriggerLabel(type: string) {
    return TRIGGER_TYPES.find((t) => t.value === type)?.label || type;
  }

  function getActionLabel(type: string) {
    return ACTION_TYPES.find((a) => a.value === type)?.label || type;
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
          <h3 className="font-semibold">Automations</h3>
          <p className="text-xs text-muted-foreground">
            {automations.length} automation{automations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          New Automation
        </Button>
      </div>

      {/* Automations List */}
      {automations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Automations</h3>
            <p className="text-sm text-muted-foreground max-w-sm text-center">
              Create automations to auto-reply, tag conversations, or trigger webhooks based on keywords and events.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-green-500 hover:bg-green-600"
              onClick={openCreateDialog}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Automation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => {
            const triggerConfig = automation.triggerConfig
              ? JSON.parse(automation.triggerConfig)
              : {};

            return (
              <Card key={automation.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          automation.isActive ? "bg-green-500/10" : "bg-muted"
                        }`}
                      >
                        <Zap
                          className={`w-5 h-5 ${
                            automation.isActive ? "text-green-500" : "text-muted-foreground"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{automation.name}</p>
                          {!automation.isActive && (
                            <Badge variant="secondary" className="text-[10px]">
                              Paused
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {getTriggerLabel(automation.triggerType)}
                          </Badge>
                          <span className="text-muted-foreground text-[10px]">→</span>
                          <Badge variant="outline" className="text-[10px]">
                            {getActionLabel(automation.actionType)}
                          </Badge>
                        </div>
                        {triggerConfig.keywords?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {triggerConfig.keywords.map((kw: string) => (
                              <Badge
                                key={kw}
                                variant="secondary"
                                className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400"
                              >
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {automation.actionValue && (
                          <p className="text-xs text-muted-foreground mt-1.5 truncate">
                            Reply: &quot;{automation.actionValue}&quot;
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Used {automation.usageCount} time{automation.usageCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={automation.isActive}
                        onCheckedChange={() => handleToggle(automation)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(automation)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={() => setDeleteConfirm(automation.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  {editingId ? "Edit Automation" : "New Automation"}
                </h3>
                <button
                  onClick={() => setShowDialog(false)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Name</label>
                <Input
                  placeholder="e.g. Welcome Message"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Trigger Type */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Trigger</label>
                <div className="grid grid-cols-2 gap-2">
                  {TRIGGER_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setForm({ ...form, triggerType: t.value })}
                      className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                        form.triggerType === t.value
                          ? "border-green-500 bg-green-500/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <p className="font-medium text-xs">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Keywords (for keyword trigger) */}
              {form.triggerType === "keyword" && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Keywords</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add keyword..."
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addKeyword();
                        }
                      }}
                    />
                    <Button variant="outline" onClick={addKeyword} disabled={!keywordInput.trim()}>
                      Add
                    </Button>
                  </div>
                  {(form.triggerConfig.keywords?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.triggerConfig.keywords?.map((kw) => (
                        <Badge
                          key={kw}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-destructive/20"
                          onClick={() => removeKeyword(kw)}
                        >
                          {kw}
                          <X className="w-3 h-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Type */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Action</label>
                <div className="grid grid-cols-2 gap-2">
                  {ACTION_TYPES.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.value}
                        onClick={() => setForm({ ...form, actionType: a.value })}
                        className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                          form.actionType === a.value
                            ? "border-green-500 bg-green-500/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-medium">{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Value */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {form.actionType === "send_message"
                    ? "Message Text"
                    : form.actionType === "send_template"
                    ? "Template Name"
                    : form.actionType === "add_tag"
                    ? "Tag Name"
                    : "Webhook URL"}
                </label>
                {form.actionType === "send_message" ? (
                  <Textarea
                    placeholder="Type the auto-reply message..."
                    value={form.actionValue}
                    onChange={(e) => setForm({ ...form, actionValue: e.target.value })}
                    rows={3}
                  />
                ) : (
                  <Input
                    placeholder={
                      form.actionType === "send_template"
                        ? "Template name"
                        : form.actionType === "add_tag"
                        ? "Tag to add"
                        : "https://..."
                    }
                    value={form.actionValue}
                    onChange={(e) => setForm({ ...form, actionValue: e.target.value })}
                  />
                )}
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Active</label>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingId ? "Save Changes" : "Create Automation"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="max-w-sm w-full mx-4">
            <div className="p-6 space-y-4">
              <h3 className="font-semibold">Delete Automation?</h3>
              <p className="text-sm text-muted-foreground">
                This will permanently delete this automation rule. This action cannot be undone.
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
