"use client";

import { useWebsiteEditorStore } from "@/stores/website-editor-store";
import { BLOCK_VARIANTS } from "@/lib/website/block-variants";
import type {
  WebsiteBlock,
  HeroContent,
  FeaturesContent,
  PricingContent,
  TestimonialsContent,
  ContactContent,
  TextContent,
  FAQContent,
  StatsContent,
  CTAContent,
  HeaderContent,
  FooterContent,
  BlogContent,
  TeamContent,
  GalleryContent,
  PortfolioContent,
  VideoContent,
  ImageContent,
  DividerContent,
  SpacerContent,
  LogoCloudContent,
  EntranceAnimation,
  ScrollEffect,
  HoverEffect,
} from "@/types/website-builder";
import { Paintbrush, Type, Sparkles, Settings2, Smartphone } from "lucide-react";

export function PropertiesPanel() {
  const {
    blocks,
    selectedBlockId,
    rightPanel,
    setRightPanel,
    updateBlockContent,
    updateBlockStyle,
    updateBlockAnimation,
    updateBlock,
  } = useWebsiteEditorStore();

  const block = blocks.find((b) => b.id === selectedBlockId);
  if (!block) return null;

  const tabs = [
    { id: "content" as const, label: "Content", icon: Type },
    { id: "style" as const, label: "Style", icon: Paintbrush },
    { id: "animation" as const, label: "Animate", icon: Sparkles },
    { id: "responsive" as const, label: "Responsive", icon: Smartphone },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border px-2 pt-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setRightPanel(id)}
            className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              rightPanel === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {rightPanel === "content" && <ContentEditor block={block} />}
        {rightPanel === "style" && <StyleEditor block={block} />}
        {rightPanel === "animation" && <AnimationEditor block={block} />}
        {rightPanel === "responsive" && <ResponsiveEditor block={block} />}
      </div>
    </div>
  );
}

// --- Content Editor ---

function ContentEditor({ block }: { block: WebsiteBlock }) {
  const { updateBlockContent, updateBlock } = useWebsiteEditorStore();
  const variants = BLOCK_VARIANTS[block.type] || [];

  const update = (field: string, value: unknown) => {
    updateBlockContent(block.id, { [field]: value } as Partial<typeof block.content>);
  };

  return (
    <div className="space-y-4">
      {/* Variant Selector */}
      {variants.length > 1 && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Variant</label>
          <select
            value={block.variant}
            onChange={(e) => updateBlock(block.id, { variant: e.target.value })}
            className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Type-specific content fields */}
      <GenericContentFields block={block} />
    </div>
  );
}

