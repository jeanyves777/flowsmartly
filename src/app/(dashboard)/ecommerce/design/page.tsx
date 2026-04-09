"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/shared/page-loader";

// V1 design page is retired — all stores use the V2 editor now
export default function EcommerceDesignPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ecommerce/design/v2");
  }, [router]);

  return <PageLoader />;
}
