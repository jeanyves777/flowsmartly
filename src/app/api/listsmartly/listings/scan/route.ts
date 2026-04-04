import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { runConsistencyCheck, refreshProfileStats, initializeListings, detectExistingPresence } from "@/lib/listsmartly/sync-engine";
import { seedDirectories } from "@/lib/listsmartly/directories";
import { calculateCitationScore } from "@/lib/listsmartly/citation-scorer";

// POST /api/listsmartly/listings/scan - Trigger a full consistency scan
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    // Ensure directories are seeded
    const dirCount = await prisma.listingDirectory.count();
    if (dirCount === 0) {
      await seedDirectories();
    }

    // Ensure listings are initialized
    const listingCount = await prisma.businessListing.count({ where: { profileId: profile.id } });
    if (listingCount === 0) {
      await initializeListings(profile.id, profile.industry || undefined);
    }

    // Create sync job record BEFORE scan starts
    const job = await prisma.listingSyncJob.create({
      data: {
        profileId: profile.id,
        type: "full_scan",
        status: "running",
        startedAt: new Date(),
      },
    });

    // Run real web presence detection (Google Places API + website crawl)
    const detection = await detectExistingPresence(profile.id);

    // Run consistency check on found listings
    const scanResult = await runConsistencyCheck(profile.id);

    // Refresh profile stats
    await refreshProfileStats(profile.id);

    // Recalculate citation score
    const listings = await prisma.businessListing.findMany({
      where: { profileId: profile.id },
      include: { directory: { select: { tier: true, name: true, slug: true } } },
    });

    const reviews = await prisma.listingReview.findMany({
      where: { profileId: profile.id },
      select: { rating: true, responseStatus: true },
    });

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;
    const respondedReviews = reviews.filter((r) => r.responseStatus === "posted").length;
    const responseRate = totalReviews > 0 ? respondedReviews / totalReviews : 0;

    const scoreResult = calculateCitationScore({
      listings: listings.map((l) => ({
        status: l.status,
        isConsistent: l.isConsistent,
        tier: l.directory.tier,
      })),
      totalReviews,
      averageRating,
      responseRate,
    });

    // Update profile with new citation score
    await prisma.listSmartlyProfile.update({
      where: { id: profile.id },
      data: {
        citationScore: scoreResult.citationScore,
        totalReviews,
        averageRating,
      },
    });

    // Build full scan report with every finding
    const findings = listings.map((l) => ({
      directorySlug: l.directory.slug,
      directoryName: l.directory.name,
      tier: l.directory.tier,
      status: l.status,
      listingUrl: l.listingUrl,
      isConsistent: l.isConsistent,
    }));

    const liveCount = findings.filter((f) => ["live", "submitted", "claimed"].includes(f.status)).length;
    const missingCount = findings.filter((f) => f.status === "missing").length;
    const inconsistentCount = findings.filter((f) => !f.isConsistent && f.status === "live").length;

    // Save complete scan report to ListingSyncJob
    await prisma.listingSyncJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        totalDirectories: listings.length,
        checkedCount: listings.length,
        fixedCount: detection.detected,
        errorCount: 0,
        completedAt: new Date(),
        details: JSON.stringify({
          findings,
          scores: {
            citationScore: scoreResult.citationScore,
            coverageScore: scoreResult.coverageScore,
            consistencyScore: scoreResult.consistencyScore,
            reviewScore: scoreResult.reviewScore,
          },
          summary: {
            total: listings.length,
            live: liveCount,
            missing: missingCount,
            inconsistent: inconsistentCount,
            detected: detection.detected,
            averageRating,
            totalReviews,
          },
          scannedAt: new Date().toISOString(),
          businessName: profile.businessName,
          industry: profile.industry,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        scan: scanResult,
        detected: detection.detected,
        scores: {
          citationScore: scoreResult.citationScore,
          coverageScore: scoreResult.coverageScore,
          consistencyScore: scoreResult.consistencyScore,
          reviewScore: scoreResult.reviewScore,
          breakdown: scoreResult.breakdown,
        },
        summary: {
          total: listings.length,
          live: liveCount,
          missing: missingCount,
          inconsistent: inconsistentCount,
        },
      },
    });
  } catch (error) {
    console.error("Scan listings error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to run consistency scan" } },
      { status: 500 }
    );
  }
}
