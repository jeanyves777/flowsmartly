"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export function DarkModeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("wb-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  const toggle = () => {
    const newDark = !dark;
    setDark(newDark);
    document.documentElement.setAttribute("data-theme", newDark ? "dark" : "light");
    localStorage.setItem("wb-theme", newDark ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-[var(--wb-surface)] border border-[var(--wb-border)] shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      aria-label="Toggle dark mode"
    >
      {dark ? <Sun className="w-5 h-5 text-[var(--wb-accent)]" /> : <Moon className="w-5 h-5 text-[var(--wb-text-muted)]" />}
    </button>
  );
}
