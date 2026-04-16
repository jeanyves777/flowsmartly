"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AccountRedirect() {
  const router = useRouter();
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("toggle-account"));
    router.replace("/");
  }, [router]);
  return null;
}
