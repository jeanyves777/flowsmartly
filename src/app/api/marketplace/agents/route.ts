import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const specialty = searchParams.get("specialty");
    const industry = searchParams.get("industry");
    const sort = searchParams.get("sort") || "rating";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 12;
    const skip = (page - 1) * limit;

    // Get all approved agents with user info
    const agents = await prisma.agentProfile.findMany({
      where: { status: "APPROVED" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        _count: {
          select: { clients: { where: { status: "ACTIVE" } } },
        },
      },
      orderBy:
        sort === "price_low"
          ? { minPricePerMonth: "asc" }
          : sort === "price_high"
          ? { minPricePerMonth: "desc" }
          : sort === "clients"
          ? { clientCount: "desc" }
          : sort === "newest"
          ? { approvedAt: "desc" }
          : { performanceScore: "desc" },
    });

    // Filter in-memory for JSON fields and search
    let filtered = agents;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.displayName.toLowerCase().includes(q) ||
          a.bio?.toLowerCase().includes(q) ||
          a.user.name.toLowerCase().includes(q)
      );
    }

    if (specialty) {
      filtered = filtered.filter((a) => {
        const specs: string[] = JSON.parse(a.specialties);
        return specs.some((s) => s.toLowerCase() === specialty.toLowerCase());
      });
    }

    if (industry) {
      filtered = filtered.filter((a) => {
        const inds: string[] = JSON.parse(a.industries);
        return inds.some((i) => i.toLowerCase() === industry.toLowerCase());
      });
    }

    // Exclude self
    filtered = filtered.filter((a) => a.userId !== session.userId);

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    // Check which agents the current user already has a relationship with (exclude terminated so they can re-hire)
    const existingRelationships = await prisma.agentClient.findMany({
      where: {
        clientUserId: session.userId,
        agentProfileId: { in: paginated.map((a) => a.id) },
        status: { in: ["ACTIVE", "PAUSED", "PENDING"] },
      },
      select: { agentProfileId: true, status: true },
    });

    const relationshipMap = new Map(
      existingRelationships.map((r) => [r.agentProfileId, r.status])
    );

    const result = paginated.map((agent) => ({
      id: agent.id,
      displayName: agent.displayName,
      bio: agent.bio,
      specialties: JSON.parse(agent.specialties),
      industries: JSON.parse(agent.industries),
      portfolioUrls: JSON.parse(agent.portfolioUrls),
      minPricePerMonth: agent.minPricePerMonth,
      performanceScore: agent.performanceScore,
      clientCount: agent._count.clients,
      approvedAt: agent.approvedAt,
      user: agent.user,
      relationship: relationshipMap.get(agent.id) || null,
    }));

    // Collect unique specialties and industries for filters
    const allSpecialties = new Set<string>();
    const allIndustries = new Set<string>();
    agents.forEach((a) => {
      JSON.parse(a.specialties).forEach((s: string) => allSpecialties.add(s));
      JSON.parse(a.industries).forEach((i: string) => allIndustries.add(i));
    });

    return NextResponse.json({
      success: true,
      data: {
        agents: result,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        filters: {
          specialties: Array.from(allSpecialties).sort(),
          industries: Array.from(allIndustries).sort(),
        },
      },
    });
  } catch (error) {
    console.error("Browse agents error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
