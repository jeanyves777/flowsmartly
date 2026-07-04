import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

interface IncomingLead {
  placeId?: string;
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  types?: string[];
  googleMapsUrl?: string;
  category?: string;
}

const str = (v: unknown, max = 500): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

// POST /api/leads/saved — save selected leads into a list (new or existing).
// body: { listId?, listName?, category?, leads: BusinessLead[] }
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const body = await request.json();
    const leads: IncomingLead[] = Array.isArray(body.leads) ? body.leads : [];
    if (leads.length === 0) return NextResponse.json({ success: false, error: { message: "No leads selected" } }, { status: 400 });

    const category = str(body.category, 80);

    // Resolve or create the target list.
    let listId: string;
    if (body.listId) {
      const list = await prisma.savedLeadList.findFirst({ where: { id: body.listId, userId: session.userId }, select: { id: true } });
      if (!list) return NextResponse.json({ success: false, error: { message: "List not found" } }, { status: 404 });
      listId = list.id;
    } else {
      const name = str(body.listName, 120) || `Leads — ${new Date().toLocaleDateString()}`;
      const created = await prisma.savedLeadList.create({ data: { userId: session.userId, name, category } });
      listId = created.id;
    }

    let saved = 0;
    let skipped = 0;
    for (const lead of leads) {
      const name = str(lead.name, 200);
      if (!name) { skipped++; continue; }
      // Dedupe by placeId (or name) within this list.
      const dupe = await prisma.savedLead.findFirst({
        where: { userId: session.userId, listId, ...(lead.placeId ? { placeId: lead.placeId } : { name }) },
        select: { id: true },
      });
      if (dupe) { skipped++; continue; }
      await prisma.savedLead.create({
        data: {
          userId: session.userId,
          listId,
          placeId: str(lead.placeId, 200),
          name,
          address: str(lead.address),
          phone: str(lead.phone, 60),
          website: str(lead.website, 400),
          rating: typeof lead.rating === "number" ? lead.rating : null,
          reviewCount: typeof lead.reviewCount === "number" ? Math.floor(lead.reviewCount) : null,
          businessStatus: str(lead.businessStatus, 60),
          category: category || str(lead.category, 80),
          types: JSON.stringify(Array.isArray(lead.types) ? lead.types.filter((t) => typeof t === "string").slice(0, 12) : []),
          googleMapsUrl: str(lead.googleMapsUrl, 600),
        },
      });
      saved++;
    }

    const leadCount = await prisma.savedLead.count({ where: { listId } });
    await prisma.savedLeadList.update({ where: { id: listId }, data: { leadCount } });

    return NextResponse.json({ success: true, data: { listId, saved, skipped, leadCount } });
  } catch (error) {
    console.error("Save leads error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to save leads" } }, { status: 500 });
  }
}
