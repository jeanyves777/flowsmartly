"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Loader2,
  Eye,
  Pencil,
  Files,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  stripViewportFromJSON,
} from "@/components/studio/utils/canvas-helpers";
import { loadGoogleFont } from "@/components/studio/utils/font-loader";

// ─── Types ─────────────────────────────────────────────────────────

interface DesignData {
  id: string;
  name: string;
  size: string;
  imageUrl: string | null;
  canvasData: string | null;
}

interface ShareData {
  design: DesignData;
  permission: "VIEW" | "EDIT" | "COPY";
  shareId: string;
  userRole?: string;
}

interface PageInfo {
  canvasJSON: string;
  width: number;
  height: number;
}

const PERMISSION_CONFIG: Record<
  string,
  { label: string; icon: typeof Eye; variant: "secondary" | "default" | "outline" }
> = {
  VIEW: { label: "View Only", icon: Eye, variant: "secondary" },
  EDIT: { label: "Can Edit", icon: Pencil, variant: "default" },
  COPY: { label: "Get a Copy", icon: Files, variant: "outline" },
};

// ─── Canvas Viewer (no SSR) ────────────────────────────────────────

interface CanvasViewerProps {
  pages: PageInfo[];
  activePageIndex: number;
}

function CanvasViewerInner({ pages, activePageIndex }: CanvasViewerProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricCanvasRef = useRef<any>(null);
  const [zoom, setZoom] = useState(1);

  // Initialize Fabric.js canvas once
  useEffect(() => {
    if (!canvasElRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fc: any = null;

    (async () => {
      const fabric = await import("fabric");

      const page = pages[activePageIndex];
      if (!page) return;

      fc = new fabric.Canvas(canvasElRef.current!, {
        width: page.width,
        height: page.height,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
        selection: false,
        interactive: false,
      });

      fabricCanvasRef.current = fc;

      // Load canvas content
      await loadPage(fc, page);

      // Make all objects non-interactive
      lockCanvas(fc);

      // Zoom to fit
      fitToContainer(fc, page.width, page.height);
    })();

    return () => {
      if (fc) {
        fc.dispose();
        fabricCanvasRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch pages when activePageIndex changes (after initial mount)
  const prevPageRef = useRef(activePageIndex);
  useEffect(() => {
    if (prevPageRef.current === activePageIndex) return;
    prevPageRef.current = activePageIndex;

    const fc = fabricCanvasRef.current;
    if (!fc) return;

    const page = pages[activePageIndex];
    if (!page) return;

    (async () => {
      fc.setDimensions({ width: page.width, height: page.height });
      await loadPage(fc, page);
      lockCanvas(fc);
      fitToContainer(fc, page.width, page.height);
    })();
  }, [activePageIndex, pages]);

  // Recalculate zoom on window resize
  useEffect(() => {
    const handleResize = () => {
      const fc = fabricCanvasRef.current;
      if (!fc) return;
      const page = pages[activePageIndex];
      if (!page) return;
      fitToContainer(fc, page.width, page.height);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [pages, activePageIndex]);

  // ─── Helpers ──────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function loadPage(fc: any, page: PageInfo) {
    const cleanJSON = stripViewportFromJSON(page.canvasJSON);
    await fc.loadFromJSON(cleanJSON);
    fc.setViewportTransform([1, 0, 0, 1, 0, 0]);

    // Load fonts used in text objects
    const objects = fc.getObjects();
    const fontFamilies = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const obj of objects) {
      if (obj.fontFamily && obj.fontFamily !== "Times New Roman") {
        fontFamilies.add(obj.fontFamily);
      }
    }
    if (fontFamilies.size > 0) {
      await Promise.all(
        Array.from(fontFamilies).map((font) => loadGoogleFont(font))
      );
    }

    fc.renderAll();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function lockCanvas(fc: any) {
    const objects = fc.getObjects();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const obj of objects) {
      obj.set({
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
      });
    }
    fc.selection = false;
    fc.interactive = false;
    fc.defaultCursor = "default";
    fc.hoverCursor = "default";
    fc.renderAll();
  }

  function fitToContainer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fc: any,
    canvasW: number,
    canvasH: number
  ) {
    if (!containerRef.current) return;
    const availW = containerRef.current.clientWidth - 64;
    const availH = containerRef.current.clientHeight - 64;
    if (availW <= 0 || availH <= 0) return;

    const fitZoom = Math.min(availW / canvasW, availH / canvasH, 1);
    setZoom(Math.max(0.1, fitZoom));
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 flex items-center justify-center"
      style={{ minHeight: 0 }}
    >
      <div
        className="relative shadow-2xl ring-1 ring-gray-300 dark:ring-gray-600"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        {/* Checkerboard for transparency */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
              linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
              linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        />
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}

// Dynamic import wrapper — Fabric.js needs DOM
const CanvasViewer = dynamic(() => Promise.resolve(CanvasViewerInner), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        <p className="text-sm text-muted-foreground">Loading canvas...</p>
      </div>
    </div>
  ),
});

// ─── Main Page Component ───────────────────────────────────────────

export default function SharedDesignPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [state, setState] = useState<"loading" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isCopying, setIsCopying] = useState(false);

  // Fetch share data on mount
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(`/api/designs/share/${token}`);
        const data = await res.json();

        if (!data.success) {
          setErrorMessage(data.error?.message || "Invalid or expired share link");
          setState("error");
          return;
        }

        const share = data.data as ShareData;
        setShareData(share);

        // Parse canvasData into pages
        const parsedPages = parseCanvasData(share.design);
        setPages(parsedPages);
        setState("success");
      } catch {
        setErrorMessage("Failed to load shared design. Please try again later.");
        setState("error");
      }
    })();
  }, [token]);

  // Parse canvasData into page array (handles single-page and multi-page)
  function parseCanvasData(design: DesignData): PageInfo[] {
    if (!design.canvasData) {
      return [
        {
          canvasJSON: JSON.stringify({ version: "6.0.0", objects: [], background: "#ffffff" }),
          width: 1080,
          height: 1080,
        },
      ];
    }

    // Parse dimensions from size string
    let defaultW = 1080;
    let defaultH = 1080;
    if (design.size) {
      const [w, h] = design.size.split("x").map(Number);
      if (w && h) {
        defaultW = w;
        defaultH = h;
      }
    }

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed =
        typeof design.canvasData === "string"
          ? JSON.parse(design.canvasData)
          : design.canvasData;
    } catch {
      parsed = null;
    }

    if (!parsed) {
      return [
        {
          canvasJSON: design.canvasData,
          width: defaultW,
          height: defaultH,
        },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((parsed as any)._multiPage === true) {
      // Multi-page design
      const multiPageData = parsed as {
        pages: Array<{
          id: string;
          canvasJSON: string | object;
          width: number;
          height: number;
        }>;
        activePageIndex: number;
      };

      return multiPageData.pages.map((p) => ({
        canvasJSON:
          typeof p.canvasJSON === "string"
            ? p.canvasJSON
            : JSON.stringify(p.canvasJSON),
        width: p.width || defaultW,
        height: p.height || defaultH,
      }));
    }

    // Single-page design
    return [
      {
        canvasJSON:
          typeof design.canvasData === "string"
            ? design.canvasData
            : JSON.stringify(design.canvasData),
        width: defaultW,
        height: defaultH,
      },
    ];
  }

  // ─── Action Handlers ──────────────────────────────────────────────

  const handleOpenInEditor = useCallback(() => {
    if (!shareData) return;
    const studioUrl = `/studio?id=${shareData.design.id}&share=${token}`;
    // Redirect to login if not authenticated (we check via userRole presence)
    if (!shareData.userRole) {
      router.push(`/login?redirect=${encodeURIComponent(`/design/${token}`)}`);
      return;
    }
    router.push(studioUrl);
  }, [shareData, token, router]);

  const handleGetCopy = useCallback(async () => {
    if (!shareData || isCopying) return;

    // Redirect to login if not authenticated
    if (!shareData.userRole) {
      router.push(`/login?redirect=${encodeURIComponent(`/design/${token}`)}`);
      return;
    }

    setIsCopying(true);
    try {
      const design = shareData.design;
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${design.name} (Copy)`,
          category: "social_post",
          size: design.size || "1080x1080",
          canvasData: design.canvasData,
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.design?.id) {
        router.push(`/studio?id=${data.data.design.id}`);
      } else {
        // If unauthorized, redirect to login
        if (res.status === 401) {
          router.push(`/login?redirect=${encodeURIComponent(`/design/${token}`)}`);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsCopying(false);
    }
  }, [shareData, isCopying, token, router]);

  // ─── Render: Loading State ────────────────────────────────────────

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm text-muted-foreground">Loading shared design...</p>
        </div>
      </div>
    );
  }

  // ─── Render: Error State ──────────────────────────────────────────

  if (state === "error") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-1">Unable to load design</h2>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </div>
          <Button variant="outline" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render: Success State ────────────────────────────────────────

  if (!shareData) return null;

  const { design, permission } = shareData;
  const permConfig = PERMISSION_CONFIG[permission] || PERMISSION_CONFIG.VIEW;
  const PermIcon = permConfig.icon;
  const isMultiPage = pages.length > 1;

  return (
    <div className="flex flex-col h-[calc(100vh-128px)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-semibold truncate">{design.name}</h1>
          <Badge variant={permConfig.variant} className="gap-1 shrink-0 text-xs">
            <PermIcon className="w-3 h-3" />
            {permConfig.label}
          </Badge>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {permission === "VIEW" && (
            <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          )}

          {permission === "EDIT" && (
            <Button size="sm" onClick={handleOpenInEditor} className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Editor
            </Button>
          )}

          {permission === "COPY" && (
            <Button
              size="sm"
              onClick={handleGetCopy}
              disabled={isCopying}
              className="gap-1.5"
            >
              {isCopying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Get a Copy
            </Button>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <CanvasViewer pages={pages} activePageIndex={activePageIndex} />

      {/* Page Navigation (multi-page only) */}
      {isMultiPage && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-t bg-background/95 backdrop-blur-sm">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={activePageIndex === 0}
            onClick={() => setActivePageIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums min-w-[80px] text-center">
            Page {activePageIndex + 1} of {pages.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={activePageIndex === pages.length - 1}
            onClick={() =>
              setActivePageIndex((i) => Math.min(pages.length - 1, i + 1))
            }
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
