"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ListSmartlyEntryPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkProfile() {
      try {
        const res = await fetch("/api/listsmartly/profile");
        if (res.ok) {
          router.replace("/listsmartly/dashboard");
        } else {
          router.replace("/listsmartly/onboarding");
        }
      } catch {
        router.replace("/listsmartly/onboarding");
      }
    }
    checkProfile();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
