"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileQuestion,
  BarChart3,
  Link2,
  Copy,
  ExternalLink,
  Loader2,
  Star,
  Save,
  ChevronUp,
  ChevronDown,
  X,
  Send,
  Mail,
  Phone,
  Users,
  type LucideIcon,
  Type,
  AlignLeft,
  List,
  ToggleLeft,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { SURVEY_STATUS_CONFIG, type SurveyData, type SurveyStatus, type SurveyResponseData } from "@/types/survey";
import { QUESTION_TYPES, type SurveyQuestion } from "@/types/follow-up";
import { MoreVertical } from "lucide-react";

const QUESTION_ICON_MAP: Record<string, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  rating: Star,
  multiple_choice: List,
  yes_no: ToggleLeft,
  email: Mail,
  phone: Phone,
};

interface ContactList {
  id: string;
  name: string;
  totalCount: number;
}

export default function SurveyDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("builder");

  // Builder state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("Thank you for your response!");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Responses state
  const [responses, setResponses] = useState<SurveyResponseData[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responsePage, setResponsePage] = useState(1);
  const [responsesTotal, setResponsesTotal] = useState(0);

  // Send state
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [sendListId, setSendListId] = useState("");
  const [sendChannel, setSendChannel] = useState<"email" | "sms">("email");
  const [isSending, setIsSending] = useState(false);

  // Fetch survey
  const fetchSurvey = useCallback(async () => {
    try {
      const res = await fetch(`/api/surveys/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setSurvey(json.data);
      setTitle(json.data.title);
      setDescription(json.data.description || "");
      setThankYouMessage(json.data.thankYouMessage || "Thank you for your response!");
      setQuestions(json.data.questions || []);
      setIsActive(json.data.isActive);
      if (json.data.contactListId) setSendListId(json.data.contactListId);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  // Fetch responses
  const fetchResponses = useCallback(async () => {
    setResponsesLoading(true);
    try {
      const res = await fetch(`/api/surveys/${id}/responses?page=${responsePage}&limit=25`);
      const json = await res.json();
      if (json.success) {
        setResponses(json.data || []);
        setResponsesTotal(json.pagination?.total || 0);
      }
    } catch { /* silent */ } finally {
      setResponsesLoading(false);
    }
  }, [id, responsePage]);

  useEffect(() => { fetchSurvey(); }, [fetchSurvey]);
  useEffect(() => { if (activeTab === "responses" && survey) fetchResponses(); }, [activeTab, fetchResponses, survey]);

  // Fetch contact lists for Send tab
  useEffect(() => {
    if (activeTab === "send" && contactLists.length === 0) {
      fetch("/api/contact-lists?limit=100")
        .then((r) => r.json())
        .then((json) => { if (json.success) setContactLists(json.data?.lists || json.data || []); })
        .catch(() => {});
    }
  }, [activeTab, contactLists.length]);

  // Question builder functions
  const addQuestion = (type: string) => {
    const q: SurveyQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: type as SurveyQuestion["type"],
      label: "",
      required: false,
      ...(type === "multiple_choice" ? { options: ["Option 1", "Option 2"] } : {}),
    };
    setQuestions([...questions, q]);
  };

  const updateQuestion = (index: number, updates: Partial<SurveyQuestion>) => {
    const q = [...questions];
    q[index] = { ...q[index], ...updates };
    setQuestions(q);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const q = [...questions];
    [q[index], q[newIndex]] = [q[newIndex], q[index]];
    setQuestions(q);
  };

  // Save survey
  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Error", description: "Survey title is required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/surveys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          thankYouMessage: thankYouMessage.trim(),
          questions,
          isActive,
          status: isActive ? "ACTIVE" : "DRAFT",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast({ title: "Saved!", description: "Survey saved successfully" });
      fetchSurvey();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Copy link
  const copyLink = () => {
    if (!survey) return;
    const url = `${window.location.origin}/survey/${survey.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Survey link copied to clipboard" });
  };

  // Delete survey
  const handleDelete = async () => {
    if (!confirm(`Delete "${survey?.title}"? This will remove all responses permanently.`)) return;
    try {
      const res = await fetch(`/api/surveys/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast({ title: "Deleted", description: "Survey deleted" });
      router.push("/tools/surveys");
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  // Send survey
  const handleSend = async () => {
    if (!sendListId || sendListId === "none") {
      toast({ title: "Error", description: "Select a contact list", variant: "destructive" });
      return;
    }

    // Validate questions exist before sending
    if (questions.length === 0) {
      toast({ title: "Error", description: "Add at least one question before sending", variant: "destructive" });
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
      if (!json.success) throw new Error(json.error?.message);
      toast({ title: "Sending!", description: json.data.message });
      fetchSurvey();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Survey not found</p>
        <Button variant="outline" onClick={() => router.push("/tools/surveys")} className="mt-4">
          Back to Surveys
        </Button>
      </div>
    );
  }

  const statusCfg = SURVEY_STATUS_CONFIG[survey.status as SurveyStatus] || SURVEY_STATUS_CONFIG.DRAFT;
  const responsePages = Math.ceil(responsesTotal / 25);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/tools/surveys")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{survey.title}</h1>
              <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
            </div>
            {survey.description && (
              <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {survey.status !== "CLOSED" && (
              <DropdownMenuItem onClick={async () => {
                await fetch(`/api/surveys/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CLOSED", isActive: false }) });
                fetchSurvey();
              }}>
                Close Survey
              </DropdownMenuItem>
            )}
            {survey.status === "CLOSED" && (
              <DropdownMenuItem onClick={async () => {
                await fetch(`/api/surveys/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ACTIVE", isActive: true }) });
                fetchSurvey();
              }}>
                Reopen Survey
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-violet-500" />
            <div>
              <p className="text-xl font-bold">{survey.responseCount}</p>
              <p className="text-xs text-muted-foreground">Responses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Send className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xl font-bold">{survey.sendCount}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileQuestion className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xl font-bold">{questions.length}</p>
              <p className="text-xs text-muted-foreground">Questions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xl font-bold">
                {survey.sendCount > 0 ? `${Math.round((survey.responseCount / survey.sendCount) * 100)}%` : "\u2014"}
              </p>
              <p className="text-xs text-muted-foreground">Response Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="builder" className="gap-1.5">
            <FileQuestion className="h-3.5 w-3.5" /> Builder
          </TabsTrigger>
          <TabsTrigger value="responses" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Responses ({survey.responseCount})
          </TabsTrigger>
          <TabsTrigger value="send" className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Send
          </TabsTrigger>
        </TabsList>

        {/* BUILDER TAB */}
        <TabsContent value="builder" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Survey Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Survey Title *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Customer Satisfaction Survey" className="mt-1" />
                </div>
                <div>
                  <Label>Thank You Message</Label>
                  <Input value={thankYouMessage} onChange={(e) => setThankYouMessage(e.target.value)} placeholder="Thank you for your response!" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description shown to respondents..." className="mt-1" rows={2} />
              </div>

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base">Questions ({questions.length})</Label>
                </div>

                {questions.length === 0 ? (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                    <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No questions yet. Add your first question below.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {questions.map((q, i) => {
                      const QIcon = QUESTION_ICON_MAP[q.type] || Type;
                      return (
                        <Card key={q.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col items-center gap-1 pt-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(i, -1)} disabled={i === 0}>
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1}>
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </div>

                              <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-2">
                                  <QIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <Badge variant="outline" className="text-[10px]">
                                    {QUESTION_TYPES.find((t) => t.value === q.type)?.label || q.type}
                                  </Badge>
                                  <div className="flex-1" />
                                  <div className="flex items-center gap-1.5">
                                    <Label htmlFor={`req-${q.id}`} className="text-xs text-muted-foreground">Required</Label>
                                    <Switch id={`req-${q.id}`} checked={q.required} onCheckedChange={(c) => updateQuestion(i, { required: c })} />
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeQuestion(i)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>

                                <Input value={q.label} onChange={(e) => updateQuestion(i, { label: e.target.value })} placeholder="Enter your question..." className="text-sm" />

                                {q.type === "multiple_choice" && q.options && (
                                  <div className="pl-4 space-y-2">
                                    {q.options.map((opt, oi) => (
                                      <div key={oi} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full border-2 shrink-0" />
                                        <Input
                                          value={opt}
                                          onChange={(e) => {
                                            const opts = [...(q.options || [])];
                                            opts[oi] = e.target.value;
                                            updateQuestion(i, { options: opts });
                                          }}
                                          className="h-8 text-sm"
                                          placeholder={`Option ${oi + 1}`}
                                        />
                                        {(q.options?.length || 0) > 2 && (
                                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                                            const opts = (q.options || []).filter((_, idx) => idx !== oi);
                                            updateQuestion(i, { options: opts });
                                          }}>
                                            <X className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                                      updateQuestion(i, { options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] });
                                    }}>
                                      <Plus className="h-3 w-3 mr-1" /> Add Option
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Add Question Buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {QUESTION_TYPES.map((qt) => {
                    const QIcon = QUESTION_ICON_MAP[qt.value] || Type;
                    return (
                      <Button key={qt.value} variant="outline" size="sm" onClick={() => addQuestion(qt.value)} className="gap-1.5 text-xs">
                        <QIcon className="h-3 w-3" /> {qt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Public URL & Controls */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Survey Active</Label>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                </div>

                {survey.slug && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <code className="text-sm flex-1 truncate">
                      {typeof window !== "undefined" ? window.location.origin : ""}/survey/{survey.slug}
                    </code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyLink}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => window.open(`/survey/${survey.slug}`, "_blank")}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Survey
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RESPONSES TAB */}
        <TabsContent value="responses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Responses ({survey.responseCount})</CardTitle>
            </CardHeader>
            <CardContent>
              {responsesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : responses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No responses yet. Share your survey link to start collecting feedback.
                </p>
              ) : (
                <>
                  <div className="space-y-3">
                    {responses.map((resp) => {
                      const answers = typeof resp.answers === "string" ? JSON.parse(resp.answers as string) : resp.answers;
                      return (
                        <Card key={resp.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 text-sm">
                                {resp.respondentName && <span className="font-medium">{resp.respondentName}</span>}
                                {resp.respondentEmail && <span className="text-muted-foreground">{resp.respondentEmail}</span>}
                                {resp.respondentPhone && <span className="text-muted-foreground">{resp.respondentPhone}</span>}
                                {!resp.respondentName && !resp.respondentEmail && (
                                  <span className="text-muted-foreground italic">Anonymous</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {resp.rating && (
                                  <div className="flex items-center gap-0.5">
                                    {[...Array(5)].map((_, si) => (
                                      <Star key={si} className={`h-3 w-3 ${si < resp.rating! ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                                    ))}
                                  </div>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {new Date(resp.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                              {Object.entries(answers as Record<string, unknown>).map(([qId, answer]) => {
                                const question = questions.find((q) => q.id === qId);
                                return (
                                  <div key={qId} className="text-xs">
                                    <span className="text-muted-foreground">{question?.label || qId}:</span>{" "}
                                    <span className="font-medium">{String(answer)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {responsePages > 1 && (
                    <div className="flex justify-center gap-2 pt-4">
                      <Button variant="outline" size="sm" disabled={responsePage <= 1} onClick={() => setResponsePage(responsePage - 1)}>
                        Previous
                      </Button>
                      <span className="flex items-center text-sm text-muted-foreground px-2">
                        Page {responsePage} of {responsePages}
                      </span>
                      <Button variant="outline" size="sm" disabled={responsePage >= responsePages} onClick={() => setResponsePage(responsePage + 1)}>
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEND TAB */}
        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Send Survey</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {questions.length === 0 ? (
                <div className="text-center py-6">
                  <FileQuestion className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="font-medium mb-1">Add questions first</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    You need at least one question before you can send your survey.
                  </p>
                  <Button variant="outline" onClick={() => setActiveTab("builder")}>
                    Go to Builder
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label>Contact List *</Label>
                    <Select value={sendListId} onValueChange={setSendListId}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select a contact list..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select a list...</SelectItem>
                        {contactLists.map((cl) => (
                          <SelectItem key={cl.id} value={cl.id}>
                            {cl.name} ({cl.totalCount} contacts)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Channel</Label>
                    <div className="grid grid-cols-2 gap-3 mt-1.5">
                      <Card
                        className={`cursor-pointer transition-all border-2 ${sendChannel === "email" ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20" : "border-transparent hover:border-blue-200"}`}
                        onClick={() => setSendChannel("email")}
                      >
                        <CardContent className="p-4 text-center">
                          <Mail className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                          <p className="font-medium text-sm">Email</p>
                          <p className="text-xs text-muted-foreground">Send via email marketing</p>
                        </CardContent>
                      </Card>
                      <Card
                        className={`cursor-pointer transition-all border-2 ${sendChannel === "sms" ? "border-green-500 bg-green-50/50 dark:bg-green-950/20" : "border-transparent hover:border-green-200"}`}
                        onClick={() => setSendChannel("sms")}
                      >
                        <CardContent className="p-4 text-center">
                          <Phone className="h-6 w-6 mx-auto mb-2 text-green-500" />
                          <p className="font-medium text-sm">SMS</p>
                          <p className="text-xs text-muted-foreground">Send via text message</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {survey.slug && (
                    <div className="p-3 rounded-lg bg-muted text-sm">
                      <p className="text-muted-foreground mb-1">Survey link that will be sent:</p>
                      <code className="text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/survey/{survey.slug}</code>
                    </div>
                  )}

                  {survey.lastSentAt && (
                    <p className="text-xs text-muted-foreground">
                      Last sent: {new Date(survey.lastSentAt).toLocaleString()} ({survey.sendCount} total)
                    </p>
                  )}

                  <Button
                    onClick={handleSend}
                    disabled={isSending || !sendListId || sendListId === "none"}
                    className="gap-2"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send via {sendChannel === "email" ? "Email" : "SMS"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
