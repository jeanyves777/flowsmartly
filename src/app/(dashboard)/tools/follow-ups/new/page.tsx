"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ClipboardList,
  FileQuestion,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
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

export default function NewFollowUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<"TRACKER" | "SURVEY" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactListId, setContactListId] = useState<string>("");
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Fetch contact lists for the dropdown
    fetch("/api/contact-lists?limit=100")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setContactLists(json.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          type,
          contactListId: contactListId || null,
        }),
      });
      const json = await res.json();

      if (!json.success) throw new Error(json.error?.message || "Failed to create");

      toast({ title: "Created!", description: `Follow-up "${name}" created successfully` });
      router.push(`/tools/follow-ups/${json.data.id}`);
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
        <Button variant="ghost" size="icon" onClick={() => router.push("/tools/follow-ups")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Follow-Up</h1>
          <p className="text-muted-foreground text-sm">
            {step === 1 ? "Choose a type" : "Set up your follow-up"}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-brand-500" : "bg-muted"}`} />
        <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-brand-500" : "bg-muted"}`} />
      </div>

      {/* Step 1: Choose Type */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Card
            className={`cursor-pointer transition-all hover:shadow-md border-2 ${
              type === "TRACKER" ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20" : "border-transparent hover:border-blue-200"
            }`}
            onClick={() => setType("TRACKER")}
          >
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Contact Tracker</h3>
              <p className="text-sm text-muted-foreground">
                Track calls, notes, and follow-up status for your contacts. Perfect for sales and outreach.
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md border-2 ${
              type === "SURVEY" ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20" : "border-transparent hover:border-violet-200"
            }`}
            onClick={() => setType("SURVEY")}
          >
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                <FileQuestion className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Survey / Feedback</h3>
              <p className="text-sm text-muted-foreground">
                Create shareable surveys to collect reviews, opinions, and customer feedback.
              </p>
            </CardContent>
          </Card>

          <div className="md:col-span-2 flex justify-end">
            <Button
              disabled={!type}
              onClick={() => setStep(2)}
              className="gap-2"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b">
                {type === "TRACKER" ? (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <FileQuestion className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <p className="font-medium">
                    {type === "TRACKER" ? "Contact Tracker" : "Survey / Feedback"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {type === "TRACKER"
                      ? "Track interactions with your contacts"
                      : "Collect feedback with a shareable survey"}
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder={type === "TRACKER" ? "e.g. Q1 Sales Outreach" : "e.g. Customer Satisfaction Survey"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5"
                  rows={3}
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
                    You can import contacts from this list after creation
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleCreate} disabled={!name.trim() || isCreating} className="gap-2">
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create Follow-Up
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
