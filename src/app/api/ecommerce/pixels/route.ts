import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { z } from "zod";

const pixelSchema = z.object({
  facebookPixelId: z.string().max(50).optional().default(""),
  googleTagId: z.string().max(50).optional().default(""),
  tiktokPixelId: z.string().max(50).optional().default(""),
  pinterestTagId: z.string().max(50).optional().default(""),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await prisma.store.findFirst({
      where: { userId: session.userId },
      select: { settings: true },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const settings = JSON.parse(store.settings || "{}");
    return NextResponse.json({ pixels: settings.pixels || {} });
  } catch (error) {
    console.error("Failed to get pixel settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const pixels = pixelSchema.parse(body);

    const store = await prisma.store.findFirst({
      where: { userId: session.userId },
      select: { id: true, settings: true },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Merge pixels into existing settings
    const settings = JSON.parse(store.settings || "{}");
    settings.pixels = {
      facebookPixelId: pixels.facebookPixelId || undefined,
      googleTagId: pixels.googleTagId || undefined,
      tiktokPixelId: pixels.tiktokPixelId || undefined,
      pinterestTagId: pixels.pinterestTagId || undefined,
    };

    // Remove empty values
    Object.keys(settings.pixels).forEach((key) => {
      if (!settings.pixels[key]) delete settings.pixels[key];
    });

    await prisma.store.update({
      where: { id: store.id },
      data: { settings: JSON.stringify(settings) },
    });

    return NextResponse.json({ pixels: settings.pixels });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid pixel data", details: error.errors }, { status: 400 });
    }
    console.error("Failed to update pixel settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
