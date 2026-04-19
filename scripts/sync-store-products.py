#!/usr/bin/env python3
"""Sync products from DB to a store's products.ts file."""
import sys, os, json, re, subprocess

STORE_ID = sys.argv[1] if len(sys.argv) > 1 else "cmnzd0pcd000lz77po45kfft9"
STORE_DIR = f"/var/www/flowsmartly/generated-stores/{STORE_ID}"
DB_URL = "postgresql://flowsmartly:fs_prod_2026secure@localhost:5432/flowsmartly"

def escape_str(s):
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")

def query(sql):
    result = subprocess.run(
        ["psql", DB_URL, "-t", "-A", "-F", "|", "-c", sql],
        capture_output=True, text=True
    )
    rows = []
    for line in result.stdout.strip().split("\n"):
        if line:
            rows.append(line.split("|"))
    return rows

# Get products
products = query(f"""
    SELECT p.id, p.slug, p.name, p."shortDescription", p.description,
           p."priceCents", p."comparePriceCents", p."categoryId",
           p.tags, p.labels, p.images, p."trackInventory", p.quantity
    FROM "Product" p
    WHERE p."storeId" = '{STORE_ID}' AND p.status = 'ACTIVE'
    ORDER BY p."createdAt" ASC
""")

print(f"Found {len(products)} ACTIVE products")

products_arr = []
for row in products:
    pid, slug, name, short_desc, desc, price, compare_price, cat_id, tags_json, labels_json, images_json, track_inv, qty = row

    try: images = json.loads(images_json or "[]")
    except: images = []
    images = [{"url": (i if isinstance(i, str) else i.get("url", "")), "alt": (name if isinstance(i, str) else i.get("alt", name))} for i in images]

    try: tags = json.loads(tags_json or "[]")
    except: tags = []

    try: labels = json.loads(labels_json or "[]")
    except: labels = []

    in_stock = (int(qty) > 0) if track_inv == "t" else True
    compare_line = f'    comparePriceCents: {compare_price},\n' if compare_price and compare_price != "" else ""

    entry = f"""  {{
    id: "{pid}",
    slug: "{slug}",
    name: "{escape_str(name)}",
    shortDescription: "{escape_str(short_desc or "")}",
    description: "{escape_str(desc or "")}",
    priceCents: {price},
{compare_line}    categoryId: "{cat_id or ""}",
    tags: {json.dumps(tags)},
    images: {json.dumps(images)},
    variants: [],
    labels: {json.dumps(labels)},
    badges: {json.dumps(labels)},
    featured: {"true" if "featured" in labels else "false"},
    inStock: {"true" if in_stock else "false"},
  }}"""
    products_arr.append(entry)

products_str = ",\n".join(products_arr)

# Read and update products.ts
products_path = os.path.join(STORE_DIR, "src/lib/products.ts")
with open(products_path) as f:
    content = f.read()

new_content = re.sub(
    r'export const products[^=]*=\s*\[[\s\S]*?\];',
    f'export const products: Product[] = [\n{products_str},\n];',
    content
)

with open(products_path, "w") as f:
    f.write(new_content)

print(f"Synced {len(products)} products to {products_path}")
