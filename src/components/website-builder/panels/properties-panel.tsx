"use client";

import { useWebsiteEditorStore } from "@/stores/website-editor-store";
import { BLOCK_VARIANTS } from "@/lib/website/block-variants";
import { ColorPickerPopover } from "../shared/color-picker-popover";
import { GradientBuilder } from "../shared/gradient-builder";
import { ImageField } from "../shared/image-field";
import type {
  WebsiteBlock,
  BlockStyle,
  EntranceAnimation,
  ScrollEffect,
  HoverEffect,
} from "@/types/website-builder";
import { Paintbrush, Type, Sparkles, Smartphone, LayoutGrid } from "lucide-react";

// --- Font Options ---
const FONT_OPTIONS = [
  "Inter", "Poppins", "Playfair Display", "Roboto", "Montserrat", "Lato",
  "Open Sans", "Raleway", "Merriweather", "Oswald", "Nunito", "Source Sans 3",
  "Work Sans", "DM Sans", "Space Grotesk", "Outfit", "Manrope",
];

const FONT_WEIGHT_OPTIONS = [
  { value: "300", label: "Light" }, { value: "400", label: "Regular" },
  { value: "500", label: "Medium" }, { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" }, { value: "800", label: "Extra Bold" },
];

export function PropertiesPanel() {
  const {
    blocks, selectedBlockId, rightPanel, setRightPanel,
    updateBlockContent, updateBlockStyle, updateBlockAnimation, updateBlock,
  } = useWebsiteEditorStore();

  const block = blocks.find((b) => b.id === selectedBlockId);
  if (!block) return null;

  const tabs = [
    { id: "content" as const, label: "Content", icon: Type },
    { id: "style" as const, label: "Style", icon: Paintbrush },
    { id: "animation" as const, label: "Animate", icon: Sparkles },
    { id: "responsive" as const, label: "More", icon: Smartphone },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border px-2 pt-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setRightPanel(id)}
            className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              rightPanel === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {rightPanel === "content" && <ContentEditor block={block} />}
        {rightPanel === "style" && <StyleEditor block={block} />}
        {rightPanel === "animation" && <AnimationEditor block={block} />}
        {rightPanel === "responsive" && <ResponsiveEditor block={block} />}
      </div>
    </div>
  );
}

// --- Section Header ---
function SectionHeader({ title }: { title: string }) {
  return <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-2 mb-2 pt-2 border-t border-border first:border-0 first:pt-0 first:mt-0">{title}</p>;
}

