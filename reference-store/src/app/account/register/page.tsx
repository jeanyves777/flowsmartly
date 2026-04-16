"use client";
import { useEffect } from "react";

export default function RegisterRedirect() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("toggle-account"));
    window.history.back();
  }, []);
  return null;
}
