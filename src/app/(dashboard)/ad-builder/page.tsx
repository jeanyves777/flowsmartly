"use client";

import { Suspense } from "react";
import { AdBuilderCanvas } from "@/components/ad-builder/ad-builder-canvas";

export default function AdBuilderPage() {
  return (
    <div className="fixed inset-0 z-40">
      <Suspense fallback={null}>
        <AdBuilderCanvas />
      </Suspense>
    </div>
  );
}
