"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, ArrowLeft, Plus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AISpinner } from "@/components/shared/ai-generation-loader";

interface ContactList {
  id: string;
  name: string;
  totalCount: number;
}

export default function NewFollowUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactListId, setContactListId] = useState<string>("");
  const [autoImport, setAutoImport] = useState(true);
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
          type: "TRACKER",
          contactListId: contactListId && contactListId !== "none" ? contactListId : null,
          autoImport: contactListId && contactListId !== "none" ? autoImport : false,
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
          <p className="text-muted-foreground text-sm">Set up your contact tracker</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium">Contact Tracker</p>
              <p className="text-xs text-muted-foreground">Track interactions with your contacts</p>
            </div>
          </div>

          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Q1 Sales Outreach"
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
              {contactListId && contactListId !== "none" && (
                <div className="flex items-center gap-2 mt-2">
                  <Switch
                    id="autoImport"
                    checked={autoImport}
                    onCheckedChange={setAutoImport}
                  />
                  <Label htmlFor="autoImport" className="text-sm font-normal cursor-pointer">
                    Auto-import contacts from this list
                  </Label>
                </div>
              )}
              {(!contactListId || contactListId === "none") && (
                <p className="text-xs text-muted-foreground mt-1">
                  You can import contacts from a list after creation
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end pt-4 border-t">
            <Button onClick={handleCreate} disabled={!name.trim() || isCreating} className="gap-2">
              {isCreating ? (
                <AISpinner className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Follow-Up
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
