import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/contacts/[contactId] - Get a single contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId: session.userId },
      include: {
        lists: {
          include: {
            contactList: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: { message: "Contact not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        contact: {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          birthday: contact.birthday || null,
          imageUrl: contact.imageUrl || null,
          company: contact.company || null,
          city: contact.city || null,
          state: contact.state || null,
          address: contact.address || null,
          tags: JSON.parse(contact.tags || "[]"),
          customFields: JSON.parse(contact.customFields || "{}"),
          emailOptedIn: contact.emailOptedIn,
          smsOptedIn: contact.smsOptedIn,
          status: contact.status.toLowerCase(),
          lists: contact.lists.map(l => l.contactList),
          createdAt: contact.createdAt.toISOString(),
          updatedAt: contact.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Get contact error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch contact" } },
      { status: 500 }
    );
  }
}

// PATCH /api/contacts/[contactId] - Update a contact
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId: session.userId },
      include: {
        lists: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: { message: "Contact not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      birthday,
      imageUrl,
      company,
      city,
      state,
      address,
      tags,
      customFields,
      emailOptedIn,
      smsOptedIn,
      status,
      listIds,
    } = body;

    // Validate email uniqueness if changing
    if (email !== undefined && email !== contact.email) {
      const existingEmail = await prisma.contact.findFirst({
        where: {
          userId: session.userId,
          email,
          id: { not: contactId },
        },
      });
      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: { message: "Contact with this email already exists" } },
          { status: 400 }
        );
      }
    }

    // Validate phone uniqueness if changing
    if (phone !== undefined && phone !== contact.phone) {
      const existingPhone = await prisma.contact.findFirst({
        where: {
          userId: session.userId,
          phone,
          id: { not: contactId },
        },
      });
      if (existingPhone) {
        return NextResponse.json(
          { success: false, error: { message: "Contact with this phone already exists" } },
          { status: 400 }
        );
      }
    }

    // Validate birthday format if provided
    if (birthday !== undefined && birthday !== null && birthday !== "") {
      const birthdayRegex = /^\d{2}-\d{2}$/;
      if (!birthdayRegex.test(birthday)) {
        return NextResponse.json(
          { success: false, error: { message: "Birthday must be in MM-DD format" } },
          { status: 400 }
        );
      }
      const [monthStr, dayStr] = birthday.split("-");
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return NextResponse.json(
          { success: false, error: { message: "Birthday must have a valid month (01-12) and day (01-31)" } },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (birthday !== undefined) updateData.birthday = birthday || null;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
    if (company !== undefined) updateData.company = company;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (address !== undefined) updateData.address = address;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (customFields !== undefined) updateData.customFields = JSON.stringify(customFields);
    if (emailOptedIn !== undefined) updateData.emailOptedIn = emailOptedIn;
    if (smsOptedIn !== undefined) updateData.smsOptedIn = smsOptedIn;

    if (status !== undefined) {
      const upperStatus = status.toUpperCase();
      updateData.status = upperStatus;
      if (upperStatus === "UNSUBSCRIBED") {
        updateData.unsubscribedAt = new Date();
      } else if (upperStatus === "ACTIVE") {
        updateData.unsubscribedAt = null;
      }
    }

    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    });

    // Handle list membership changes
    if (listIds !== undefined) {
      const currentListIds = contact.lists.map(l => l.contactListId);
      const newListIds: string[] = listIds;

      const toRemove = currentListIds.filter(id => !newListIds.includes(id));
      const toAdd = newListIds.filter(id => !currentListIds.includes(id));

      // Remove memberships no longer in the set
      if (toRemove.length > 0) {
        await prisma.contactListMember.deleteMany({
          where: {
            contactId,
            contactListId: { in: toRemove },
          },
        });
      }

      // Add new memberships
      if (toAdd.length > 0) {
        await prisma.contactListMember.createMany({
          data: toAdd.map(lid => ({
            contactId,
            contactListId: lid,
          })),
        });
      }

      // Recount all affected lists
      const affectedListIds = [...new Set([...toRemove, ...toAdd])];
      await Promise.all(affectedListIds.map(listId => recountList(listId)));
    }

    // Fetch updated contact with lists for response
    const result = await prisma.contact.findFirst({
      where: { id: contactId, userId: session.userId },
      include: {
        lists: {
          include: {
            contactList: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        contact: {
          id: updatedContact.id,
          firstName: updatedContact.firstName,
          lastName: updatedContact.lastName,
          email: updatedContact.email,
          phone: updatedContact.phone,
          birthday: updatedContact.birthday || null,
          imageUrl: updatedContact.imageUrl || null,
          company: updatedContact.company || null,
          city: updatedContact.city || null,
          state: updatedContact.state || null,
          address: updatedContact.address || null,
          tags: JSON.parse(updatedContact.tags || "[]"),
          customFields: JSON.parse(updatedContact.customFields || "{}"),
          emailOptedIn: updatedContact.emailOptedIn,
          smsOptedIn: updatedContact.smsOptedIn,
          status: updatedContact.status.toLowerCase(),
          lists: result?.lists.map(l => l.contactList) || [],
          createdAt: updatedContact.createdAt.toISOString(),
          updatedAt: updatedContact.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Update contact error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update contact" } },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[contactId] - Delete a contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId: session.userId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: { message: "Contact not found" } },
        { status: 404 }
      );
    }

    // Find affected lists before deleting
    const memberships = await prisma.contactListMember.findMany({
      where: { contactId },
      select: { contactListId: true },
    });
    const affectedListIds = memberships.map(m => m.contactListId);

    // Delete contact (cascade removes memberships)
    await prisma.contact.delete({
      where: { id: contactId },
    });

    // Recount affected lists
    await Promise.all(affectedListIds.map(listId => recountList(listId)));

    return NextResponse.json({
      success: true,
      data: { message: "Contact deleted successfully" },
    });
  } catch (error) {
    console.error("Delete contact error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete contact" } },
      { status: 500 }
    );
  }
}

async function recountList(listId: string) {
  const [total, active] = await Promise.all([
    prisma.contactListMember.count({ where: { contactListId: listId } }),
    prisma.contactListMember.count({
      where: { contactListId: listId, contact: { status: "ACTIVE" } },
    }),
  ]);
  await prisma.contactList.update({
    where: { id: listId },
    data: { totalCount: total, activeCount: active },
  });
}
