"use client";

import { useState } from "react";
import {
  Sparkles,
  FileText,
  MessageSquare,
  Hash,
  Zap,
  Loader2,
  Copy,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface AITextAssistantProps {
  onInsert: (content: string) => void;
  onClose?: () => void;
}

type AITab = "post" | "caption" | "hashtag" | "idea";

const AI_TABS = [
  { id: "post" as const, name: "Post", icon: FileText },
  { id: "caption" as const, name: "Caption", icon: MessageSquare },
  { id: "hashtag" as const, name: "Hashtags", icon: Hash },
  { id: "idea" as const, name: "Ideas", icon: Zap },
];

const TONES = [
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
  { id: "humorous", label: "Humorous" },
  { id: "inspirational", label: "Inspirational" },
];

// Real social media SVG icons
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function XTwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: InstagramIcon, color: "#E4405F" },
  { id: "twitter", label: "X", icon: XTwitterIcon, color: "#000000" },
  { id: "linkedin", label: "LinkedIn", icon: LinkedInIcon, color: "#0A66C2" },
  { id: "facebook", label: "Facebook", icon: FacebookIcon, color: "#1877F2" },
  { id: "youtube", label: "YouTube", icon: YouTubeIcon, color: "#FF0000" },
];

export function AITextAssistant({ onInsert, onClose }: AITextAssistantProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AITab>("post");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("casual");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram"]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);
  const [generatedIdeas, setGeneratedIdeas] = useState<Array<{ title: string; description: string; pillar: string }>>([]);
  const [copied, setCopied] = useState(false);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platformId)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter(p => p !== platformId);
      }
      return [...prev, platformId];
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Please enter a topic or prompt", variant: "destructive" });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({ title: "Select at least one platform", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratedContent("");
    setGeneratedHashtags([]);
    setGeneratedIdeas([]);

    try {
      let response;
      let data;

      switch (activeTab) {
        case "post":
          response = await fetch("/api/ai/generate/post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platforms: selectedPlatforms,
              topic: prompt,
              tone,
              length: "medium",
              includeHashtags: true,
              includeEmojis: true,
              includeCTA: false,
            }),
          });
          data = await response.json();
          if (!response.ok) throw new Error(data.error?.message || "Generation failed");
          setGeneratedContent(data.data.content);
          break;

        case "caption":
          response = await fetch("/api/ai/generate/caption", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platforms: selectedPlatforms,
              mediaType: "image",
              mediaDescription: prompt,
              tone,
              length: "medium",
              includeHashtags: true,
              includeEmojis: true,
            }),
          });
          data = await response.json();
          if (!response.ok) throw new Error(data.error?.message || "Generation failed");
          setGeneratedContent(data.data.content);
          break;

        case "hashtag":
          response = await fetch("/api/ai/generate/hashtags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platforms: selectedPlatforms,
              topic: prompt,
              count: 15,
              categories: ["trending", "niche"],
            }),
          });
          data = await response.json();
          if (!response.ok) throw new Error(data.error?.message || "Generation failed");
          setGeneratedHashtags(data.data.hashtags);
          break;

        case "idea":
          response = await fetch("/api/ai/generate/ideas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brand: prompt,
              industry: prompt,
              platforms: selectedPlatforms,
              contentPillars: ["educational", "entertaining"],
              count: 5,
            }),
          });
          data = await response.json();
          if (!response.ok) throw new Error(data.error?.message || "Generation failed");
          setGeneratedIdeas(data.data.ideas);
          break;
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsertContent = (content: string) => {
    onInsert(content);
    toast({ title: "Content inserted into composer!" });
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const getPlaceholder = () => {
    switch (activeTab) {
      case "post": return "Describe what your post should be about...";
      case "caption": return "Describe the image/video you need a caption for...";
      case "hashtag": return "Enter your topic or niche for hashtags...";
      case "idea": return "Enter your brand/industry for content ideas...";
    }
  };

  const hasResults = generatedContent || generatedHashtags.length > 0 || generatedIdeas.length > 0;

  return (
    <div className="space-y-3">
      {/* Divider with AI label */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-brand-500">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">AI Generate</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Hide
          </button>
        )}
      </div>

      {/* Content type pills */}
      <div className="flex flex-wrap gap-1.5">
        {AI_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setGeneratedContent("");
                setGeneratedHashtags([]);
                setGeneratedIdeas([]);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Platform multi-select with real icons */}
      <div className="space-y-1.5">
        <span className="text-[11px] text-muted-foreground font-medium">Platforms</span>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            const isSelected = selectedPlatforms.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  isSelected
                    ? "border-transparent shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40"
                }`}
                style={isSelected ? { backgroundColor: p.color + "18", color: p.color, borderColor: p.color + "40" } : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                {p.label}
                {isSelected && <Check className="w-3 h-3 ml-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tone selection */}
      <div className="space-y-1.5">
        <span className="text-[11px] text-muted-foreground font-medium">Tone</span>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                tone === t.id
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt input - lighter, inline style */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={getPlaceholder()}
        rows={2}
        className="w-full p-2.5 rounded-lg border bg-muted/30 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-brand-500 focus:bg-background placeholder:text-muted-foreground/60 transition-colors"
      />

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim() || selectedPlatforms.length === 0}
        size="sm"
        className="w-full bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600 text-white"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Generate {activeTab === "post" ? "Post" : activeTab === "caption" ? "Caption" : activeTab === "hashtag" ? "Hashtags" : "Ideas"}
            {selectedPlatforms.length > 1 && (
              <span className="ml-1 opacity-70">for {selectedPlatforms.length} platforms</span>
            )}
          </>
        )}
      </Button>

      {/* Results - clean, inline */}
      {hasResults && (
        <div className="space-y-2">
          {/* Post / Caption Result */}
          {(activeTab === "post" || activeTab === "caption") && generatedContent && (
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-muted/40 text-sm whitespace-pre-wrap border border-border/50">
                {generatedContent}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-brand-500 hover:bg-brand-600"
                  onClick={() => handleInsertContent(generatedContent)}
                >
                  <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                  Insert into Post
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(generatedContent)}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          )}

          {/* Hashtags Result */}
          {activeTab === "hashtag" && generatedHashtags.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-muted/40 border border-border/50">
                {generatedHashtags.map((tag, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="cursor-pointer hover:bg-brand-500/20 text-xs"
                    onClick={() => handleCopy(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-brand-500 hover:bg-brand-600"
                  onClick={() => handleInsertContent(generatedHashtags.join(" "))}
                >
                  <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                  Insert All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(generatedHashtags.join(" "))}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          )}

          {/* Ideas Result */}
          {activeTab === "idea" && generatedIdeas.length > 0 && (
            <div className="space-y-1.5">
              {generatedIdeas.map((idea, i) => (
                <button
                  key={i}
                  onClick={() => handleInsertContent(idea.title + "\n\n" + idea.description)}
                  className="w-full text-left p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-brand-500 mt-0.5">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{idea.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{idea.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
