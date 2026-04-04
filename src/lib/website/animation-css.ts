/**
 * CSS Animation Library for Website Builder
 *
 * Generates CSS keyframes and classes for:
 * - Entrance animations (triggered by IntersectionObserver)
 * - Scroll effects (parallax, fade, scale)
 * - Hover effects (lift, glow, scale, tilt)
 */

import type { BlockAnimation, WebsiteBlock } from "@/types/website-builder";

// --- Keyframes ---

const KEYFRAMES = `
@keyframes wb-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes wb-slide-up {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes wb-slide-down {
  from { opacity: 0; transform: translateY(-40px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes wb-slide-left {
  from { opacity: 0; transform: translateX(60px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes wb-slide-right {
  from { opacity: 0; transform: translateX(-60px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes wb-zoom-in {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes wb-zoom-out {
  from { opacity: 0; transform: scale(1.2); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes wb-flip {
  from { opacity: 0; transform: perspective(600px) rotateY(-90deg); }
  to { opacity: 1; transform: perspective(600px) rotateY(0); }
}
@keyframes wb-bounce {
  0% { opacity: 0; transform: translateY(60px); }
  60% { opacity: 1; transform: translateY(-10px); }
  80% { transform: translateY(5px); }
  100% { transform: translateY(0); }
}
@keyframes wb-rotate-in {
  from { opacity: 0; transform: rotate(-10deg) scale(0.9); }
  to { opacity: 1; transform: rotate(0) scale(1); }
}
@keyframes wb-counter {
  from { --num: 0; }
}
`;

// --- Entrance Animation CSS class ---

function getEntranceClass(blockId: string, anim: BlockAnimation): string {
  if (!anim.entrance || anim.entrance === "none") return "";

  const duration = anim.entranceDuration || 600;
  const delay = anim.entranceDelay || 0;
  const animName = `wb-${anim.entrance}`;

  return `
.wb-block-${blockId} {
  opacity: 0;
}
.wb-block-${blockId}.wb-visible {
  animation: ${animName} ${duration}ms ease-out ${delay}ms forwards;
}`;
}

// --- Hover Effect CSS ---

function getHoverClass(blockId: string, anim: BlockAnimation): string {
  if (!anim.hover || anim.hover === "none") return "";

  const effects: Record<string, string> = {
    lift: `
.wb-block-${blockId}:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.12);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}`,
    glow: `
.wb-block-${blockId}:hover {
  box-shadow: 0 0 30px rgba(var(--wb-primary-rgb, 59,130,246), 0.3);
  transition: box-shadow 0.3s ease;
}`,
    scale: `
.wb-block-${blockId}:hover {
  transform: scale(1.02);
  transition: transform 0.3s ease;
}`,
    tilt: `
.wb-block-${blockId} {
  transition: transform 0.3s ease;
  transform-style: preserve-3d;
}
.wb-block-${blockId}:hover {
  transform: perspective(1000px) rotateX(2deg) rotateY(2deg);
}`,
  };

  return effects[anim.hover] || "";
}

// --- Scroll Effect CSS ---

function getScrollClass(blockId: string, anim: BlockAnimation): string {
  if (!anim.scroll || anim.scroll === "none") return "";

  if (anim.scroll === "parallax") {
    const speed = anim.scrollSpeed || 0.5;
    return `
.wb-block-${blockId} {
  background-attachment: fixed;
  background-size: cover;
  background-position: center;
  will-change: transform;
}`;
  }

  // fade, scale, sticky are handled via IntersectionObserver + JS
  return "";
}

// --- Generate All CSS for a Page ---

export function generateAnimationCSS(blocks: WebsiteBlock[]): string {
  const hasAnimations = blocks.some(
    (b) =>
      (b.animation.entrance && b.animation.entrance !== "none") ||
      (b.animation.hover && b.animation.hover !== "none") ||
      (b.animation.scroll && b.animation.scroll !== "none")
  );

  if (!hasAnimations) return "";

  let css = KEYFRAMES;

  for (const block of blocks) {
    css += getEntranceClass(block.id, block.animation);
    css += getHoverClass(block.id, block.animation);
    css += getScrollClass(block.id, block.animation);
  }

  return css;
}

// --- IntersectionObserver Script (for scroll-triggered entrance animations) ---

export function generateAnimationScript(blocks: WebsiteBlock[]): string {
  const animatedBlocks = blocks.filter(
    (b) => b.animation.entrance && b.animation.entrance !== "none"
  );

  if (animatedBlocks.length === 0) return "";

  const scrollBlocks = blocks.filter(
    (b) => b.animation.scroll && b.animation.scroll !== "none" && b.animation.scroll !== "parallax"
  );

  return `
<script>
(function() {
  // Entrance animations via IntersectionObserver
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('wb-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('[data-wb-animate]').forEach(function(el) {
    observer.observe(el);
  });

  ${scrollBlocks.length > 0 ? `
  // Scroll effects
  var scrollEls = document.querySelectorAll('[data-wb-scroll]');
  function onScroll() {
    var wh = window.innerHeight;
    scrollEls.forEach(function(el) {
      var rect = el.getBoundingClientRect();
      var progress = Math.max(0, Math.min(1, (wh - rect.top) / (wh + rect.height)));
      var effect = el.getAttribute('data-wb-scroll');
      if (effect === 'fade') {
        el.style.opacity = progress;
      } else if (effect === 'scale') {
        var s = 0.8 + (progress * 0.2);
        el.style.transform = 'scale(' + s + ')';
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  ` : ''}
})();
</script>`;
}

// --- Utility: Get data attributes for a block ---

export function getBlockAnimationAttrs(block: WebsiteBlock): Record<string, string> {
  const attrs: Record<string, string> = {};

  if (block.animation.entrance && block.animation.entrance !== "none") {
    attrs["data-wb-animate"] = block.animation.entrance;
  }

  if (block.animation.scroll && block.animation.scroll !== "none" && block.animation.scroll !== "parallax") {
    attrs["data-wb-scroll"] = block.animation.scroll;
  }

  return attrs;
}
