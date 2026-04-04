"use client";

import type { WebsiteBlock, WebsiteTheme, HeroContent } from "@/types/website-builder";
import { headlineStyleFromBlock, bodyStyleFromBlock, buttonStyleFromCTA } from "@/lib/website/theme-resolver";
import { ImageIcon } from "lucide-react";

interface Props {
  block: WebsiteBlock;
  theme: WebsiteTheme;
  isEditing?: boolean;
}

export function HeroBlock({ block, theme, isEditing }: Props) {
  const content = block.content as HeroContent;
  const variant = block.variant;
  const style = block.style;

  const isCentered = variant === "centered" || variant === "minimal" || variant === "gradient";
  const isSplit = variant === "split-left" || variant === "split-right";
  const imageOnLeft = variant === "split-right";

  const hStyle = headlineStyleFromBlock(style);
  const bStyle = bodyStyleFromBlock(style);

  const getButtonClass = (btnStyle?: string) => {
    const base = `inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-[var(--wb-button-radius)] transition-all duration-200`;
    if (btnStyle === "outline") return `${base} border-2 border-current hover:opacity-80`;
    if (btnStyle === "ghost") return `${base} hover:opacity-80`;
    if (btnStyle === "gradient") return `${base} bg-gradient-to-r from-[var(--wb-primary)] to-[var(--wb-secondary)] text-white hover:opacity-90`;
    return `${base} bg-[var(--wb-primary)] text-white hover:opacity-90`;
  };

  const renderCTA = () => (
    <div className={`flex flex-wrap gap-4 ${isCentered ? "justify-center" : ""}`}>
      {content.primaryCta && (
        <a
          href={isEditing ? undefined : content.primaryCta.href}
          className={getButtonClass(content.primaryCta.style)}
          style={buttonStyleFromCTA(content.primaryCta)}
        >
          {content.primaryCta.text}
        </a>
      )}
      {content.secondaryCta && (
        <a
          href={isEditing ? undefined : content.secondaryCta.href}
          className={getButtonClass(content.secondaryCta.style)}
          style={buttonStyleFromCTA(content.secondaryCta)}
        >
          {content.secondaryCta.text}
        </a>
      )}
    </div>
  );

  const renderText = () => (
    <div className={`${isCentered ? "text-center" : ""} space-y-6`}>
      {content.badge && (
        <span className="inline-block px-4 py-1.5 text-sm font-medium rounded-full bg-white/20 backdrop-blur-sm border border-white/10">
          {content.badge}
        </span>
      )}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]" style={hStyle}>
        {content.headline}
      </h1>
      {content.subheadline && (
        <p className="text-xl sm:text-2xl opacity-90 max-w-3xl mx-auto leading-relaxed" style={bStyle}>
          {content.subheadline}
        </p>
      )}
      {content.description && (
        <p className="text-lg opacity-80 max-w-2xl mx-auto" style={bStyle}>
          {content.description}
        </p>
      )}
      {renderCTA()}
    </div>
  );

  const renderMedia = () => {
    if (!content.mediaUrl) {
      return (
        <div className="aspect-video rounded-2xl overflow-hidden relative bg-gradient-to-br from-[var(--wb-primary)]/10 to-[var(--wb-secondary)]/10 border border-[var(--wb-border)]/50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--wb-primary-rgb),0.08)_0%,transparent_70%)]" />
          <ImageIcon className="w-16 h-16 text-[var(--wb-primary)]/20" />
        </div>
      );
    }
    if (content.mediaType === "video") {
      return <video src={content.mediaUrl} className="w-full rounded-2xl shadow-2xl" autoPlay muted loop playsInline />;
    }
    return <img src={content.mediaUrl} alt={content.headline} className="w-full rounded-2xl shadow-2xl object-cover" />;
  };

  // Gradient variant — full gradient background with white text
  if (variant === "gradient") {
    return (
      <div className="relative overflow-hidden" style={{ padding: "96px 0" }}>
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--wb-primary)] to-[var(--wb-secondary)]" />
        {/* Decorative dots pattern */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        {/* Content */}
        <div className="relative z-10 text-white">
          {renderText()}
          {content.mediaUrl && <div className="mt-12 max-w-4xl mx-auto">{renderMedia()}</div>}
        </div>
      </div>
    );
  }

  // Centered
  if (isCentered) {
    return (
      <div className="py-20 sm:py-28 lg:py-36">
        {renderText()}
        {content.mediaUrl && content.mediaPosition !== "background" && (
          <div className="mt-12 max-w-4xl mx-auto">{renderMedia()}</div>
        )}
        {!content.mediaUrl && isEditing && (
          <div className="mt-12 max-w-4xl mx-auto">{renderMedia()}</div>
        )}
        {content.logoCloudLogos && content.logoCloudLogos.length > 0 && (
          <div className="mt-16 flex items-center justify-center gap-8 opacity-50 flex-wrap">
            {content.logoCloudLogos.map((logo, i) => (
              <img key={i} src={logo} alt="" className="h-8 grayscale" />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Split layout
  if (isSplit) {
    return (
      <div className="py-16 sm:py-24">
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${imageOnLeft ? "lg:flex-row-reverse" : ""}`}>
          <div className={imageOnLeft ? "lg:order-2" : ""}>{renderText()}</div>
          <div className={imageOnLeft ? "lg:order-1" : ""}>{renderMedia()}</div>
        </div>
      </div>
    );
  }

  // Video background
  if (variant === "video-bg") {
    return (
      <div className="relative py-32 sm:py-40 flex items-center justify-center overflow-hidden">
        {content.mediaUrl && <video src={content.mediaUrl} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-white text-center">{renderText()}</div>
      </div>
    );
  }

  return <div className="py-20">{renderText()}</div>;
}
