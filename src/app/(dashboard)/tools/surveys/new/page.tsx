"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Plus,
  FileQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ContactList {
  id: string;
  name: string;
  totalCount: number;
}

export default function NewSurveyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("Thank you for your response!");
  const [contactListId, setContactListId] = useState<string>("");
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetch("/api/contact-lists?limit=100")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setContactLists(json.data.lists || json.data || []);
        }
      })
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          thankYouMessage: thankYouMessage.trim(),
          contactListId: contactListId && contactListId !== "none" ? contactListId : null,
        }),
      });
      const json = await res.json();

      if (!json.success) throw new Error(json.error?.message || "Failed to create survey");

      toast({ title: "Created!", description: `Survey "${title}" created successfully` });
      router.push(`/tools/surveys/${json.data.id}`);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/tools/surveys")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Survey</h1>
          <p className="text-muted-foreground text-sm">Create a shareable survey to collect feedback</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <FileQuestion className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium">Survey / Feedback</p>
              <p className="text-xs text-muted-foreground">Collect feedback with a shareable survey</p>
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Customer Satisfaction Survey"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description shown to respondents..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="thankYou">Thank You Message</Label>
            <Input
              id="thankYou"
              placeholder="Thank you for your response!"
              value={thankYouMessage}
              onChange={(e) => setThankYouMessage(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {contactLists.length > 0 && (
            <div>
              <Label>Link to Contact List (optional)</Label>
              <Select value={contactListId} onValueChange={setContactListId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a contact list..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No contact list</SelectItem>
                  {contactLists.map((cl) => (
                    <SelectItem key={cl.id} value={cl.id}>
                      {cl.name} ({cl.totalCount} contacts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Link a contact list to send your survey via email or SMS
              </p>
            </div>
          )}

          <div className="flex items-center justify-end pt-4 border-t">
            <Button onClick={handleCreate} disabled={!title.trim() || isCreating} className="gap-2">
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Survey
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
