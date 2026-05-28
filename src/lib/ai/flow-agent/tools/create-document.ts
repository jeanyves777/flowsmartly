import { prisma } from "@/lib/db/client";
import { uploadToS3, getPresignedUrl } from "@/lib/utils/s3-client";
import { generateBrandedDocumentPDF, type BrandedDocSection } from "@/lib/documents/branded-pdf";
import { saveToMediaLibrary } from "../save-media";
import type { FlowAgentTool } from "../registry";
import { nanoid } from "nanoid";

/**
 * create_document — turn content the agent has ALREADY written into a real,
 * downloadable, brand-styled PDF (contracts, letters, plans, briefs,
 * agreements — any bespoke document with no dedicated flow).
 *
 * Division of labor: the agent writes the actual content in its turn (using
 * the brand voice + the user's details, after asking any clarifying
 * questions); this tool only LAYS IT OUT with the brand header/colors/logo
 * and produces the file. Reuses the existing `jspdf` renderer — no new
 * generation engine.
 *
 * Free (no AI call here — the writing happened in the loop), but mutating
 * because it produces a persistent artifact, so it goes through propose_plan.
 */
export const createDocument: FlowAgentTool = {
  name: "create_document",
  description:
    "Produce a real, downloadable, brand-styled PDF from content YOU have already written. Use this for bespoke one-off documents that have no dedicated flow — contracts, agreements, letters, briefs, plans, checklists, etc. First gather the user's requirements and write the full content yourself in the brand's voice (ask clarifying questions if needed), THEN call this with the finished title + sections to get the PDF. Each section is { heading, body }; body may contain \\n\\n paragraph breaks. Returns a download link and saves it to the user's media. Free, but pass `planId` from a confirmed propose_plan (it creates a file). Do NOT use this for proposals/pitches (use create_proposal/create_pitch) or images (use create_branded_design).",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      title: { type: "string", description: "Document title shown at the top. Required." },
      subtitle: { type: "string", description: "Optional one-line subtitle / 'Prepared for …' line." },
      sections: {
        type: "array",
        description: "The document body, in order. Each: { heading?, body }. Write real, finished content — not placeholders. Use \\n\\n in body for paragraph breaks.",
        items: {
          type: "object",
          properties: {
            heading: { type: "string", description: "Optional section heading." },
            body: { type: "string", description: "Section text. Required." },
          },
          required: ["body"],
        },
      },
      filename: { type: "string", description: "Optional file name (without extension). Defaults to a slug of the title." },
    },
    required: ["planId", "title", "sections"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // free — content was written in the loop
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const title = typeof input.title === "string" ? input.title.trim() : "";
      if (!title) {
        return { ok: false, error_code: "missing_input", message: "title is required." };
      }
      const sections: BrandedDocSection[] = Array.isArray(input.sections)
        ? input.sections
            .map((s) => {
              const o = s as Record<string, unknown>;
              return {
                heading: typeof o.heading === "string" ? o.heading.trim() : undefined,
                body: typeof o.body === "string" ? o.body.trim() : "",
              };
            })
            .filter((s) => s.body.length > 0)
        : [];
      if (sections.length === 0) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "sections is empty — write the document content first, then call create_document with it.",
        };
      }

      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { name: true, colors: true, logo: true, iconLogo: true, email: true, phone: true, website: true },
      });

      const colors = parseJson<Record<string, string>>(brandKit?.colors, {});
      const logoSource = brandKit?.logo || brandKit?.iconLogo || null;
      const logo = logoSource ? await loadLogoDataUri(logoSource) : null;

      const contactLine = [brandKit?.email, brandKit?.phone, brandKit?.website]
        .filter((v): v is string => !!v && v.trim().length > 0)
        .join("  ·  ");

      const pdf = await generateBrandedDocumentPDF({
        title,
        subtitle: typeof input.subtitle === "string" ? input.subtitle.trim() : undefined,
        sections,
        brand: {
          name: brandKit?.name || "Document",
          primaryColor: colors.primary,
          accentColor: colors.accent || colors.secondary,
          logo: logo?.dataUri,
          logoAspectRatio: logo?.aspect,
          contactLine: contactLine || undefined,
        },
      });

      const slug = (typeof input.filename === "string" && input.filename.trim() ? input.filename : title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "document";
      const key = `flow-ai/${ctx.userId}/doc-${slug}-${nanoid(6)}.pdf`;
      const url = await uploadToS3(key, pdf, "application/pdf");

      await saveToMediaLibrary({
        userId: ctx.userId,
        url,
        type: "document",
        mimeType: "application/pdf",
        size: pdf.length,
        originalName: `${slug}.pdf`,
        tags: ["flow-ai", "document"],
        metadata: { title },
      });

      return {
        ok: true,
        data: {
          url,
          link: url,
          filename: `${slug}.pdf`,
          userMessage: `Created the PDF "${title}". Give the user the download link and mention it's saved in their media library.`,
        },
        resultRefType: "Document",
        resultRefId: key,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to create document" };
    }
  },
};

async function loadLogoDataUri(source: string): Promise<{ dataUri: string; aspect: number } | null> {
  try {
    const sharp = (await import("sharp")).default;
    let fetchUrl = source;
    const storageUrl = process.env.NEXT_PUBLIC_STORAGE_URL || "";
    const looksManaged =
      source.includes(".amazonaws.com/") || (storageUrl !== "" && source.startsWith(storageUrl)) || !source.startsWith("http");
    if (!source.startsWith("data:")) {
      fetchUrl = looksManaged ? await getPresignedUrl(source) : source;
    }
    let buf: Buffer;
    if (source.startsWith("data:")) {
      buf = Buffer.from(source.replace(/^data:[^;]+;base64,/, ""), "base64");
    } else {
      const res = await fetch(fetchUrl);
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    }
    const png = await sharp(buf).png().toBuffer();
    const meta = await sharp(png).metadata();
    const aspect = (meta.width || 3) / (meta.height || 1);
    return { dataUri: `data:image/png;base64,${png.toString("base64")}`, aspect };
  } catch {
    return null;
  }
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
