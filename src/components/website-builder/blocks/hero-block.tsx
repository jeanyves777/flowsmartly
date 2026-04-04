"use client";

import type { WebsiteBlock, WebsiteTheme, HeroContent } from "@/types/website-builder";

interface Props {
  block: WebsiteBlock;
  theme: WebsiteTheme;
  isEditing?: boolean;
}

export function HeroBlock({ block, theme, isEditing }: Props) {
  const content = block.content as HeroContent;
  const variant = block.variant;

  const isCentered = variant === "centered" || variant === "minimal" || variant === "gradient";
  const isSplit = variant === "split-left" || variant === "split-right";
  const imageOnLeft = variant === "split-right";

  const buttonBase = `inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-[var(--wb-button-radius)] transition-all duration-200`;
  const solidBtn = `${buttonBase} bg-[var(--wb-primary)] text-white hover:opacity-90`;
  const outlineBtn = `${buttonBase} border-2 border-[var(--wb-primary)] text-[var(--wb-primary)] hover:bg-[var(--wb-primary)] hover:text-white`;
  const ghostBtn = `${buttonBase} text-[var(--wb-primary)] hover:bg-[var(--wb-primary)]/10`;

  const getButtonClass = (style?: string) => {
    if (style === "outline") return outlineBtn;
    if (style === "ghost") return ghostBtn;
    return solidBtn;
  };

  const renderCTA = () => (
    <div className={`flex flex-wrap gap-4 ${isCentered ? "justify-center" : ""}`}>
      {content.primaryCta && (
        <a href={isEditing ? undefined : content.primaryCta.href} className={getButtonClass(content.primaryCta.style)}>
          {content.primaryCta.text}
        </a>
      )}
      {content.secondaryCta && (
        <a href={isEditing ? undefined : content.secondaryCta.href} className={getButtonClass(content.secondaryCta.style)}>
          {content.secondaryCta.text}
        </a>
      )}
    </div>
  );

  const renderText = () => (
    <div className={`${isCentered ? "text-center" : ""} space-y-6`}>
      {content.badge && (
        <span className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-[var(--wb-primary)]/10 text-[var(--wb-primary)]">
          {content.badge}
        </span>
      )}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
        {content.headline}
      </h1>
      {content.subheadline && (
        <p className="text-xl sm:text-2xl text-[var(--wb-text-muted)] max-w-3xl mx-auto leading-relaxed">
          {content.subheadline}
        </p>
      )}
      {content.description && (
        <p className="text-lg text-[var(--wb-text-muted)] max-w-2xl mx-auto">
          {content.description}
        </p>
      )}
      {renderCTA()}
    </div>
  );

  const renderMedia = () => {
    if (!content.mediaUrl) {
      return (
        <div className="aspect-video bg-[var(--wb-surface)] rounded-xl border border-[var(--wb-border)] flex items-center justify-center text-[var(--wb-text-muted)]">
          {isEditing ? "Click to add media" : ""}
        </div>
      );
    }
    if (content.mediaType === "video") {
      return (
        <video
          src={content.mediaUrl}
          className="w-full rounded-xl shadow-2xl"
          autoPlay
          muted
          loop
          playsInline
        />
      );
    }
    return (
      <img
        src={content.mediaUrl}
        alt={content.headline}
        className="w-full rounded-xl shadow-2xl object-cover"
      />
    );
  };

  // Centered layout
  if (isCentered) {
    return (
      <div className={`py-20 sm:py-28 lg:py-36 ${variant === "gradient" ? "bg-gradient-to-br from-[var(--wb-primary)]/5 via-transparent to-[var(--wb-secondary)]/5" : ""}`}>
        {renderText()}
        {content.mediaUrl && content.mediaPosition !== "background" && (
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
          <div className={imageOnLeft ? "lg:order-2" : ""}>
            {renderText()}
          </div>
          <div className={imageOnLeft ? "lg:order-1" : ""}>
            {renderMedia()}
          </div>
        </div>
      </div>
    );
  }

  // Video background
  if (variant === "video-bg") {
    return (
      <div className="relative py-32 sm:py-40 flex items-center justify-center overflow-hidden">
        {content.mediaUrl && (
          <video
            src={content.mediaUrl}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-white text-center">
          {renderText()}
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="py-20">
      {renderText()}
    </div>
  );
}
