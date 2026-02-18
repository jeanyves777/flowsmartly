import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/users/profile - Get current user's profile
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        avatarUrl: true,
        bio: true,
        website: true,
        links: true,
        plan: true,
        aiCredits: true,
        balanceCents: true,
        timezone: true,
        language: true,
        theme: true,
        notificationPrefs: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "User not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          website: user.website,
          links: JSON.parse(user.links || "{}"),
          plan: user.plan,
          aiCredits: user.aiCredits,
          balance: user.balanceCents / 100,
          timezone: user.timezone,
          language: user.language,
          theme: user.theme,
          notificationPrefs: JSON.parse(user.notificationPrefs || "{}"),
          emailVerified: user.emailVerified,
          postsCount: user._count.posts,
          followersCount: user._count.followers,
          followingCount: user._count.following,
          createdAt: user.createdAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch profile" } },
      { status: 500 }
    );
  }
}

// PATCH /api/users/profile - Update current user's profile
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      username,
      bio,
      website,
      links,
      avatarUrl,
      timezone,
      language,
      theme,
      notificationPrefs,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (website !== undefined) updateData.website = website;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (language !== undefined) updateData.language = language;
    if (theme !== undefined) updateData.theme = theme;
    if (notificationPrefs !== undefined) {
      updateData.notificationPrefs = JSON.stringify(notificationPrefs);
    }
    if (links !== undefined) {
      updateData.links = JSON.stringify(links);
    }

    // Check username uniqueness (exclude current user by ID)
    if (username !== undefined) {
      const existingUser = await prisma.user.findFirst({
        where: { username, id: { not: session.userId } },
      });
      if (existingUser) {
        return NextResponse.json(
          { success: false, error: { message: "Username already taken" } },
          { status: 400 }
        );
      }
      updateData.username = username;
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        website: true,
        links: true,
        avatarUrl: true,
        timezone: true,
        language: true,
        theme: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        user: {
          ...updatedUser,
          links: JSON.parse(updatedUser.links || "{}"),
          postsCount: updatedUser._count.posts,
          followersCount: updatedUser._count.followers,
          followingCount: updatedUser._count.following,
        },
      }),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update profile" } },
      { status: 500 }
    );
  }
}
