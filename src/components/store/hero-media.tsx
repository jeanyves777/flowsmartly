"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface HeroSlideshowProps {
  imageUrls: string[];
  headline?: string;
  heightClasses: string;
}

export function HeroSlideshow({ imageUrls, headline, heightClasses }: HeroSlideshowProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (imageUrls.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % imageUrls.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [imageUrls.length]);

  return (
    <div className={`${heightClasses} w-full relative overflow-hidden`}>
      {imageUrls.map((url, i) => (
        <Image
          key={url}
          src={url}
          alt={headline || `Hero ${i + 1}`}
          fill
          className={`object-cover transition-opacity duration-1000 ${i === currentImageIndex ? "opacity-100" : "opacity-0"}`}
          priority={i === 0}
        />
      ))}
      <div className="absolute inset-0 bg-black/40" />
      {/* Slideshow dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {imageUrls.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentImageIndex(i)}
            className={`w-2 h-2 rounded-full transition-colors ${i === currentImageIndex ? "bg-white" : "bg-white/40"}`}
          />
        ))}
      </div>
    </div>
  );
}

interface HeroVideoProps {
  videoUrl: string;
  heightClasses: string;
}

export function HeroVideo({ videoUrl, heightClasses }: HeroVideoProps) {
  return (
    <div className={`${heightClasses} w-full relative overflow-hidden`}>
      <video
        src={videoUrl}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}
