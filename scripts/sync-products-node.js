// Run with: node scripts/sync-products-node.js <storeId>
// Must be run from /opt/flowsmartly on the server

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const storeId = process.argv[2] || "cmnzd0pcd000lz77po45kfft9";
const storeDir = "/var/www/flowsmartly/generated-stores/" + storeId;

function esc(s) {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

(async () => {
  const p = new PrismaClient();

  const products = await p.product.findMany({
    where: { storeId, status: "ACTIVE" },
    include: { variants: { where: { isActive: true } } },
    orderBy: { createdAt: "asc" },
  });

  console.log("Found " + products.length + " ACTIVE products");

  const arr = products.map((pr) => {
    let images = [];
    try {
      images = JSON.parse(pr.images || "[]").map((i) =>
        typeof i === "string"
          ? { url: i, alt: pr.name }
          : { url: i.url || "", alt: i.alt || pr.name }
      );
    } catch (e) {}
    let tags = [];
    try { tags = JSON.parse(pr.tags || "[]"); } catch (e) {}
    let labels = [];
    try { labels = JSON.parse(pr.labels || "[]"); } catch (e) {}
    const inStock = pr.trackInventory ? pr.quantity > 0 : true;

    const lines = [
      "  {",
      '    id: "' + pr.id + '",',
      '    slug: "' + pr.slug + '",',
      '    name: "' + esc(pr.name) + '",',
      '    shortDescription: "' + esc(pr.shortDescription) + '",',
      '    description: "' + esc(pr.description) + '",',
      "    priceCents: " + pr.priceCents + ",",
    ];
    if (pr.comparePriceCents) {
      lines.push("    comparePriceCents: " + pr.comparePriceCents + ",");
    }
    lines.push(
      '    categoryId: "' + (pr.categoryId || "") + '",',
      "    tags: " + JSON.stringify(tags) + ",",
      "    images: " + JSON.stringify(images) + ",",
      "    variants: [],",
      "    labels: " + JSON.stringify(labels) + ",",
      "    badges: " + JSON.stringify(labels) + ",",
      "    featured: " + labels.includes("featured") + ",",
      "    inStock: " + inStock + ",",
      "  }"
    );
    return lines.join("\n");
  });

  const productsStr = arr.join(",\n");
  const filePath = path.join(storeDir, "src/lib/products.ts");
  let content = fs.readFileSync(filePath, "utf-8");
  content = content.replace(
    /export const products[^=]*=\s*\[[\s\S]*?\];/,
    "export const products: Product[] = [\n" + productsStr + ",\n];"
  );
  fs.writeFileSync(filePath, content, "utf-8");
  console.log("Synced " + products.length + " products to " + filePath);

  await p.$disconnect();
})();
