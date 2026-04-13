"""Fix all store checkouts to use dynamic shipping methods from data.ts"""
import re
import os

stores = [
    "cmlzg38ne0001z7kcvrj4udv9",
    "cmm0zvdwg0001z7m225si98ka",
    "cmm5krnq6002dz7kr1s4chppt",
    "cmn13zioq001yz7fnhm99xpvf",
]
base = "/var/www/flowsmartly/generated-stores"

for sid in stores:
    checkout = f"{base}/{sid}/src/app/checkout/page.tsx"
    if not os.path.exists(checkout):
        print(f"  {sid}: no checkout")
        continue

    with open(checkout, "r") as f:
        content = f.read()

    # 1. Add shippingMethods to data import
    if "shippingMethods" not in content:
        # Find the data import line and add shippingMethods
        content = re.sub(
            r'import \{([^}]+)\} from ["\']@/lib/data["\']',
            lambda m: m.group(0).replace(m.group(1), m.group(1).rstrip() + ", shippingMethods"),
            content,
            count=1
        )

    # 2. Replace hardcoded shipping options array in JSX
    # Pattern: [{ id: "standard", ... }, { id: "express", ... }, ...]
    content = re.sub(
        r'\[\s*\{\s*id:\s*["\']standard["\'].*?\}\s*,\s*\{\s*id:\s*["\']express["\'].*?\}(?:\s*,\s*\{\s*id:\s*["\']pickup["\'].*?\})?\s*\]',
        '(shippingMethods || []).map(m => ({ id: m.id, label: m.name, desc: m.description || m.estimatedDays || "", price: m.priceCents }))',
        content,
        flags=re.DOTALL
    )

    # 3. Replace hardcoded shippingConfig if present
    if "shippingConfig.flatRateCents" in content:
        # Replace the shippingCost calculation to use selected method price
        content = re.sub(
            r'const shippingCost = .*?;',
            'const selectedShippingMethod = (shippingMethods || []).find(m => m.id === orderData.shippingMethod) || (shippingMethods || [])[0];\n  const freeThreshold = (storeInfo as any).freeShippingThresholdCents || 0;\n  const shippingCost = (freeThreshold > 0 && total >= freeThreshold) ? 0 : (selectedShippingMethod?.priceCents || 0);',
            content,
            count=1
        )

    with open(checkout, "w") as f:
        f.write(content)
    print(f"  {sid}: fixed")

print("Done")
