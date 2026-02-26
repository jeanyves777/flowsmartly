import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * WhatsApp Templates API
 * Manage message templates
 */

// GET: List all templates
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const category = request.nextUrl.searchParams.get("category");
    const status = request.nextUrl.searchParams.get("status");

    const where: any = {
      userId: session.userId,
    };

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    const templates = await prisma.whatsAppTemplate.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error("Get templates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST: Create new template
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      category,
      language = "en",
      bodyText,
      headerText,
      footerText,
      buttons,
      socialAccountId,
    } = body;

    // Validate required fields
    if (!name || !category || !bodyText || !socialAccountId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify social account belongs to user
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        id: socialAccountId,
        userId: session.userId,
        platform: "whatsapp",
      },
    });

    if (!socialAccount) {
      return NextResponse.json(
        { error: "WhatsApp account not found" },
        { status: 404 }
      );
    }

    // Build template config
    const templateConfig: any = {
      components: [],
    };

    if (headerText) {
      templateConfig.components.push({
        type: "HEADER",
        format: "TEXT",
        text: headerText,
      });
    }

    templateConfig.components.push({
      type: "BODY",
      text: bodyText,
    });

    if (footerText) {
      templateConfig.components.push({
        type: "FOOTER",
        text: footerText,
      });
    }

    if (buttons && buttons.length > 0) {
      templateConfig.components.push({
        type: "BUTTONS",
        buttons,
      });
    }

    // Submit template to WhatsApp for approval
    const whatsappResponse = await submitTemplateToWhatsApp(
      socialAccount.accessToken!,
      socialAccount.platformUserId!,
      name,
      category,
      language,
      templateConfig.components
    );

    // Save template to database
    const template = await prisma.whatsAppTemplate.create({
      data: {
        userId: session.userId,
        socialAccountId,
        name,
        category,
        language,
        bodyText,
        headerText: headerText || null,
        footerText: footerText || null,
        buttons: buttons ? JSON.stringify(buttons) : null,
        templateConfig: JSON.stringify(templateConfig),
        whatsappTemplateId: whatsappResponse.id || null,
        status: whatsappResponse.status || "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      template,
      whatsappResponse,
    });
  } catch (error) {
    console.error("Create template error:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}

// DELETE: Delete template
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const templateId = request.nextUrl.searchParams.get("templateId");

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required" },
        { status: 400 }
      );
    }

    // Get template
    const template = await prisma.whatsAppTemplate.findFirst({
      where: {
        id: templateId,
        userId: session.userId,
      },
      include: {
        socialAccount: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Delete from WhatsApp if approved
    if (template.whatsappTemplateId && template.socialAccount.accessToken) {
      await deleteTemplateFromWhatsApp(
        template.socialAccount.accessToken,
        template.socialAccount.platformUserId!,
        template.name
      );
    }

    // Delete from database
    await prisma.whatsAppTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({
      success: true,
      message: "Template deleted",
    });
  } catch (error) {
    console.error("Delete template error:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}

async function submitTemplateToWhatsApp(
  accessToken: string,
  wabaId: string,
  name: string,
  category: string,
  language: string,
  components: any[]
) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          category,
          language,
          components,
        }),
      }
    );

    return await response.json();
  } catch (error) {
    console.error("Error submitting template to WhatsApp:", error);
    return { error: "Failed to submit template" };
  }
}

async function deleteTemplateFromWhatsApp(
  accessToken: string,
  wabaId: string,
  templateName: string
) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates?name=${templateName}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return await response.json();
  } catch (error) {
    console.error("Error deleting template from WhatsApp:", error);
    return { error: "Failed to delete template" };
  }
}
