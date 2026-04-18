#!/usr/bin/env python3
"""Fix featured products logic in all generated stores."""
import os, re, glob

OLD_PATTERNS = [
    r"// Get first 8 products for featured section\s*\n\s*const featuredProducts = products\.slice\(0,\s*8\);",
    r"const featuredProducts = products\.slice\(0,\s*8\);",
    r"const featuredProducts = products\.slice\(0,\s*\d+\);",
]

NEW_BLOCK = """// Featured products: respect the 'featured' flag set by the store owner.
  // If no products are marked featured, fall back to first 8 so the section isn't empty.
  const featured = products.filter(p => p.featured && p.inStock);
  const featuredProducts = featured.length > 0 ? featured : products.slice(0, 8);"""

stores = glob.glob("/var/www/flowsmartly/generated-stores/*/src/app/page.tsx")

for f in stores:
    with open(f) as fh:
        content = fh.read()

    original = content
    for pat in OLD_PATTERNS:
        content = re.sub(pat, NEW_BLOCK, content, flags=re.MULTILINE)

    if content != original:
        with open(f, "w") as fh:
            fh.write(content)
        print(f"Fixed: {f}")
    else:
        # Check if it uses some other slice pattern
        if "slice(0" in content and "featuredProducts" in content:
            print(f"Has slice but couldn't auto-fix: {f}")
        else:
            print(f"OK / no change: {f}")
