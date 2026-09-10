"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

/**
 * Grey mode is hidden for now (Light / Dark only). next-themes applies whatever
 * string it finds in storage, so an existing "grey" preference would keep the
 * .grey class on <html> even though nothing offers it any more — rewrite it to
 * "dark" at module scope, which runs before the provider reads localStorage.
 */
if (typeof window !== "undefined") {
  try {
    if (window.localStorage.getItem("theme") === "grey") {
      window.localStorage.setItem("theme", "dark");
    }
  } catch {
    /* storage blocked — next-themes falls back to defaultTheme */
  }
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
