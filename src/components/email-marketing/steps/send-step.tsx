"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, Mail, X, Search, Clock, Send, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface Contact {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}

interface ContactList {
  id: string;
  name: string;
  _count?: { contacts: number };
}

interface SendStepProps {
  campaignName: string;
  subject: string;
  selectedContactListId: string;
  customEmails: string[];
  excludedContactIds: string[];
  scheduleType: "now" | "later";
  scheduledDate: string;
  scheduledTime: string;
  isSending: boolean;
  onSelectContactList: (id: string) => void;
  onAddCustomEmail: (email: string) => void;
  onRemoveCustomEmail: (email: string) => void;
  onSetCustomEmails: (emails: string[]) => void;
  onToggleExcludeContact: (contactId: string) => void;
  onSetSchedule: (type: "now" | "later", date?: string, time?: string) => void;
  onSend: () => void;
  onSaveDraft: () => void;
}

export function SendStep(props: SendStepProps) {
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [customEmailInput, setCustomEmailInput] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

  // Fetch contact lists
  useEffect(() => {
    fetch("/api/contact-lists")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const lists = d.data?.lists || d.data;
          setContactLists(Array.isArray(lists) ? lists : []);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch contacts when list selected
  useEffect(() => {
    if (!props.selectedContactListId) { setContacts([]); return; }
    setLoadingContacts(true);
    fetch(`/api/contacts?listId=${props.selectedContactListId}&limit=500`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          // API returns { contacts: [...], pagination: {...} }
          const list = d.data?.contacts || d.data;
          setContacts(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, [props.selectedContactListId]);

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(
      (c) => c.email.toLowerCase().includes(q) || c.firstName?.toLowerCase().includes(q) || c.lastName?.toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

  // Active recipient count
  const activeContactCount = contacts.length - props.excludedContactIds.length;
  const totalRecipients = activeContactCount + props.customEmails.length;

  function handleAddCustomEmail() {
    const email = customEmailInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    props.onAddCustomEmail(email);
    setCustomEmailInput("");
  }

  function handleBulkAdd() {
    const emails = bulkInput
      .split(/[,\n;]+/)
      .map((e) => e.trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    props.onSetCustomEmails([...new Set([...props.customEmails, ...emails])]);
    setBulkInput("");
    setBulkMode(false);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Contact List Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> Select Audience
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {contactLists.map((list) => (
              <button
                key={list.id}
                onClick={() => props.onSelectContactList(list.id)}
                className={cn(
                  "p-3 border rounded-lg text-left transition-all",
                  props.selectedContactListId === list.id
                    ? "border-brand-500 bg-brand-500/10 ring-1 ring-brand-500"
                    : "hover:border-brand-300"
                )}
              >
                <p className="text-sm font-medium truncate">{list.name}</p>
                <p className="text-xs text-muted-foreground">{list._count?.contacts || 0} contacts</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Emails */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Custom Recipients
          </CardTitle>
          <CardDescription className="text-xs">Add email addresses not in your contact lists</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={customEmailInput}
              onChange={(e) => setCustomEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomEmail()}
              placeholder="email@example.com"
              className="h-9"
            />
            <Button size="sm" className="shrink-0" onClick={handleAddCustomEmail}>Add</Button>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setBulkMode(!bulkMode)}>Bulk</Button>
          </div>

          {bulkMode && (
            <div className="space-y-2">
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="Paste emails separated by commas or newlines..."
                className="w-full h-20 text-xs border rounded-lg p-2 resize-none"
              />
              <Button size="sm" onClick={handleBulkAdd}>Add All Valid Emails</Button>
            </div>
          )}

          {props.customEmails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {props.customEmails.map((email) => (
                <Badge key={email} variant="secondary" className="text-xs gap-1">
                  {email}
                  <button onClick={() => props.onRemoveCustomEmail(email)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recipient Review */}
      {(contacts.length > 0 || props.customEmails.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4" /> Recipients
              </span>
              <Badge variant="outline" className="text-xs">
                Sending to {totalRecipients} of {contacts.length + props.customEmails.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contacts.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search recipients..."
                  className="pl-9 h-8 text-xs"
                />
              </div>
            )}

            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
              {/* Custom emails */}
              {props.customEmails.map((email) => (
                <div key={email} className="flex items-center justify-between px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span>{email}</span>
                    <Badge variant="secondary" className="text-[9px]">Manual</Badge>
                  </div>
                  <button onClick={() => props.onRemoveCustomEmail(email)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Contact list contacts */}
              {loadingContacts ? (
                <div className="p-3 text-xs text-muted-foreground text-center">Loading contacts...</div>
              ) : (
                filteredContacts.map((c) => {
                  const excluded = props.excludedContactIds.includes(c.id);
                  return (
                    <div key={c.id} className={cn("flex items-center justify-between px-3 py-1.5 text-xs", excluded && "opacity-40 line-through")}>
                      <div>
                        {c.firstName || c.lastName ? `${c.firstName || ""} ${c.lastName || ""}`.trim() : ""}{" "}
                        <span className="text-muted-foreground">{c.email}</span>
                      </div>
                      <button
                        onClick={() => props.onToggleExcludeContact(c.id)}
                        className={cn("text-xs", excluded ? "text-brand-500 hover:text-brand-600" : "text-muted-foreground hover:text-destructive")}
                      >
                        {excluded ? "Restore" : <X className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" /> Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => props.onSetSchedule("now")}
              className={cn("p-3 border rounded-lg text-center transition-all", props.scheduleType === "now" ? "border-brand-500 bg-brand-500/10" : "hover:border-brand-300")}
            >
              <Send className="w-5 h-5 mx-auto mb-1" />
              <p className="text-sm font-medium">Send Now</p>
            </button>
            <button
              onClick={() => props.onSetSchedule("later")}
              className={cn("p-3 border rounded-lg text-center transition-all", props.scheduleType === "later" ? "border-brand-500 bg-brand-500/10" : "hover:border-brand-300")}
            >
              <Clock className="w-5 h-5 mx-auto mb-1" />
              <p className="text-sm font-medium">Schedule</p>
            </button>
          </div>

          {props.scheduleType === "later" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={props.scheduledDate}
                  onChange={(e) => props.onSetSchedule("later", e.target.value, props.scheduledTime)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Time</Label>
                <Input
                  type="time"
                  value={props.scheduledTime}
                  onChange={(e) => props.onSetSchedule("later", props.scheduledDate, e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary + Send */}
      <Card className="border-brand-500/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold">{props.campaignName || "Untitled Campaign"}</p>
              <p className="text-xs text-muted-foreground">
                {props.subject || "No subject"} &bull; {totalRecipients} recipients &bull;{" "}
                {props.scheduleType === "now" ? "Send immediately" : `Scheduled: ${props.scheduledDate} ${props.scheduledTime}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={props.onSaveDraft}>Save Draft</Button>
              <Button
                size="sm"
                onClick={props.onSend}
                disabled={props.isSending || totalRecipients === 0 || !props.subject.trim() || !props.campaignName.trim()}
                className="bg-gradient-to-r from-brand-500 to-brand-600"
              >
                {props.isSending ? "Sending..." : (
                  <><Send className="w-3.5 h-3.5 mr-1" /> {props.scheduleType === "now" ? "Send Now" : "Schedule"}</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
