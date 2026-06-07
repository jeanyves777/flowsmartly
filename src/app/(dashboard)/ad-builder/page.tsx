"use client";

import { AdBuilderCanvas } from "@/components/ad-builder/ad-builder-canvas";

export default function AdBuilderPage() {
  return (
    <div className="fixed inset-0 z-40">
      <AdBuilderCanvas />
    </div>
  );
}
