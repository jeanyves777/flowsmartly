"use client";
import { useEffect } from "react";

export default function AccountPage() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("toggle-account"));
    window.history.back();
  }, []);
  return null;
}
