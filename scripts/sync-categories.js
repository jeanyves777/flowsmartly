const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require("fs");
const path = require("path");

async function main() {
  const storeId = process.argv[2] || "cmm5krnq6002dz7kr1s4chppt";
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { generatedPath: true },
  });
  if (!store || !store.generatedPath) {
    console.log("Store not found or no generatedPath");
    process.exit(1);
  }

  const dataPath = path.join(store.generatedPath, "src", "lib", "data.ts");
  if (!fs.existsSync(dataPath)) {
    console.log("data.ts not found at", dataPath);
    process.exit(1);
  }

  const cats = await prisma.productCategory.findMany({
    where: { storeId },
    select: { id: true, name: true, slug: true, description: true, imageUrl: true },
    orderBy: { createdAt: "asc" },
  });

  console.log("Found", cats.length, "categories:");
  cats.forEach((c) => console.log("  -", c.name, "| image:", c.imageUrl || "(none)"));

  const content = fs.readFileSync(dataPath, "utf-8");

  const arr = cats
    .map((c) => {
      return (
        "  { id: " + JSON.stringify(c.id) +
        ", name: " + JSON.stringify(c.name) +
        ", slug: " + JSON.stringify(c.slug) +
        ", description: " + JSON.stringify(c.description || "") +
        ", image: " + JSON.stringify(c.imageUrl || "") +
        " }"
      );
    })
    .join(",\n");

  const re = /export const categories[^=]*=\s*\[[\s\S]*?\];/;
  const newContent = content.replace(re, "export const categories = [\n" + arr + ",\n];");

  if (newContent !== content) {
    fs.writeFileSync(dataPath, newContent, "utf-8");
    console.log("Updated data.ts");
  } else {
    console.log("No changes needed");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
