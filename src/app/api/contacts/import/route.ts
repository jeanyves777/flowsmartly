import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 100;

type DuplicateStrategy = "skip" | "update";

interface ColumnMappings {
  [columnIndex: string]: string;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current.trim());
        current = "";
      } else if (char === "\n" || (char === "\r" && next === "\n")) {
        row.push(current.trim());
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
        current = "";
        if (char === "\r") i++;
      } else {
        current += char;
      }
    }
  }
  row.push(current.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

// POST /api/contacts/import - Import contacts from CSV
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const listId = formData.get("listId") as string | null;
    const duplicateStrategy = (formData.get("duplicateStrategy") as DuplicateStrategy) || "skip";
    const mappingsStr = formData.get("mappings") as string | null;

    // Validate file
    if (!file) {
      return NextResponse.json(
        { success: false, error: { message: "CSV file is required" } },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv") && file.type !== "text/csv") {
      return NextResponse.json(
        { success: false, error: { message: "File must be a CSV file" } },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: { message: "File size must be less than 10MB" } },
        { status: 400 }
      );
    }

    // Validate duplicate strategy
    if (duplicateStrategy !== "skip" && duplicateStrategy !== "update") {
      return NextResponse.json(
        { success: false, error: { message: "duplicateStrategy must be 'skip' or 'update'" } },
        { status: 400 }
      );
    }

    // Parse column mappings
    let mappings: ColumnMappings = {};
    if (mappingsStr) {
      try {
        mappings = JSON.parse(mappingsStr);
      } catch {
        return NextResponse.json(
          { success: false, error: { message: "Invalid mappings JSON" } },
          { status: 400 }
        );
      }
    }

    // Validate listId if provided
    if (listId) {
      const list = await prisma.contactList.findFirst({
        where: { id: listId, userId: session.userId },
      });
      if (!list) {
        return NextResponse.json(
          { success: false, error: { message: "Contact list not found" } },
          { status: 404 }
        );
      }
    }

    // Read and parse CSV
    const rawText = await file.text();
    const text = rawText.replace(/^\uFEFF/, ""); // Strip BOM
    const rows = parseCSV(text);

    if (rows.length < 2) {
      return NextResponse.json(
        { success: false, error: { message: "CSV file must have a header row and at least one data row" } },
        { status: 400 }
      );
    }

    // First row is headers (skipped as data)
    const dataRows = rows.slice(1);

    const validFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "company",
      "birthday",
      "city",
      "state",
      "address",
      "tags",
    ];

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const newContactIds: string[] = [];

    // Process in chunks
    for (let chunkStart = 0; chunkStart < dataRows.length; chunkStart += CHUNK_SIZE) {
      const chunk = dataRows.slice(chunkStart, chunkStart + CHUNK_SIZE);

      for (let rowIdx = 0; rowIdx < chunk.length; rowIdx++) {
        const row = chunk[rowIdx];
        const absoluteRowNum = chunkStart + rowIdx + 2; // +2 for 1-based index + header row

        try {
          // Build contact object from mappings
          const contactData: Record<string, string> = {};

          if (Object.keys(mappings).length > 0) {
            // Use explicit column mappings
            for (const [colIndex, fieldName] of Object.entries(mappings)) {
              const idx = parseInt(colIndex, 10);
              if (!isNaN(idx) && idx < row.length && validFields.includes(fieldName)) {
                contactData[fieldName] = row[idx];
              }
            }
          } else {
            // Auto-map: assume standard column order from headers
            // firstName, lastName, email, phone, company, birthday, city, state, address
            const autoFields = ["firstName", "lastName", "email", "phone", "company", "birthday", "city", "state", "address"];
            for (let i = 0; i < Math.min(row.length, autoFields.length); i++) {
              if (row[i]) {
                contactData[autoFields[i]] = row[i];
              }
            }
          }

          const email = contactData.email || null;
          const phone = contactData.phone || null;

          // Validate: must have email or phone
          if (!email && !phone) {
            skipped++;
            errors.push(`Row ${absoluteRowNum}: Missing email and phone`);
            continue;
          }

          // Parse tags if provided
          let tags: string[] = [];
          if (contactData.tags) {
            tags = contactData.tags.split(";").map((t) => t.trim()).filter(Boolean);
          }

          // Check for duplicates by email first, then phone
          let existingContact = null;

          if (email) {
            existingContact = await prisma.contact.findUnique({
              where: { userId_email: { userId: session.userId, email } },
            });
          }

          if (!existingContact && phone) {
            existingContact = await prisma.contact.findUnique({
              where: { userId_phone: { userId: session.userId, phone } },
            });
          }

          if (existingContact) {
            if (duplicateStrategy === "skip") {
              skipped++;
              continue;
            }

            // Update existing contact
            const updateData: Record<string, unknown> = {};
            if (contactData.firstName) updateData.firstName = contactData.firstName;
            if (contactData.lastName) updateData.lastName = contactData.lastName;
            if (contactData.email && !existingContact.email) updateData.email = contactData.email;
            if (contactData.phone && !existingContact.phone) updateData.phone = contactData.phone;
            if (contactData.company) updateData.company = contactData.company;
            if (contactData.birthday) updateData.birthday = contactData.birthday;
            if (contactData.city) updateData.city = contactData.city;
            if (contactData.state) updateData.state = contactData.state;
            if (contactData.address) updateData.address = contactData.address;
            if (tags.length > 0) {
              const existingTags: string[] = JSON.parse(existingContact.tags || "[]");
              const mergedTags = [...new Set([...existingTags, ...tags])];
              updateData.tags = JSON.stringify(mergedTags);
            }

            if (Object.keys(updateData).length > 0) {
              await prisma.contact.update({
                where: { id: existingContact.id },
                data: updateData,
              });
            }

            updated++;
          } else {
            // Create new contact
            const contact = await prisma.contact.create({
              data: {
                userId: session.userId,
                email,
                phone,
                firstName: contactData.firstName || null,
                lastName: contactData.lastName || null,
                company: contactData.company || null,
                birthday: contactData.birthday || null,
                city: contactData.city || null,
                state: contactData.state || null,
                address: contactData.address || null,
                tags: tags.length > 0 ? JSON.stringify(tags) : "[]",
                emailOptedIn: !!email,
                emailOptedInAt: email ? new Date() : null,
                smsOptedIn: !!phone,
                smsOptedInAt: phone ? new Date() : null,
              },
            });

            newContactIds.push(contact.id);
            imported++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          errors.push(`Row ${absoluteRowNum}: ${message}`);
          skipped++;
        }
      }
    }

    // Add new contacts to list if listId provided
    if (listId && newContactIds.length > 0) {
      // Filter out any that are already in the list
      const existingInList = await prisma.contactListMember.findMany({
        where: { contactListId: listId, contactId: { in: newContactIds } },
        select: { contactId: true },
      });
      const alreadyInList = new Set(existingInList.map((m) => m.contactId));
      const toAddToList = newContactIds.filter((id) => !alreadyInList.has(id));

      if (toAddToList.length > 0) {
        await prisma.contactListMember.createMany({
          data: toAddToList.map((contactId) => ({
            contactListId: listId,
            contactId,
          })),
        });
      }

      // Recount list
      const memberCount = await prisma.contactListMember.count({
        where: { contactListId: listId },
      });

      const activeCount = await prisma.contactListMember.count({
        where: {
          contactListId: listId,
          contact: { status: "ACTIVE" },
        },
      });

      await prisma.contactList.update({
        where: { id: listId },
        data: {
          totalCount: memberCount,
          activeCount,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        updated,
        skipped,
        total: dataRows.length,
        errors: errors.slice(0, 50), // Cap error messages at 50
      },
    });
  } catch (error) {
    console.error("Import contacts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to import contacts" } },
      { status: 500 }
    );
  }
}
