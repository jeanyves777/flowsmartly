stores = [
    "cmlzg38ne0001z7kcvrj4udv9",
    "cmm0zvdwg0001z7m225si98ka",
    "cmm5krnq6002dz7kr1s4chppt",
    "cmn13zioq001yz7fnhm99xpvf",
]

base = "/var/www/flowsmartly/generated-stores"

for sid in stores:
    checkout = f"{base}/{sid}/src/app/checkout/page.tsx"
    try:
        with open(checkout, "r") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"  {sid}: no checkout")
        continue

    if "shippingConfig" in content:
        print(f"  {sid}: already fixed")
        continue

    # 1. Add storeInfo import if not present
    if "storeInfo" not in content:
        content = content.replace(
            'import { formatPrice } from "@/lib/data";',
            'import { formatPrice, storeInfo } from "@/lib/data";'
        )
        # Also try alternate import pattern
        content = content.replace(
            "import { formatPrice } from '@/lib/data';",
            "import { formatPrice, storeInfo } from '@/lib/data';"
        )

    # 2. Add shipping config derived from storeInfo after cart state
    content = content.replace(
        "const [cart, setCart] = useState<CartItem[]>([]);",
        "const [cart, setCart] = useState<CartItem[]>([]);\n  const shippingConfig = { flatRateCents: (storeInfo as any).flatRateShippingCents || 0, freeThresholdCents: (storeInfo as any).freeShippingThresholdCents || 0 };"
    )

    # 3. Replace hardcoded shipping calc
    old_calc = 'const shippingCost = orderData.shippingMethod === "express" ? 1499 : orderData.shippingMethod === "standard" ? 599 : 0;'
    new_calc = 'const shippingCost = orderData.shippingMethod === "pickup" ? 0 : (shippingConfig.freeThresholdCents > 0 && total >= shippingConfig.freeThresholdCents) ? 0 : shippingConfig.flatRateCents;'
    content = content.replace(old_calc, new_calc)

    # 4. Replace hardcoded shipping option prices
    content = content.replace(
        'price: 599',
        'price: shippingConfig.flatRateCents'
    )
    content = content.replace(
        'price: 1499',
        'price: Math.round(shippingConfig.flatRateCents * 2.5)'
    )

    with open(checkout, "w") as f:
        f.write(content)
    print(f"  {sid}: fixed")

print("Done")