// --- Content Editor ---
function ContentEditor({ block }: { block: WebsiteBlock }) {
  const { updateBlockContent, updateBlock, updateBlockStyle } = useWebsiteEditorStore();
  const variants = BLOCK_VARIANTS[block.type] || [];
  const content = block.content as unknown as Record<string, unknown>;
  const style = block.style;

  const textField = (label: string, field: string, multiline = false) => {
    const val = (content[field] as string) || "";
    return (
      <div key={field}>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
        {multiline ? (
          <textarea value={val} onChange={(e) => updateBlockContent(block.id, { [field]: e.target.value } as never)} rows={3} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        ) : (
          <input type="text" value={val} onChange={(e) => updateBlockContent(block.id, { [field]: e.target.value } as never)} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
        )}
      </div>
    );
  };

  const imageField = (label: string, field: string) => (
    <ImageField
      key={field}
      label={label}
      value={(content[field] as string) || ""}
      onChange={(url) => updateBlockContent(block.id, { [field]: url } as never)}
      aspectRatio={field === "mediaUrl" || field === "imageUrl" ? "16/9" : "1/1"}
    />
  );

  // Determine which text/image fields to show based on block type
  const renderContentFields = () => {
    switch (block.type) {
      case "hero":
        return <>{textField("Headline", "headline")}{textField("Subheadline", "subheadline")}{textField("Description", "description", true)}{imageField("Hero Image/Video", "mediaUrl")}</>;
      case "text":
        return <>{textField("Heading", "heading")}{textField("Body", "body", true)}</>;
      case "cta":
        return <>{textField("Headline", "headline")}{textField("Description", "description", true)}</>;
      case "contact":
        return <>{textField("Headline", "headline")}{textField("Description", "description", true)}{textField("Submit Button", "submitText")}{textField("Success Message", "successMessage")}{textField("Email", "email")}{textField("Phone", "phone")}{textField("Address", "address")}</>;
      case "video":
        return <>{textField("Headline", "headline")}{textField("Description", "description", true)}{textField("Video URL", "videoUrl")}</>;
      case "image":
        return <>{imageField("Image", "imageUrl")}{textField("Alt Text", "alt")}{textField("Caption", "caption")}</>;
      case "divider":
        return <><label className="text-xs font-medium text-muted-foreground mb-1 block">Height</label><input type="number" min={1} max={20} value={(content.height as number) || 1} onChange={(e) => updateBlockContent(block.id, { height: parseInt(e.target.value) || 1 } as never)} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background" /></>;
      case "spacer":
        return <><label className="text-xs font-medium text-muted-foreground mb-1 block">Height (px)</label><input type="number" min={10} max={400} value={(content.height as number) || 60} onChange={(e) => updateBlockContent(block.id, { height: parseInt(e.target.value) || 60 } as never)} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background" /></>;
      case "custom-html":
        return <>{textField("HTML", "html", true)}{textField("CSS", "css", true)}</>;
      default:
        return <>{textField("Headline", "headline")}{textField("Subheadline", "subheadline")}<p className="text-xs text-muted-foreground italic">Edit items directly in the block or use AI to refine content.</p></>;
    }
  };

  // Blocks with text that support typography controls
  const hasTypography = ["hero", "text", "cta", "features", "pricing", "testimonials", "contact", "team", "faq", "stats", "blog", "portfolio"].includes(block.type);

  // Blocks with CTA buttons
  const hasButtons = ["hero", "cta", "pricing", "contact"].includes(block.type);

  return (
    <div className="space-y-3">
      {/* Variant Selector */}
      {variants.length > 1 && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Variant</label>
          <select value={block.variant} onChange={(e) => updateBlock(block.id, { variant: e.target.value })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background">
            {variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      )}

      {/* Content Fields */}
      {renderContentFields()}

      {/* Typography Controls */}
      {hasTypography && (
        <>
          <SectionHeader title="Headline Typography" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-0.5 block">Font</label>
              <select value={style.headlineFont || ""} onChange={(e) => updateBlockStyle(block.id, { headlineFont: e.target.value || undefined })} className="w-full text-xs px-1.5 py-1 border border-border rounded bg-background">
                <option value="">Theme default</option>
                {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-0.5 block">Size</label>
              <input type="number" min={12} max={96} value={style.headlineFontSize || ""} onChange={(e) => updateBlockStyle(block.id, { headlineFontSize: parseInt(e.target.value) || undefined })} placeholder="Auto" className="w-full text-xs px-1.5 py-1 border border-border rounded bg-background" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-0.5 block">Weight</label>
              <select value={style.headlineFontWeight || ""} onChange={(e) => updateBlockStyle(block.id, { headlineFontWeight: e.target.value || undefined })} className="w-full text-xs px-1.5 py-1 border border-border rounded bg-background">
                <option value="">Default</option>
                {FONT_WEIGHT_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-0.5 block">Transform</label>
              <select value={style.headlineTransform || "none"} onChange={(e) => updateBlockStyle(block.id, { headlineTransform: e.target.value as BlockStyle["headlineTransform"] })} className="w-full text-xs px-1.5 py-1 border border-border rounded bg-background">
                <option value="none">Normal</option>
                <option value="uppercase">UPPERCASE</option>
                <option value="capitalize">Capitalize</option>
                <option value="lowercase">lowercase</option>
              </select>
            </div>
          </div>
          <ColorPickerPopover label="Headline Color" value={style.headlineColor || ""} onChange={(c) => updateBlockStyle(block.id, { headlineColor: c || undefined })} />

          <SectionHeader title="Body Typography" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-0.5 block">Font</label>
              <select value={style.bodyFont || ""} onChange={(e) => updateBlockStyle(block.id, { bodyFont: e.target.value || undefined })} className="w-full text-xs px-1.5 py-1 border border-border rounded bg-background">
                <option value="">Theme default</option>
                {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-0.5 block">Size</label>
              <input type="number" min={10} max={32} value={style.bodyFontSize || ""} onChange={(e) => updateBlockStyle(block.id, { bodyFontSize: parseInt(e.target.value) || undefined })} placeholder="Auto" className="w-full text-xs px-1.5 py-1 border border-border rounded bg-background" />
            </div>
          </div>
          <ColorPickerPopover label="Body Color" value={style.bodyColor || ""} onChange={(c) => updateBlockStyle(block.id, { bodyColor: c || undefined })} />
          <div>
            <label className="text-xs text-muted-foreground mb-0.5 block">Line Height</label>
            <input type="range" min={1} max={2.5} step={0.1} value={style.bodyLineHeight || 1.6} onChange={(e) => updateBlockStyle(block.id, { bodyLineHeight: parseFloat(e.target.value) })} className="w-full" />
            <span className="text-xs text-muted-foreground">{style.bodyLineHeight || 1.6}</span>
          </div>
        </>
      )}

      {/* Button Styling */}
      {hasButtons && (
        <>
          <SectionHeader title="Button Styling" />
          <p className="text-xs text-muted-foreground">Controls the primary CTA button on this block.</p>
          {/* We edit button styles through content.primaryCta properties */}
          {(() => {
            const cta = (content.primaryCta as Record<string, unknown>) || {};
            const updateCta = (field: string, val: unknown) => {
              updateBlockContent(block.id, { primaryCta: { ...cta, [field]: val } } as never);
            };
            return (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <ColorPickerPopover label="BG Color" value={(cta.bgColor as string) || ""} onChange={(c) => updateCta("bgColor", c || undefined)} />
                  <ColorPickerPopover label="Text Color" value={(cta.textColor as string) || ""} onChange={(c) => updateCta("textColor", c || undefined)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-0.5 block">Border Radius</label>
                    <input type="number" min={0} max={50} value={(cta.borderRadius as number) ?? ""} onChange={(e) => updateCta("borderRadius", parseInt(e.target.value) || undefined)} placeholder="Theme" className="w-full text-xs px-1.5 py-1 border border-border rounded bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-0.5 block">Font Size</label>
                    <input type="number" min={10} max={24} value={(cta.fontSize as number) ?? ""} onChange={(e) => updateCta("fontSize", parseInt(e.target.value) || undefined)} placeholder="Auto" className="w-full text-xs px-1.5 py-1 border border-border rounded bg-background" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-0.5 block">Style</label>
                  <div className="flex gap-1">
                    {(["solid", "outline", "ghost", "gradient"] as const).map((s) => (
                      <button key={s} onClick={() => updateCta("style", s)} className={`flex-1 py-1 text-[10px] rounded border transition-colors capitalize ${(cta.style || "solid") === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

// --- Style Editor ---
function StyleEditor({ block }: { block: WebsiteBlock }) {
  const { updateBlockStyle } = useWebsiteEditorStore();
  const style = block.style;

  // Background presets
  const bgPresets = [
    { label: "None", action: () => updateBlockStyle(block.id, { bgColor: undefined, bgGradient: undefined, textColor: undefined }) },
    { label: "Surface", action: () => updateBlockStyle(block.id, { bgColor: "var(--wb-surface)", bgGradient: undefined, textColor: undefined }) },
    { label: "Primary Tint", action: () => updateBlockStyle(block.id, { bgColor: "rgba(var(--wb-primary-rgb), 0.05)", bgGradient: undefined, textColor: undefined }) },
    { label: "Primary", action: () => updateBlockStyle(block.id, { bgColor: "var(--wb-primary)", bgGradient: undefined, textColor: "#ffffff" }) },
    { label: "Dark", action: () => updateBlockStyle(block.id, { bgColor: "var(--wb-text)", bgGradient: undefined, textColor: "#ffffff" }) },
  ];

  // Padding presets
  const paddingPresets = [
    { label: "Compact", p: { top: 40, bottom: 40, left: 20, right: 20 } },
    { label: "Normal", p: { top: 64, bottom: 64, left: 24, right: 24 } },
    { label: "Spacious", p: { top: 96, bottom: 96, left: 32, right: 32 } },
  ];

  return (
    <div className="space-y-3">
      {/* Quick Background Presets */}
      <div>
        <SectionHeader title="Quick Background" />
        <div className="flex flex-wrap gap-1">
          {bgPresets.map((p) => (
            <button key={p.label} onClick={p.action} className="px-2 py-1 text-[10px] rounded border border-border hover:border-primary/50 transition-colors">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Background Color */}
      <ColorPickerPopover label="Background Color" value={style.bgColor || ""} onChange={(c) => updateBlockStyle(block.id, { bgColor: c || undefined })} allowTransparent />

      {/* Background Gradient */}
      <GradientBuilder label="Gradient" value={style.bgGradient || ""} onChange={(g) => updateBlockStyle(block.id, { bgGradient: g || undefined })} />

      {/* Background Image */}
      <ImageField label="Background Image" value={style.bgImage || ""} onChange={(url) => updateBlockStyle(block.id, { bgImage: url || undefined })} aspectRatio="21/9" />

      {style.bgImage && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Image Overlay</label>
          <input type="text" value={style.bgOverlay || ""} onChange={(e) => updateBlockStyle(block.id, { bgOverlay: e.target.value || undefined })} placeholder="rgba(0,0,0,0.5)" className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background" />
        </div>
      )}

      {/* Text Color */}
      <ColorPickerPopover label="Text Color" value={style.textColor || ""} onChange={(c) => updateBlockStyle(block.id, { textColor: c || undefined })} />

      {/* Padding */}
      <SectionHeader title="Padding" />
      <div className="flex gap-1 mb-2">
        {paddingPresets.map((pp) => (
          <button key={pp.label} onClick={() => updateBlockStyle(block.id, { padding: pp.p })} className="flex-1 py-1 text-[10px] rounded border border-border hover:border-primary/50 transition-colors">{pp.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["top", "bottom", "left", "right"] as const).map((side) => (
          <div key={side} className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground w-5 uppercase">{side[0]}</span>
            <input type="number" min={0} value={style.padding?.[side] ?? ""} onChange={(e) => updateBlockStyle(block.id, { padding: { ...(style.padding || { top: 0, bottom: 0, left: 0, right: 0 }), [side]: parseInt(e.target.value) || 0 } })} placeholder="0" className="flex-1 text-xs px-1.5 py-1 border border-border rounded bg-background" />
          </div>
        ))}
      </div>

      {/* Max Width */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Width</label>
        <select value={style.maxWidth || ""} onChange={(e) => updateBlockStyle(block.id, { maxWidth: (e.target.value || undefined) as BlockStyle["maxWidth"] })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background">
          <option value="">Default (lg)</option>
          <option value="sm">Small (640px)</option><option value="md">Medium (768px)</option>
          <option value="lg">Large (1024px)</option><option value="xl">X-Large (1280px)</option>
          <option value="full">Full Width</option>
        </select>
      </div>

      {/* Border Radius */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Border Radius</label>
        <input type="number" min={0} value={style.borderRadius ?? ""} onChange={(e) => updateBlockStyle(block.id, { borderRadius: parseInt(e.target.value) || 0 })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background" />
      </div>

      {/* Shadow */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Shadow</label>
        <select value={style.shadow || ""} onChange={(e) => updateBlockStyle(block.id, { shadow: e.target.value || undefined })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background">
          <option value="">None</option>
          <option value="0 1px 3px rgba(0,0,0,0.1)">Subtle</option>
          <option value="0 4px 6px -1px rgba(0,0,0,0.1)">Medium</option>
          <option value="0 10px 25px -5px rgba(0,0,0,0.15)">Large</option>
          <option value="0 20px 50px -10px rgba(0,0,0,0.2)">XL</option>
        </select>
      </div>

      {/* Custom CSS */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Custom CSS</label>
        <textarea value={style.customCss || ""} onChange={(e) => updateBlockStyle(block.id, { customCss: e.target.value })} rows={2} placeholder=".wb-block-xxx { ... }" className="w-full text-xs px-2 py-1.5 border border-border rounded-md bg-background font-mono resize-none" />
      </div>
    </div>
  );
}

// --- Animation Editor ---
function AnimationEditor({ block }: { block: WebsiteBlock }) {
  const { updateBlockAnimation } = useWebsiteEditorStore();
  const anim = block.animation;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrance</label>
        <select value={anim.entrance || "none"} onChange={(e) => updateBlockAnimation(block.id, { entrance: e.target.value as EntranceAnimation })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background">
          {[["none","None"],["fade-in","Fade In"],["slide-up","Slide Up"],["slide-down","Slide Down"],["slide-left","Slide Left"],["slide-right","Slide Right"],["zoom-in","Zoom In"],["zoom-out","Zoom Out"],["flip","Flip"],["bounce","Bounce"],["rotate-in","Rotate"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {anim.entrance && anim.entrance !== "none" && (
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-muted-foreground mb-0.5 block">Duration (ms)</label><input type="number" min={100} max={3000} step={100} value={anim.entranceDuration || 600} onChange={(e) => updateBlockAnimation(block.id, { entranceDuration: parseInt(e.target.value) || 600 })} className="w-full text-xs px-1.5 py-1 border border-border rounded bg-background" /></div>
          <div><label className="text-xs text-muted-foreground mb-0.5 block">Delay (ms)</label><input type="number" min={0} max={2000} step={50} value={anim.entranceDelay || 0} onChange={(e) => updateBlockAnimation(block.id, { entranceDelay: parseInt(e.target.value) || 0 })} className="w-full text-xs px-1.5 py-1 border border-border rounded bg-background" /></div>
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Scroll Effect</label>
        <select value={anim.scroll || "none"} onChange={(e) => updateBlockAnimation(block.id, { scroll: e.target.value as ScrollEffect })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background">
          {[["none","None"],["parallax","Parallax"],["fade","Fade"],["scale","Scale"],["sticky","Sticky"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Hover Effect</label>
        <select value={anim.hover || "none"} onChange={(e) => updateBlockAnimation(block.id, { hover: e.target.value as HoverEffect })} className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-background">
          {[["none","None"],["lift","Lift"],["glow","Glow"],["scale","Scale"],["tilt","3D Tilt"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
    </div>
  );
}

// --- Responsive / Visibility Editor ---
function ResponsiveEditor({ block }: { block: WebsiteBlock }) {
  const { updateBlock } = useWebsiteEditorStore();
  const resp = block.responsive;

  return (
    <div className="space-y-3">
      <SectionHeader title="Visibility" />
      <div className="space-y-2">
        {[
          { label: "Hide on Mobile", field: "hideOnMobile", checked: resp.hideOnMobile },
          { label: "Hide on Desktop", field: "hideOnDesktop", checked: resp.hideOnDesktop },
          { label: "Member Only", field: "memberOnly", checked: block.visibility.memberOnly },
        ].map(({ label, field, checked }) => (
          <label key={field} className="flex items-center justify-between cursor-pointer">
            <span className="text-xs font-medium">{label}</span>
            <input
              type="checkbox"
              checked={checked || false}
              onChange={(e) => {
                if (field === "memberOnly") {
                  updateBlock(block.id, { visibility: { ...block.visibility, memberOnly: e.target.checked } });
                } else {
                  updateBlock(block.id, { responsive: { ...resp, [field]: e.target.checked } });
                }
              }}
              className="rounded"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
