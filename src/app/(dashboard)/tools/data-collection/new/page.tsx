"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, GripVertical, Eye, Save, Send, ChevronDown, ChevronUp, X, Search, Sparkles, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIELD_TYPES, type DataFormField, type DataFormFieldType, type DataFormType } from "@/types/data-form";

export default function NewFormPage() {
  const router = useRouter();

  const [formType, setFormType] = useState<DataFormType>("STANDARD");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("Thank you for your submission!");
  const [fields, setFields] = useState<DataFormField[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  // Contact list selection for Smart Collect
  const [contactLists, setContactLists] = useState<{ id: string; name: string; totalCount: number }[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [listsLoading, setListsLoading] = useState(false);

  // Fetch contact lists when Smart Collect is selected
  useEffect(() => {
    if (formType === "SMART_COLLECT") {
      setListsLoading(true);
      fetch("/api/contact-lists?limit=100")
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setContactLists(json.data?.lists || []);
        })
        .catch(() => {})
        .finally(() => setListsLoading(false));
    }
  }, [formType]);

  const genId = () => Math.random().toString(36).slice(2, 9);

  const addField = (type: DataFormFieldType) => {
    const typeLabel = FIELD_TYPES.find(t => t.value === type)?.label || type;
    const newField: DataFormField = {
      id: genId(),
      type,
      label: typeLabel,
      required: false,
      placeholder: "",
      options: ["select", "radio", "checkbox"].includes(type) ? ["Option 1", "Option 2"] : undefined,
    };
    setFields(prev => [...prev, newField]);
    setExpandedField(newField.id);
    setShowTypeSelector(false);
  };

  const updateField = (id: string, updates: Partial<DataFormField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newFields = [...fields];
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= newFields.length) return;
    [newFields[index], newFields[swap]] = [newFields[swap], newFields[index]];
    setFields(newFields);
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }
    if (formType === "SMART_COLLECT" && !selectedListId) {
      alert("Please select a contact list for Smart Collect");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        thankYouMessage: thankYouMessage.trim(),
        type: formType,
      };
      if (formType === "STANDARD") {
        body.fields = fields;
        body.status = publish && fields.length > 0 ? "ACTIVE" : "DRAFT";
      } else {
        // Smart Collect — no custom fields needed, always ACTIVE
        body.fields = [];
        body.status = "ACTIVE";
        body.contactListId = selectedListId;
      }
      const res = await fetch("/api/data-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/tools/data-collection/${json.data.id}`);
      } else {
        alert(json.error?.message || "Failed to save form");
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  const renderFieldPreview = (field: DataFormField) => {
    const baseClasses = "w-full px-3 py-2 border border-border rounded-md bg-card text-foreground";

    switch (field.type) {
      case "text":
      case "email":
      case "phone":
      case "number":
      case "url":
        return <input type={field.type === "phone" ? "tel" : field.type} placeholder={field.placeholder || ""} className={baseClasses} disabled />;
      case "textarea":
        return <textarea placeholder={field.placeholder || ""} className={`${baseClasses} resize-none`} rows={3} disabled />;
      case "date":
        return <input type="date" className={baseClasses} disabled />;
      case "select":
        return (
          <select className={baseClasses} disabled>
            <option>{field.placeholder || "Select an option"}</option>
            {field.options?.map((opt, i) => <option key={i}>{opt}</option>)}
          </select>
        );
      case "radio":
        return (
          <div className="space-y-2">
            {field.options?.map((opt, i) => (
              <label key={i} className="flex items-center gap-2"><input type="radio" name={field.id} disabled /><span className="text-sm text-foreground">{opt}</span></label>
            ))}
          </div>
        );
      case "checkbox":
        return (
          <div className="space-y-2">
            {field.options?.map((opt, i) => (
              <label key={i} className="flex items-center gap-2"><input type="checkbox" disabled /><span className="text-sm text-foreground">{opt}</span></label>
            ))}
          </div>
        );
      case "address":
        return (
          <div className="space-y-2">
            <input placeholder="Street Address" className={baseClasses} disabled />
            <input placeholder="City" className={baseClasses} disabled />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="State" className={baseClasses} disabled />
              <input placeholder="ZIP Code" className={baseClasses} disabled />
            </div>
          </div>
        );
      default:
        return <input type="text" className={baseClasses} disabled />;
    }
  };

  const canPublish = formType === "SMART_COLLECT"
    ? !!title.trim() && !!selectedListId
    : !!title.trim() && fields.length > 0;

  return (
    <div className="min-h-screen bg-muted/50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/tools/data-collection">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-foreground">Create Form</h1>
            </div>
            <div className="flex items-center gap-2">
              {formType === "STANDARD" && (
                <Button variant="outline" onClick={() => setShowPreview(!showPreview)} className="lg:hidden">
                  <Eye className="h-4 w-4 mr-2" />
                  {showPreview ? "Hide" : "Show"} Preview
                </Button>
              )}
              {formType === "STANDARD" && (
                <Button variant="outline" onClick={() => handleSave(false)} disabled={saving || !title.trim()}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
              )}
              <Button onClick={() => handleSave(true)} disabled={saving || !canPublish}>
                <Send className="h-4 w-4 mr-2" />
                {formType === "SMART_COLLECT" ? "Create & Publish" : "Publish"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Form Type Selector */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-muted-foreground mb-3">Form Type</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <button
              onClick={() => setFormType("STANDARD")}
              className={`p-5 rounded-xl border-2 text-left transition-all ${
                formType === "STANDARD"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-border hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  formType === "STANDARD" ? "bg-blue-100 dark:bg-blue-900" : "bg-muted"
                }`}>
                  <FileText className={`h-5 w-5 ${formType === "STANDARD" ? "text-blue-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Standard Form</h3>
                  <p className="text-xs text-muted-foreground">Custom fields, collect new data</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setFormType("SMART_COLLECT")}
              className={`p-5 rounded-xl border-2 text-left transition-all ${
                formType === "SMART_COLLECT"
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                  : "border-border hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  formType === "SMART_COLLECT" ? "bg-purple-100 dark:bg-purple-900" : "bg-muted"
                }`}>
                  <Sparkles className={`h-5 w-5 ${formType === "SMART_COLLECT" ? "text-purple-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Smart Collect</h3>
                  <p className="text-xs text-muted-foreground">Search existing contacts, fill missing info</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Builder Section */}
          <div className={`space-y-6 ${showPreview ? "hidden lg:block" : ""}`}>
            {/* Form Settings */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Form Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={formType === "SMART_COLLECT" ? "e.g., Complete Your Contact Info" : "e.g., Customer Feedback Survey"}
                  className="text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={formType === "SMART_COLLECT" ? "e.g., Help us keep your contact info up to date!" : "Add a brief description of this form..."}
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground resize-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Thank You Message</label>
                <Input
                  value={thankYouMessage}
                  onChange={(e) => setThankYouMessage(e.target.value)}
                  placeholder="Message shown after submission"
                />
              </div>
            </div>

            {/* Smart Collect: Contact List Picker */}
            {formType === "SMART_COLLECT" && (
              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Contact List</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Contacts will search for their name in this list and complete any missing information.
                  </p>
                  {listsLoading ? (
                    <div className="text-center py-4 text-muted-foreground">Loading lists...</div>
                  ) : contactLists.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>No contact lists found.</p>
                      <p className="text-sm mt-1">Create a contact list first in the Contacts section.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contactLists.map((list) => (
                        <button
                          key={list.id}
                          onClick={() => setSelectedListId(list.id)}
                          className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center justify-between ${
                            selectedListId === list.id
                              ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                              : "border-border hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                        >
                          <div>
                            <p className="font-medium text-foreground">{list.name}</p>
                            <p className="text-sm text-muted-foreground">{list.totalCount} contacts</p>
                          </div>
                          {selectedListId === list.id && (
                            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info about how Smart Collect works */}
                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-2">How Smart Collect Works</h3>
                  <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                    <li>1. Contact types their first name in the search bar</li>
                    <li>2. Matching contacts from your list are displayed</li>
                    <li>3. They select their name and see what info is already on file</li>
                    <li>4. Only missing fields are shown for them to complete</li>
                    <li>5. If everything is already filled, they see a thank you</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Standard Form: Fields Builder */}
            {formType === "STANDARD" && (
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Form Fields</h2>
                  <Button variant="outline" size="sm" onClick={() => setShowTypeSelector(!showTypeSelector)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Field
                  </Button>
                </div>

                {/* Field Type Selector */}
                {showTypeSelector && (
                  <div className="mb-4 p-4 border border-border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-foreground">Select Field Type</h3>
                      <Button variant="ghost" size="sm" onClick={() => setShowTypeSelector(false)}><X className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {FIELD_TYPES.map((type) => (
                        <button key={type.value} onClick={() => addField(type.value)} className="p-3 text-left border border-border rounded-lg hover:bg-card hover:shadow-sm transition-all">
                          <div className="text-sm font-medium text-foreground">{type.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field List */}
                {fields.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No fields added yet.</p>
                    <p className="text-sm mt-1">Click &quot;Add Field&quot; to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="border border-border rounded-lg bg-card">
                        <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted transition-colors" onClick={() => setExpandedField(expandedField === field.id ? null : field.id)}>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground uppercase">{field.type}</span>
                          <span className="font-medium flex-1 text-foreground">{field.label}</span>
                          {field.required && <span className="text-xs text-red-500 font-medium">Required</span>}
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedField === field.id ? "rotate-180" : ""}`} />
                        </div>
                        {expandedField === field.id && (
                          <div className="p-3 pt-0 space-y-3 border-t border-border">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Label</label>
                              <Input value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} placeholder="Field label" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Placeholder</label>
                              <Input value={field.placeholder || ""} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} placeholder="Placeholder text" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Help Text</label>
                              <Input value={field.helpText || ""} onChange={(e) => updateField(field.id, { helpText: e.target.value })} placeholder="Help text (optional)" />
                            </div>
                            {field.options && (
                              <div className="space-y-2">
                                <label className="block text-xs font-medium text-muted-foreground">Options</label>
                                {field.options.map((opt, i) => (
                                  <div key={i} className="flex gap-2">
                                    <Input value={opt} onChange={(e) => { const newOpts = [...field.options!]; newOpts[i] = e.target.value; updateField(field.id, { options: newOpts }); }} />
                                    <Button variant="ghost" size="sm" onClick={() => updateField(field.id, { options: field.options!.filter((_, j) => j !== i) })}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={() => updateField(field.id, { options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })}>
                                  <Plus className="h-3 w-3 mr-1" /> Add Option
                                </Button>
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-2">
                              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked })} className="rounded" />
                                Required
                              </label>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => moveField(index, "up")} disabled={index === 0} title="Move up"><ChevronUp className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => moveField(index, "down")} disabled={index === fields.length - 1} title="Move down"><ChevronDown className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => setFields((prev) => prev.filter((f) => f.id !== field.id))} className="text-red-500 hover:text-red-700" title="Remove field"><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview Section */}
          <div className={`${!showPreview && formType === "STANDARD" ? "hidden lg:block" : formType === "SMART_COLLECT" ? "hidden lg:block" : ""}`}>
            <div className="sticky top-24">
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Live Preview</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)} className="lg:hidden"><X className="h-4 w-4" /></Button>
                </div>

                {/* Phone Frame */}
                <div className="mx-auto max-w-sm">
                  <div className="border-8 border-gray-800 dark:border-gray-600 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="bg-background h-[600px] overflow-y-auto">
                      <div className="p-6 space-y-6">
                        {formType === "SMART_COLLECT" ? (
                          <>
                            {title && <h3 className="text-xl font-bold text-foreground text-center">{title}</h3>}
                            {description && <p className="text-sm text-muted-foreground text-center">{description}</p>}
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <input type="text" placeholder="Start typing your first name..." className="w-full pl-10 pr-3 py-2.5 border border-border rounded-xl bg-card text-foreground text-sm" disabled />
                            </div>
                            <div className="space-y-2">
                              {["John D.", "Jane S.", "Joe M."].map((name) => (
                                <div key={name} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">{name[0]}</div>
                                  <span className="text-sm font-medium text-foreground">{name}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-center text-muted-foreground italic">
                              Contacts search &rarr; select &rarr; fill missing fields
                            </p>
                          </>
                        ) : (
                          <>
                            {title && (
                              <div>
                                <h3 className="text-xl font-bold text-foreground">{title}</h3>
                                {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
                              </div>
                            )}
                            {fields.length > 0 ? (
                              <div className="space-y-4">
                                {fields.map((field) => (
                                  <div key={field.id}>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                                      {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    {renderFieldPreview(field)}
                                    {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
                                  </div>
                                ))}
                                <button disabled className="w-full py-2 px-4 bg-blue-600 text-white rounded-md font-medium opacity-50 cursor-not-allowed">Submit</button>
                              </div>
                            ) : (
                              <div className="text-center py-12 text-muted-foreground">
                                <p className="text-sm">Your form fields will appear here</p>
                              </div>
                            )}
                          </>
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
