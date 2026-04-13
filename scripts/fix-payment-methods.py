"""Fix payment method references: the payment array uses value/label, not id/name."""
import os

stores = [
    "cmlzg38ne0001z7kcvrj4udv9",
    "cmm5krnq6002dz7kr1s4chppt",
    "cmn13zioq001yz7fnhm99xpvf",
    "cmm0zvdwg0001z7m225si98ka",
]
base = "/var/www/flowsmartly/generated-stores"

for sid in stores:
    f_path = f"{base}/{sid}/src/app/checkout/page.tsx"
    if not os.path.exists(f_path):
        continue

    with open(f_path) as f:
        lines = f.readlines()

    # Find the payment methods section and fix method.id -> method.value, method.name -> method.label
    in_payment_section = False
    new_lines = []
    for line in lines:
        if 'Payment Method' in line:
            in_payment_section = True
        if in_payment_section and 'value: "card"' in line:
            in_payment_section = True  # confirm

        # Only in the payment block (after { value: "card" }) fix back to value/label
        if in_payment_section:
            if 'method.id' in line and ('paymentMethod' in line or 'key={method' in line):
                line = line.replace('method.id', 'method.value')
            if 'method.name' in line and in_payment_section:
                # Check if this is in payment context (after the payment map)
                line = line.replace('{method.name}', '{method.label}')

        # End of payment section
        if in_payment_section and '</div>' in line and 'space-y-3' not in line:
            payment_end_count = line.count('</div>')
            if payment_end_count >= 2:
                in_payment_section = False

        new_lines.append(line)

    with open(f_path, 'w') as f:
        f.writelines(new_lines)
    print(f"  {sid}: fixed")

print("Done")
