import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Find FollowUp by shareSlug
    const followUp = await prisma.followUp.findFirst({
      where: {
        shareSlug: slug,
        shareEnabled: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!followUp) {
      return NextResponse.json(
        { error: "Follow-up not found or not shared" },
        { status: 404 }
      );
    }

    // Find owner's first team
    const teamMembership = await prisma.teamMember.findFirst({
      where: {
        userId: followUp.userId,
        role: "OWNER",
      },
      include: {
        team: {
          select: {
            id: true,
          },
        },
      },
    });

    const teamId = teamMembership?.team.id;

    // Basic info (always returned)
    const response: any = {
      id: followUp.id,
      name: followUp.name,
      description: followUp.description,
      ownerName: followUp.user.name,
      teamId,
      hasAccess: false,
      isOwner: false,
    };

    // Check auth status
    try {
      const session = await getSession();

      if (session?.userId) {
        // User is logged in
        if (session.userId === followUp.userId) {
          // User is the owner
          response.hasAccess = true;
          response.isOwner = true;
        } else {
          // Check if user is a team member of any team owned by follow-up owner
          const isTeamMember = await prisma.teamMember.findFirst({
            where: {
              userId: session.userId,
              team: {
                members: {
                  some: {
                    userId: followUp.userId,
                    role: "OWNER",
                  },
                },
              },
            },
          });

          if (isTeamMember) {
            response.hasAccess = true;
          } else {
            // Check for pending join request
            if (teamId) {
              const joinRequest = await prisma.teamJoinRequest.findFirst({
                where: {
                  userId: session.userId,
                  teamId,
                  status: "PENDING",
                },
              });

              if (joinRequest) {
                response.requestStatus = "PENDING";
              }
            }
          }
        }
      } else {
        // Not logged in
        response.requiresAuth = true;
      }
    } catch (authError) {
      // Session check failed, treat as not logged in
      response.requiresAuth = true;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching public follow-up:", error);
    return NextResponse.json(
      { error: "Failed to fetch follow-up" },
      { status: 500 }
    );
  }
}
