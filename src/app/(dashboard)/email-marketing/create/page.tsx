"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { CampaignWizard } from "@/components/email-marketing/campaign-wizard";

function CreateEmailContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  return (
    <div className="flex-1 flex flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/email-marketing"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-brand-500" />
          <h1 className="text-lg font-bold">{editId ? "Edit Campaign" : "Create Email Campaign"}</h1>
        </div>
      </div>

      {/* Wizard */}
      <CampaignWizard editCampaignId={editId} />
    </div>
  );
}

export default function CreateEmailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>}>
      <CreateEmailContent />
    </Suspense>
  );
}
