"""Replace hardcoded shipping options arrays with dynamic shippingMethods."""
import re, os

stores = [
    "cmlzg38ne0001z7kcvrj4udv9",
    "cmm5krnq6002dz7kr1s4chppt",
    "cmn13zioq001yz7fnhm99xpvf",
]
base = "/var/www/flowsmartly/generated-stores"

# Pattern: find lines with { value/id: "standard" and replace the enclosing map
DYNAMIC_METHODS = '(shippingMethods || []).map((method) => (\n                  <label key={method.id} className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">\n                    <input\n                      type="radio"\n                      name="shippingMethod"\n                      value={method.id}\n                      checked={orderData?.shippingMethod === method.id || formData?.shippingMethod === method.id}\n                      onChange={handleInputChange}\n                      className="w-4 h-4"\n                    />\n                    <div className="ml-4 flex-1">\n                      <p className="font-semibold text-gray-900 dark:text-white">{method.name}</p>\n                      <p className="text-sm text-gray-600 dark:text-gray-400">{method.description}</p>\n                    </div>\n                    <span className="text-sm font-medium text-gray-900 dark:text-white">\n                      {method.priceCents === 0 ? "Free" : formatPrice(method.priceCents)}\n                    </span>\n                  </label>\n                ))'

for sid in stores:
    checkout = f"{base}/{sid}/src/app/checkout/page.tsx"
    if not os.path.exists(checkout):
        print(f"  {sid}: no checkout")
        continue

    with open(checkout, "r") as f:
        lines = f.readlines()

    # Find the block: {[ ... { value/id: "standard" ... ].map(
    new_lines = []
    i = 0
    replaced = False
    while i < len(lines):
        line = lines[i]

        # Detect start of hardcoded shipping array: {[ followed by standard
        if not replaced and '{[' in line.strip() and i + 1 < len(lines):
            # Look ahead for "standard" in next few lines
            lookahead = ''.join(lines[i:min(i+8, len(lines))])
            if '"standard"' in lookahead and ('"express"' in lookahead or '"pickup"' in lookahead):
                # Find the end of this .map(() block
                depth = 0
                j = i
                found_map = False
                while j < len(lines):
                    if '.map(' in lines[j]:
                        found_map = True
                    if found_map:
                        depth += lines[j].count('(') - lines[j].count(')')
                        if depth <= 0 and j > i:
                            break
                    j += 1

                # Get indentation from current line
                indent = len(line) - len(line.lstrip())
                indent_str = ' ' * indent

                # Replace the entire block with dynamic methods
                new_lines.append(f'{indent_str}{DYNAMIC_METHODS}\n')
                i = j + 1
                replaced = True
                print(f"  {sid}: replaced lines {i}-{j}")
                continue

        new_lines.append(line)
        i += 1

    if not replaced:
        print(f"  {sid}: no hardcoded array found (may be already fixed or different pattern)")
        # Try simpler approach: just replace the array literal inline
        content = ''.join(lines)
        # Match: [{ value: "standard"... }, { value: "pickup"... }]
        pattern = r'\{\[\s*\{[^}]*(?:value|id):\s*"standard"[^}]*\}(?:\s*,\s*\{[^}]*\})*\s*\]\.map\('
        if re.search(pattern, content, re.DOTALL):
            print(f"  {sid}: found pattern with regex")
    else:
        with open(checkout, "w") as f:
            f.writelines(new_lines)

    # Also ensure shippingMethods is imported
    checkout_content = open(checkout).read()
    if 'shippingMethods' not in checkout_content:
        checkout_content = re.sub(
            r'import \{([^}]+)\} from ["\']@/lib/data["\']',
            lambda m: m.group(0).replace(m.group(1), m.group(1).rstrip() + ', shippingMethods'),
            checkout_content,
            count=1
        )
        with open(checkout, 'w') as f:
            f.write(checkout_content)

print("Done")
