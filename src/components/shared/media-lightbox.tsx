"use client";

import { Download, X } from "lucide-react";

/**
 * Build a same-origin download URL for a generated asset. A cross-origin
 * `<a download>` to S3 just opens the file in a new tab (browsers ignore the
 * download attribute cross-origin); this routes through our proxy which
 * streams it back with Content-Disposition: attachment so it actually saves.
 */
export function mediaDownloadHref(url: string, name = "flowsmartly-design"): string {
  return `/api/flow-ai/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
}

/**
 * Full-screen image lightbox. Shared anywhere a generated image should be
 * clickable to view large (agent cards, the Video Director cast sheet, …).
 * Clicking the backdrop or the X closes it; download stays available.
 */
export function MediaLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Full size"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
      />
      <a
        href={mediaDownloadHref(url)}
        download
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-5 left-1/2 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm text-white hover:bg-white/20"
      >
        <Download className="h-4 w-4" /> Download
      </a>
    </div>
  );
}
