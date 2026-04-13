"""Final fix: replace ALL hardcoded shipping options in store checkouts."""
import re, os

stores = [
    "cmlzg38ne0001z7kcvrj4udv9",
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

    # 1. Replace ANY array containing { id: "standard" ... } with dynamic shippingMethods
    content = re.sub(
        r'\[[\s\S]*?\{\s*id:\s*["\']standard["\'][\s\S]*?\}\s*,\s*\{[\s\S]*?id:\s*["\']express["\'][\s\S]*?\}[\s\S]*?\]',
        '(shippingMethods || []).map(m => ({ id: m.id, label: m.name, desc: m.description || "", price: m.priceCents }))',
        content,
    )

    # 2. Fix shippingMethod type
    content = content.replace(
        'shippingMethod: "standard" | "express" | "pickup"',
        'shippingMethod: string'
    )

    # 3. Fix default to empty string (will be set to first method)
    content = content.replace(
        'shippingMethod: "standard",',
        'shippingMethod: "",',
    )

    # 4. Remove stale shippingConfig
    content = re.sub(
        r'const shippingConfig = \{[^}]+\};',
        '',
        content
    )

    # 5. Fix shippingCost to use selectedShippingMethod
    if 'selectedShippingMethod' not in content:
        content = content.replace(
            'const shippingCost =',
            'const selectedShippingMethod = (shippingMethods || []).find(m => m.id === orderData.shippingMethod) || (shippingMethods || [])[0];\n  const freeThreshold = (storeInfo as any).freeShippingThresholdCents || 0;\n  const shippingCost = (freeThreshold > 0 && total >= freeThreshold) ? 0 : (selectedShippingMethod?.priceCents || 0); //',
        )

    with open(checkout, "w") as f:
        f.write(content)
    print(f"  {sid}: fixed")

print("Done")
