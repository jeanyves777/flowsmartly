"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  Bot,
  Brain,
  CalendarCheck,
  Check,
  Clock,
  Database,
  FileText,
  Headphones,
  Image,
  MessageSquare,
  Mic,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppInbox } from "@/components/whatsapp/whatsapp-inbox";
import { WhatsAppAutomations } from "@/components/whatsapp/whatsapp-automations";
import { WhatsAppTemplates } from "@/components/whatsapp/whatsapp-templates";
import { WhatsAppStatus } from "@/components/whatsapp/whatsapp-status";
import {
  DEFAULT_WHATSAPP_AGENT_SETTINGS,
  type WhatsAppAgentSettings,
} from "@/lib/whatsapp/agent-config";
import type { WhatsAppAccount } from "@/components/whatsapp/types";

type WhatsAppTab = "agent" | "inbox" | "automations" | "templates" | "status";
type AgentToggleKey = "enabled" | "handoffEnabled" | "leadQualification" | "appointmentBooking" | "voiceNotes";

const WHATSAPP_TABS: { id: WhatsAppTab; label: string; icon: LucideIcon }[] = [
  { id: "agent", label: "Agent", icon: Bot },
  { id: "inbox", label: "Inbox", icon: MessageSquare },
  { id: "automations", label: "Flows", icon: Workflow },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "status", label: "Status", icon: Image },
];

const VALID_TABS = WHATSAPP_TABS.map((tab) => tab.id);

export default function WhatsAppPage() {
  return (
    <Suspense fallback={<WhatsAppLoading />}>
      <WhatsAppPageContent />
    </Suspense>
  );
}

function WhatsAppPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<WhatsAppAccount | null>(null);
  const [activeTab, setActiveTab] = useState<WhatsAppTab>("agent");
  const [showReconnectModal, setShowReconnectModal] = useState(false);

  useEffect(() => {
    loadWhatsAppAccounts();
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && VALID_TABS.includes(tab as WhatsAppTab)) {
      setActiveTab(tab as WhatsAppTab);
    }
  }, [searchParams]);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "whatsapp_connected") {
      toast({ title: "WhatsApp connected", description: "Your WhatsApp Business account is ready for the agent workspace." });
      loadWhatsAppAccounts();
      router.replace("/whatsapp");
    } else if (success === "whatsapp_reconnected") {
      toast({ title: "Account updated", description: "Your WhatsApp Business account token has been refreshed." });
      loadWhatsAppAccounts();
      router.replace("/whatsapp");
    }

    if (error) {
      const errorMessages: Record<string, string> = {
        whatsapp_auth_failed: "WhatsApp authorization was denied. Please try again.",
        no_phone_numbers: "No WhatsApp Business phone numbers found on your account.",
        connect_failed: "Something went wrong connecting WhatsApp. Please try again.",
        missing_params: "Connection was interrupted. Please try again.",
      };
      toast({
        title: "Connection issue",
        description: errorMessages[error] || "An unexpected error occurred.",
        variant: "destructive",
      });
      router.replace("/whatsapp");
    }
  }, [searchParams, toast, router]);

  async function loadWhatsAppAccounts() {
    try {
      const response = await fetch("/api/social-accounts?platform=whatsapp");
      const data = await response.json();

      if (data.success) {
        setWhatsappAccounts(data.accounts || []);
        if (data.accounts?.length > 0 && !selectedAccount) {
          setSelectedAccount(data.accounts[0]);
        }
      }
    } catch (error) {
      console.error("Error loading WhatsApp accounts:", error);
    } finally {
      setLoading(false);
    }
  }

  function goToSocialAccounts() {
    router.push("/social-accounts");
  }

  function getTokenStatus(account: WhatsAppAccount) {
    if (!account.tokenExpiresAt) {
      return { label: "Active", color: "text-green-500", variant: "default" as const };
    }
    const daysLeft = Math.ceil((new Date(account.tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: "Expired", color: "text-red-500", variant: "destructive" as const };
    if (daysLeft <= 7) return { label: `Expires in ${daysLeft}d`, color: "text-yellow-500", variant: "secondary" as const };
    return { label: `Expires in ${daysLeft}d`, color: "text-green-500", variant: "default" as const };
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  if (loading) return <WhatsAppLoading />;

  if (whatsappAccounts.length === 0) {
    return <NoAccountAgentCard onConnect={goToSocialAccounts} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">WhatsApp Agent</h1>
            <p className="text-sm text-muted-foreground">
              {whatsappAccounts.length} WhatsApp number{whatsappAccounts.length > 1 ? "s" : ""} connected
            </p>
          </div>
        </div>
        <Button variant="outline" size="default" onClick={goToSocialAccounts}>
          <Plus className="mr-2 h-4 w-4" />
          Add Number
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {whatsappAccounts.map((account) => {
          const tokenStatus = getTokenStatus(account);
          const isSelected = selectedAccount?.id === account.id;

          return (
            <Card
              key={account.id}
              className={`cursor-pointer transition-all ${isSelected ? "border-green-500 ring-2 ring-green-500" : "hover:border-green-500/50"}`}
              onClick={() => setSelectedAccount(account)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                      <Phone className="h-6 w-6 text-green-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{account.platformDisplayName || "WhatsApp Business"}</p>
                      <p className="truncate text-xs text-muted-foreground">{account.platformUsername || account.platformUserId}</p>
                    </div>
                  </div>
                  {isSelected && <Badge className="bg-green-500 text-white">Selected</Badge>}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    <span>Connected {formatDate(account.connectedAt)}</span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${tokenStatus.color}`}>
                    {tokenStatus.label === "Expired" ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    <span>Token: {tokenStatus.label}</span>
                  </div>
                </div>

                {tokenStatus.label === "Expired" && (
                  <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-green-500/50 text-green-600 hover:bg-green-500/10"
                      onClick={() => setShowReconnectModal(true)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reconnect to Refresh Token
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {whatsappAccounts.length > 1 && selectedAccount && (
        <p className="text-sm text-muted-foreground">
          Viewing: <span className="font-medium text-foreground">{selectedAccount.platformDisplayName || selectedAccount.platformUsername}</span>
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto border-b pb-0">
        {WHATSAPP_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-green-500 bg-green-500/5 text-green-600"
                  : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-[300px]">
        {selectedAccount && (
          <>
            {activeTab === "agent" && <WhatsAppAgentControl account={selectedAccount} />}
            {activeTab === "inbox" && <WhatsAppInbox account={selectedAccount} />}
            {activeTab === "automations" && <WhatsAppAutomations account={selectedAccount} />}
            {activeTab === "templates" && <WhatsAppTemplates account={selectedAccount} />}
            {activeTab === "status" && <WhatsAppStatus account={selectedAccount} />}
          </>
        )}
      </div>

      <Dialog open={showReconnectModal} onOpenChange={setShowReconnectModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              Add WhatsApp Account
            </DialogTitle>
            <DialogDescription>
              Refresh tokens or add new phone numbers from your WhatsApp Business account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You already have {whatsappAccounts.length} WhatsApp account{whatsappAccounts.length > 1 ? "s" : ""} connected.
            </p>
            <div className="rounded-lg border bg-muted/30 p-3">
              {whatsappAccounts.map((acc) => (
                <div key={acc.id} className="flex min-w-0 items-center gap-2 py-1">
                  <Check className="h-4 w-4 shrink-0 text-green-500" />
                  <span className="truncate text-sm">{acc.platformDisplayName || "WhatsApp Business"}</span>
                  <span className="truncate text-xs text-muted-foreground">({acc.platformUsername || acc.platformUserId})</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReconnectModal(false)}>
              Cancel
            </Button>
            <Button className="bg-green-500 hover:bg-green-600" onClick={goToSocialAccounts}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WhatsAppAgentControl({ account }: { account: WhatsAppAccount }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<WhatsAppAgentSettings>(DEFAULT_WHATSAPP_AGENT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        setLoadingSettings(true);
        const response = await fetch(`/api/whatsapp/agent?socialAccountId=${account.id}`);
        const data = await response.json();
        if (!cancelled && data.success) {
          setSettings(data.settings || DEFAULT_WHATSAPP_AGENT_SETTINGS);
        }
      } catch (error) {
        console.error("Error loading WhatsApp agent settings:", error);
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  function updateSetting<K extends keyof WhatsAppAgentSettings>(key: K, value: WhatsAppAgentSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings() {
    try {
      setSaving(true);
      const response = await fetch("/api/whatsapp/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialAccountId: account.id, settings }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save WhatsApp agent settings");
      }
      setSettings(data.settings || settings);
      toast({
        title: settings.enabled ? "WhatsApp agent is live" : "WhatsApp agent saved",
        description: settings.enabled
          ? "Inbound text messages can now be answered by the AI agent."
          : "The agent setup is saved and will stay off until you enable it.",
      });
    } catch (error) {
      toast({
        title: "Agent settings not saved",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const toggleRows: { key: AgentToggleKey; label: string; description: string; icon: LucideIcon }[] = [
    { key: "enabled", label: "AI agent", description: "Answer inbound text conversations from this WhatsApp number.", icon: Bot },
    { key: "leadQualification", label: "Lead qualification", description: "Collect customer need, timeline, service interest, and contact details.", icon: Target },
    { key: "appointmentBooking", label: "Appointment intent", description: "Move qualified customers toward a booking handoff.", icon: CalendarCheck },
    { key: "handoffEnabled", label: "Human handoff", description: "Escalate complaints, sensitive requests, pricing approval, and uncertainty.", icon: Headphones },
    { key: "voiceNotes", label: "Voice-note mode", description: "Reserve voice-note handling in the agent setup.", icon: Mic },
  ];

  if (loadingSettings) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-green-500" />
            <p className="text-sm text-muted-foreground">Loading agent workspace...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_34%)] p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-500/10 text-green-600">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Agent Control Center</h2>
                <Badge className={settings.enabled ? "bg-green-600" : "bg-amber-600"}>
                  {settings.enabled ? "Live" : "Draft"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {account.platformDisplayName || account.platformUsername || "WhatsApp Business"} runs through inbox, templates, flows, and AI replies from one workspace.
              </p>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
            Save Agent
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AgentMetric icon={Activity} label="Reply mode" value={settings.enabled ? "AI live" : "Paused"} />
          <AgentMetric icon={Brain} label="Memory" value="Conversation" />
          <AgentMetric icon={ShieldCheck} label="Guardrails" value={settings.handoffEnabled ? "Handoff" : "Strict"} />
          <AgentMetric icon={Database} label="Knowledge" value="Agent setup" />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-green-600" />
              Agent Behavior
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {toggleRows.map((row) => (
              <AgentSettingRow
                key={row.key}
                icon={row.icon}
                label={row.label}
                description={row.description}
                checked={Boolean(settings[row.key])}
                onCheckedChange={(checked) => updateSetting(row.key, checked)}
              />
            ))}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Agent tone</label>
                <Textarea
                  className="mt-2 min-h-[96px]"
                  value={settings.agentTone}
                  onChange={(event) => updateSetting("agentTone", event.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Language rule</label>
                <Textarea
                  className="mt-2 min-h-[96px]"
                  value={settings.language}
                  onChange={(event) => updateSetting("language", event.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Business goal</label>
              <Textarea
                className="mt-2 min-h-[112px]"
                value={settings.businessGoal}
                onChange={(event) => updateSetting("businessGoal", event.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Knowledge base notes</label>
              <Textarea
                className="mt-2 min-h-[132px]"
                value={settings.knowledge}
                onChange={(event) => updateSetting("knowledge", event.target.value)}
              />
            </div>

            <div>
              <p className="text-sm font-medium">Maximum replies per turn</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((count) => (
                  <Button
                    key={count}
                    type="button"
                    variant={settings.maxReplyMessages === count ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                    onClick={() => updateSetting("maxReplyMessages", count)}
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Workflow className="h-4 w-4 text-green-600" />
                Agent Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <WorkflowStep icon={MessageSquare} title="Inbound message" detail="Webhook captures the WhatsApp text and stores the conversation." />
              <WorkflowStep icon={Brain} title="Agent reasoning" detail="The agent reads recent history, goal, tone, and knowledge notes before replying." />
              <WorkflowStep icon={Target} title="Qualification" detail="Lead questions, appointment intent, or human handoff are selected from the setup." />
              <WorkflowStep icon={Send} title="WhatsApp reply" detail="The generated answer is sent through the connected WhatsApp Business number." />
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="h-4 w-4 text-green-600" />
                Agent Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-sm bg-green-600 px-3 py-2 text-sm text-white">
                  Hi, do you offer appointments this week?
                </div>
                <div className="max-w-[86%] rounded-2xl rounded-bl-sm border bg-background px-3 py-2 text-sm">
                  Yes. I can help with that. What service are you looking for, and what day or time works best?
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                  Human handoff stays available for sensitive or uncertain messages.
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <CapabilityCard icon={Headphones} title="Human Handoff" active={settings.handoffEnabled} />
            <CapabilityCard icon={CalendarCheck} title="Appointments" active={settings.appointmentBooking} />
            <CapabilityCard icon={Target} title="Lead Setter" active={settings.leadQualification} />
            <CapabilityCard icon={Mic} title="Voice Notes" active={settings.voiceNotes} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NoAccountAgentCard({ onConnect }: { onConnect: () => void }) {
  const capabilities = [
    { icon: Bot, title: "AI Agent", description: "Text replies, business context, lead qualification, and handoff guardrails." },
    { icon: MessageSquare, title: "Inbox", description: "Customer conversations stay attached to the connected WhatsApp number." },
    { icon: Workflow, title: "Flows", description: "Keyword, inbound, and campaign automations can run beside the agent." },
    { icon: FileText, title: "Templates", description: "Approved WhatsApp templates remain available for outreach and follow-up." },
  ];

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-green-500/20">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.32),transparent_34%),linear-gradient(135deg,#16a34a,#047857)] p-8 text-white">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm">
                <Sparkles className="h-4 w-4" />
                WhatsApp Agent Workspace
              </div>
              <h1 className="text-3xl font-bold">Build a full WhatsApp agent</h1>
              <p className="mt-2 text-green-50">
                Connect a WhatsApp Business number, then run AI replies, lead qualification, appointments, human handoff, inbox, templates, and flows from one workspace.
              </p>
            </div>
            <Button size="lg" variant="secondary" onClick={onConnect}>
              <Plus className="mr-2 h-4 w-4" />
              Connect WhatsApp Business
            </Button>
          </div>
        </div>

        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex gap-3 rounded-xl border bg-background p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-green-500/10 text-green-600">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/80 p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-green-500/10 text-green-600">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

function AgentSettingRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 p-3">
      <div className="flex min-w-0 gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-green-500/10 text-green-600">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function WorkflowStep({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-xl border bg-muted/20 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-green-500/10 text-green-600">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function CapabilityCard({ icon: Icon, title, active }: { icon: LucideIcon; title: string; active: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${active ? "border-green-500/35 bg-green-500/10" : "bg-muted/20"}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${active ? "text-green-600" : "text-muted-foreground"}`} />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className={`mt-1 text-xs ${active ? "text-green-700" : "text-muted-foreground"}`}>
        {active ? "Enabled" : "Paused"}
      </p>
    </div>
  );
}

function WhatsAppLoading() {
  return (
    <div className="flex h-96 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
        <p className="text-muted-foreground">Loading WhatsApp...</p>
      </div>
    </div>
  );
}
