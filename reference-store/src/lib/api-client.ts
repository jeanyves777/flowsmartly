"use client";

export function getStoreBasePath(): string {
  if (typeof window === "undefined") return "";
  const match = window.location.pathname.match(/^\/stores\/[^/]+/);
  return match ? match[0] : "";
}

export function storeApi(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getStoreBasePath()}/api${normalized}`;
}

export function storePage(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getStoreBasePath()}${normalized}`;
}
