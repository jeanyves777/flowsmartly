"use client";

import { useEffect } from "react";
import { storeAccountPage } from "@/lib/api-client";

export default function AccountSectionRedirectPage() {
  useEffect(() => {
    const section = window.location.pathname.split("/account/")[1] || "";
    const cleanSection = section.replace(/^\/+|\/+$/g, "");
    window.location.replace(storeAccountPage(cleanSection ? `/${cleanSection}` : ""));
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
    </main>
  );
}
