"use client";
import { useEffect } from "react";

export default function LoginRedirect() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("toggle-account"));
    window.history.back();
  }, []);
  return null;
}
