"use client";

import { useState } from "react";
import Image from "next/image";

interface GalleryImage {
  url: string;
  alt?: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  productName: string;
  imageRadius?: string;
}

export function ImageGallery({
  images,
  productName,
  imageRadius = "rounded-xl",
}: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div
        className={`aspect-square bg-gray-100 flex items-center justify-center ${imageRadius}`}
      >
        <svg
          className="w-20 h-20 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  const current = images[selectedIndex] || images[0];

  return (
    <div>
      {/* Main Image */}
      <div
        className={`aspect-square overflow-hidden bg-gray-100 mb-3 ${imageRadius}`}
      >
        <Image
          src={current.url}
          alt={current.alt || productName}
          width={800}
          height={800}
          className="w-full h-full object-cover"
          priority
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`aspect-square overflow-hidden bg-gray-100 rounded-lg transition-all ${
                idx === selectedIndex
                  ? "ring-2 ring-offset-1"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={
                idx === selectedIndex
                  ? { "--tw-ring-color": "var(--store-primary, #111)" } as React.CSSProperties
                  : undefined
              }
            >
              <Image
                src={img.url}
                alt={img.alt || `${productName} - Image ${idx + 1}`}
                width={120}
                height={120}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