function GenericContentFields({ block }: { block: WebsiteBlock }) {
  const { updateBlockContent } = useWebsiteEditorStore();
  const content = block.content as unknown as Record<string, unknown>;

  const textField = (label: string, field: string, multiline = false) => {
    const val = (content[field] as string) || "";
    return (
      <div key={field}>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
        {multiline ? (
          <textarea
            value={val}
            onChange={(e) => updateBlockContent(block.id, { [field]: e.target.value } as never)}
            rows={3}
            className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        ) : (
          <input
            type="text"
            value={val}
            onChange={(e) => updateBlockContent(block.id, { [field]: e.target.value } as never)}
            className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}
      </div>
    );
  };

  const urlField = (label: string, field: string) => {
    const val = (content[field] as string) || "";
    return (
      <div key={field}>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
        <input
          type="url"
          value={val}
          onChange={(e) => updateBlockContent(block.id, { [field]: e.target.value } as never)}
          placeholder="https://..."
          className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    );
  };

  const numberField = (label: string, field: string, min = 0, max = 999) => {
    const val = (content[field] as number) || 0;
    return (
      <div key={field}>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
        <input
          type="number"
          min={min}
          max={max}
          value={val}
          onChange={(e) => updateBlockContent(block.id, { [field]: parseInt(e.target.value) || 0 } as never)}
          className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    );
  };

  // Common patterns by block type
  switch (block.type) {
    case "hero":
      return <>{textField("Headline", "headline")}{textField("Subheadline", "subheadline")}{textField("Description", "description", true)}{urlField("Media URL", "mediaUrl")}</>;
    case "features":
    case "testimonials":
    case "team":
    case "gallery":
    case "portfolio":
    case "blog":
    case "faq":
    case "stats":
    case "logo-cloud":
      return <>{textField("Headline", "headline")}{textField("Subheadline", "subheadline")}<p className="text-xs text-muted-foreground italic">Edit items directly in the block or use AI to generate content.</p></>;
    case "pricing":
      return <>{textField("Headline", "headline")}{textField("Subheadline", "subheadline")}<p className="text-xs text-muted-foreground italic">Edit pricing plans directly or use AI to customize.</p></>;
    case "contact":
      return <>{textField("Headline", "headline")}{textField("Description", "description", true)}{textField("Submit Button", "submitText")}{textField("Success Message", "successMessage")}{textField("Email", "email")}{textField("Phone", "phone")}{textField("Address", "address")}</>;
    case "text":
      return <>{textField("Heading", "heading")}{textField("Body", "body", true)}</>;
    case "cta":
      return <>{textField("Headline", "headline")}{textField("Description", "description", true)}</>;
    case "video":
      return <>{textField("Headline", "headline")}{textField("Description", "description", true)}{urlField("Video URL", "videoUrl")}</>;
    case "image":
      return <>{urlField("Image URL", "imageUrl")}{textField("Alt Text", "alt")}{textField("Caption", "caption")}{urlField("Link", "link")}</>;
    case "divider":
      return <>{numberField("Height", "height", 1, 20)}</>;
    case "spacer":
      return <>{numberField("Height (px)", "height", 10, 400)}{numberField("Mobile Height (px)", "mobileHeight", 10, 200)}</>;
    case "custom-html":
      return <>{textField("HTML", "html", true)}{textField("CSS", "css", true)}</>;
    default:
      return <>{textField("Headline", "headline")}{textField("Subheadline", "subheadline")}</>;
  }
}

// --- Style Editor ---

function StyleEditor({ block }: { block: WebsiteBlock }) {
  const { updateBlockStyle } = useWebsiteEditorStore();
  const style = block.style;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Background Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={style.bgColor || "#ffffff"}
            onChange={(e) => updateBlockStyle(block.id, { bgColor: e.target.value })}
            className="w-8 h-8 rounded border border-border cursor-pointer"
          />
          <input
            type="text"
            value={style.bgColor || ""}
            onChange={(e) => updateBlockStyle(block.id, { bgColor: e.target.value })}
            placeholder="transparent"
            className="flex-1 text-sm px-2 py-1.5 border border-border rounded-md bg-background"
          />
          {style.bgColor && (
            <button onClick={() => updateBlockStyle(block.id, { bgColor: undefined })} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Text Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={style.textColor || "#000000"} onChange={(e) => updateBlockStyle(block.id, { textColor: e.target.value })} className="w-8 h-8 rounded border border-border cursor-pointer" />
          <input type="text" value={style.textColor || ""} onChange={(e) => updateBlockStyle(block.id, { textColor: e.target.value })} placeholder="inherit" className="flex-1 text-sm px-2 py-1.5 border border-border rounded-md bg-background" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Background Image</label>
        <input type="url" value={style.bgImage || ""} onChange={(e) => updateBlockStyle(block.id, { bgImage: e.target.value || undefined })} placeholder="https://..." className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background" />
      </div>

      {style.bgImage && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Background Overlay</label>
          <input type="text" value={style.bgOverlay || ""} onChange={(e) => updateBlockStyle(block.id, { bgOverlay: e.target.value || undefined })} placeholder="rgba(0,0,0,0.5)" className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background" />
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Padding (px)</label>
        <div className="grid grid-cols-2 gap-2">
          {(["top", "bottom", "left", "right"] as const).map((side) => (
            <div key={side} className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-6">{side[0].toUpperCase()}</span>
              <input
                type="number"
                min={0}
                value={style.padding?.[side] ?? ""}
                onChange={(e) => updateBlockStyle(block.id, { padding: { ...(style.padding || { top: 0, bottom: 0, left: 0, right: 0 }), [side]: parseInt(e.target.value) || 0 } })}
                className="flex-1 text-sm px-2 py-1 border border-border rounded-md bg-background w-full"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Width</label>
        <select
          value={style.maxWidth || ""}
          onChange={(e) => updateBlockStyle(block.id, { maxWidth: (e.target.value || undefined) as BlockStyle["maxWidth"] })}
          className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background"
        >
          <option value="">Default</option>
          <option value="sm">Small (640px)</option>
          <option value="md">Medium (768px)</option>
          <option value="lg">Large (1024px)</option>
          <option value="xl">X-Large (1280px)</option>
          <option value="full">Full Width</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Border Radius (px)</label>
        <input type="number" min={0} value={style.borderRadius ?? ""} onChange={(e) => updateBlockStyle(block.id, { borderRadius: parseInt(e.target.value) || 0 })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background" />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Custom CSS</label>
        <textarea
          value={style.customCss || ""}
          onChange={(e) => updateBlockStyle(block.id, { customCss: e.target.value })}
          rows={3}
          placeholder=".wb-block-xxx { ... }"
          className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background font-mono text-xs resize-none"
        />
      </div>
    </div>
  );
}

// --- Animation Editor ---

function AnimationEditor({ block }: { block: WebsiteBlock }) {
  const { updateBlockAnimation } = useWebsiteEditorStore();
  const anim = block.animation;

  const entranceOptions: { value: EntranceAnimation; label: string }[] = [
    { value: "none", label: "None" },
    { value: "fade-in", label: "Fade In" },
    { value: "slide-up", label: "Slide Up" },
    { value: "slide-down", label: "Slide Down" },
    { value: "slide-left", label: "Slide Left" },
    { value: "slide-right", label: "Slide Right" },
    { value: "zoom-in", label: "Zoom In" },
    { value: "zoom-out", label: "Zoom Out" },
    { value: "flip", label: "Flip" },
    { value: "bounce", label: "Bounce" },
    { value: "rotate-in", label: "Rotate In" },
  ];

  const scrollOptions: { value: ScrollEffect; label: string }[] = [
    { value: "none", label: "None" },
    { value: "parallax", label: "Parallax" },
    { value: "fade", label: "Fade on Scroll" },
    { value: "scale", label: "Scale on Scroll" },
    { value: "sticky", label: "Sticky" },
  ];

  const hoverOptions: { value: HoverEffect; label: string }[] = [
    { value: "none", label: "None" },
    { value: "lift", label: "Lift" },
    { value: "glow", label: "Glow" },
    { value: "scale", label: "Scale" },
    { value: "tilt", label: "3D Tilt" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrance Animation</label>
        <select value={anim.entrance || "none"} onChange={(e) => updateBlockAnimation(block.id, { entrance: e.target.value as EntranceAnimation })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background">
          {entranceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {anim.entrance && anim.entrance !== "none" && (
        <>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Duration (ms)</label>
            <input type="number" min={100} max={3000} step={100} value={anim.entranceDuration || 600} onChange={(e) => updateBlockAnimation(block.id, { entranceDuration: parseInt(e.target.value) || 600 })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Delay (ms)</label>
            <input type="number" min={0} max={2000} step={50} value={anim.entranceDelay || 0} onChange={(e) => updateBlockAnimation(block.id, { entranceDelay: parseInt(e.target.value) || 0 })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background" />
          </div>
        </>
      )}

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Scroll Effect</label>
        <select value={anim.scroll || "none"} onChange={(e) => updateBlockAnimation(block.id, { scroll: e.target.value as ScrollEffect })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background">
          {scrollOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Hover Effect</label>
        <select value={anim.hover || "none"} onChange={(e) => updateBlockAnimation(block.id, { hover: e.target.value as HoverEffect })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background">
          {hoverOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

// --- Responsive Editor ---

function ResponsiveEditor({ block }: { block: WebsiteBlock }) {
  const { updateBlock } = useWebsiteEditorStore();
  const resp = block.responsive;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">Hide on Mobile</label>
        <input type="checkbox" checked={resp.hideOnMobile || false} onChange={(e) => updateBlock(block.id, { responsive: { ...resp, hideOnMobile: e.target.checked } })} className="rounded" />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">Hide on Desktop</label>
        <input type="checkbox" checked={resp.hideOnDesktop || false} onChange={(e) => updateBlock(block.id, { responsive: { ...resp, hideOnDesktop: e.target.checked } })} className="rounded" />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">Member Only</label>
        <input type="checkbox" checked={block.visibility.memberOnly || false} onChange={(e) => updateBlock(block.id, { visibility: { ...block.visibility, memberOnly: e.target.checked } })} className="rounded" />
      </div>
    </div>
  );
}

// Need this import for type reference
import type { BlockStyle } from "@/types/website-builder";
