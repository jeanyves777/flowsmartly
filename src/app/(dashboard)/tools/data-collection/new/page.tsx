"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, Trash2, GripVertical, Eye, Save, Send, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { FIELD_TYPES, type DataFormField, type DataFormFieldType } from "@/types/data-form";

export default function NewFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("Thank you for your submission!");
  const [fields, setFields] = useState<DataFormField[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

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
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        fields,
        thankYouMessage: thankYouMessage.trim(),
        status: publish && fields.length > 0 ? "ACTIVE" : "DRAFT",
      };
      const res = await fetch("/api/data-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/tools/data-collection/${json.data.id}`);
      } else {
        alert(json.error || "Failed to save form");
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  const renderFieldPreview = (field: DataFormField) => {
    const baseClasses = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";

    switch (field.type) {
      case "text":
      case "email":
      case "phone":
      case "number":
      case "url":
        return (
          <input
            type={field.type === "phone" ? "tel" : field.type}
            placeholder={field.placeholder || ""}
            className={baseClasses}
            disabled
          />
        );
      case "textarea":
        return (
          <textarea
            placeholder={field.placeholder || ""}
            className={`${baseClasses} resize-none`}
            rows={3}
            disabled
          />
        );
      case "date":
        return (
          <input
            type="date"
            className={baseClasses}
            disabled
          />
        );
      case "select":
        return (
          <select className={baseClasses} disabled>
            <option>{field.placeholder || "Select an option"}</option>
            {field.options?.map((opt, i) => (
              <option key={i}>{opt}</option>
            ))}
          </select>
        );
      case "radio":
        return (
          <div className="space-y-2">
            {field.options?.map((opt, i) => (
              <label key={i} className="flex items-center gap-2">
                <input type="radio" name={field.id} disabled />
                <span className="text-sm text-gray-900 dark:text-gray-100">{opt}</span>
              </label>
            ))}
          </div>
        );
      case "checkbox":
        return (
          <div className="space-y-2">
            {field.options?.map((opt, i) => (
              <label key={i} className="flex items-center gap-2">
                <input type="checkbox" disabled />
                <span className="text-sm text-gray-900 dark:text-gray-100">{opt}</span>
              </label>
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/tools/data-collection">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Create Form
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
                disabled={saving || !title.trim() || fields.length === 0}
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
            {/* Form Settings */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Form Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Customer Feedback Survey"
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
                  placeholder="Add a brief description of this form..."
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

            {/* Fields */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Form Fields
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTypeSelector(!showTypeSelector)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </div>

              {/* Field Type Selector */}
              {showTypeSelector && (
                <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      Select Field Type
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
                    {FIELD_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => addField(type.value)}
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

              {/* Field List */}
              {fields.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p>No fields added yet.</p>
                  <p className="text-sm mt-1">Click "Add Field" to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                    >
                      <div
                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setExpandedField(expandedField === field.id ? null : field.id)}
                      >
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-medium text-gray-400 uppercase">
                          {field.type}
                        </span>
                        <span className="font-medium flex-1 text-gray-900 dark:text-white">
                          {field.label}
                        </span>
                        {field.required && (
                          <span className="text-xs text-red-500 font-medium">Required</span>
                        )}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            expandedField === field.id ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                      {expandedField === field.id && (
                        <div className="p-3 pt-0 space-y-3 border-t border-gray-100 dark:border-gray-700">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Label
                            </label>
                            <Input
                              value={field.label}
                              onChange={(e) => updateField(field.id, { label: e.target.value })}
                              placeholder="Field label"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Placeholder
                            </label>
                            <Input
                              value={field.placeholder || ""}
                              onChange={(e) =>
                                updateField(field.id, { placeholder: e.target.value })
                              }
                              placeholder="Placeholder text"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Help Text
                            </label>
                            <Input
                              value={field.helpText || ""}
                              onChange={(e) =>
                                updateField(field.id, { helpText: e.target.value })
                              }
                              placeholder="Help text (optional)"
                            />
                          </div>
                          {field.options && (
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                Options
                              </label>
                              {field.options.map((opt, i) => (
                                <div key={i} className="flex gap-2">
                                  <Input
                                    value={opt}
                                    onChange={(e) => {
                                      const newOpts = [...field.options!];
                                      newOpts[i] = e.target.value;
                                      updateField(field.id, { options: newOpts });
                                    }}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateField(field.id, {
                                        options: field.options!.filter((_, j) => j !== i),
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
                                  updateField(field.id, {
                                    options: [
                                      ...(field.options || []),
                                      `Option ${(field.options?.length || 0) + 1}`,
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
                                checked={field.required}
                                onChange={(e) =>
                                  updateField(field.id, { required: e.target.checked })
                                }
                                className="rounded"
                              />
                              Required
                            </label>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveField(index, "up")}
                                disabled={index === 0}
                                title="Move up"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveField(index, "down")}
                                disabled={index === fields.length - 1}
                                title="Move down"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setFields((prev) => prev.filter((f) => f.id !== field.id))
                                }
                                className="text-red-500 hover:text-red-700"
                                title="Remove field"
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
                        {/* Form Header */}
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

                        {/* Form Fields */}
                        {fields.length > 0 ? (
                          <div className="space-y-4">
                            {fields.map((field) => (
                              <div key={field.id}>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  {field.label}
                                  {field.required && (
                                    <span className="text-red-500 ml-1">*</span>
                                  )}
                                </label>
                                {renderFieldPreview(field)}
                                {field.helpText && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {field.helpText}
                                  </p>
                                )}
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
                            <p className="text-sm">Your form fields will appear here</p>
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
