"""Replace hardcoded shipping array with dynamic shippingMethods in checkout pages."""
import re, os

stores = [
    "cmlzg38ne0001z7kcvrj4udv9",
    "cmm5krnq6002dz7kr1s4chppt",
    "cmn13zioq001yz7fnhm99xpvf",
]
base = "/var/www/flowsmartly/generated-stores"

for sid in stores:
    f_path = f"{base}/{sid}/src/app/checkout/page.tsx"
    if not os.path.exists(f_path):
        print(f"  {sid}: no checkout")
        continue

    with open(f_path) as f:
        c = f.read()

    # Replace {[ { value: "standard"...}, {...} ].map((method) =>
    # with {(shippingMethods || []).map((method) =>
    c = re.sub(
        r'\{\[\s*\{[^\]]+\}\s*\]\.map\(\(method\)\s*=>\s*\(',
        '{(shippingMethods || []).map((method) => (',
        c
    )

    # Fix property names: method.value -> method.id etc
    c = c.replace("method.value", "method.id")
    c = c.replace("method.label", "method.name")
    c = c.replace("method.desc}", "method.description}")

    with open(f_path, "w") as f:
        f.write(c)
    print(f"  {sid}: fixed")

print("Done")
