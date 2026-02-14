#!/usr/bin/env python3
"""
Batch render all downloaded 3D models into the character library.

Usage:
    python scripts/batch-render-3d.py
"""

import json
import os
import subprocess
import sys
import shutil
from pathlib import Path


# Character definitions — maps model files to character library entries
CHARACTERS_3D = [
    {
        "id": "3d-fox",
        "name": "Foxy",
        "category": "3d",
        "tags": ["fox", "animal", "3d", "lowpoly"],
        "model_file": "fox.glb",
        "animation": "survey",  # Nice standing pose
    },
    {
        "id": "3d-soldier",
        "name": "Sergeant",
        "category": "3d",
        "tags": ["soldier", "military", "3d", "human"],
        "model_file": "soldier.glb",
        "animation": "idle",
    },
    {
        "id": "3d-robot-expressive",
        "name": "Spark",
        "category": "3d",
        "tags": ["robot", "3d", "expressive", "cute"],
        "model_file": "robot.glb",
        "animation": "idle",
    },
    {
        "id": "3d-xbot",
        "name": "Xena",
        "category": "3d",
        "tags": ["robot", "3d", "humanoid", "sci-fi"],
        "model_file": "xbot.glb",
        "animation": "idle",
    },
    {
        "id": "3d-cesium-man",
        "name": "Atlas",
        "category": "3d",
        "tags": ["human", "3d", "animated", "astronaut"],
        "model_file": "cesium-man.glb",
        "animation": None,  # Use default
    },
    {
        "id": "3d-brainstem",
        "name": "Mecha",
        "category": "3d",
        "tags": ["robot", "3d", "mechanical", "complex"],
        "model_file": "brainstem.glb",
        "animation": None,
    },
]

# Kenney FBX character with different skins
KENNEY_CHARS = [
    {
        "id": "3d-human-male",
        "name": "Jake",
        "category": "3d",
        "tags": ["human", "male", "3d", "cartoon"],
        "skin": "humanMaleA.png",
    },
    {
        "id": "3d-human-female",
        "name": "Maya",
        "category": "3d",
        "tags": ["human", "female", "3d", "cartoon"],
        "skin": "humanFemaleA.png",
    },
    {
        "id": "3d-zombie-male",
        "name": "Zack",
        "category": "3d",
        "tags": ["zombie", "undead", "3d", "horror"],
        "skin": "zombieMaleA.png",
    },
    {
        "id": "3d-zombie-female",
        "name": "Zara",
        "category": "3d",
        "tags": ["zombie", "undead", "3d", "horror"],
        "skin": "zombieFemaleA.png",
    },
]


def find_blender() -> str:
    """Find Blender executable."""
    paths = [
        r"C:\Program Files\Blender Foundation\Blender 5.0\blender.exe",
        r"C:\Program Files\Blender Foundation\Blender\blender.exe",
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    b = shutil.which("blender")
    if b:
        return b
    print("ERROR: Blender not found")
    sys.exit(1)


def render_glb(blender_path, model_path, output_dir, render_script, animation=None):
    """Render a GLB model using Blender."""
    cmd = [
        blender_path, "-b", "-P", str(render_script),
        "--", "--input", str(model_path), "--output", str(output_dir),
        "--width", "600", "--height", "800",
    ]
    if animation:
        cmd.extend(["--animation", animation])

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if result.returncode != 0:
        print(f"  FAILED:")
        for line in result.stderr.strip().split("\n")[-5:]:
            print(f"    {line}")
        return False
    # Print key output lines
    for line in result.stdout.split("\n"):
        if any(k in line for k in ["Render engine:", "Using animation:", "Rendered frame", "Done!", "FAILED", "Error"]):
            print(f"  {line.strip()}")
    return True


def create_mask_and_skeleton(char_dir):
    """Create mask.png and char_cfg.yaml for AnimatedDrawings compatibility."""
    texture_path = char_dir / "texture.png"
    if not texture_path.exists():
        return False

    try:
        from PIL import Image
        import numpy as np

        img = Image.open(str(texture_path)).convert("RGBA")
        width, height = img.size

        # Mask from alpha channel
        alpha = np.array(img)[:, :, 3]
        mask = ((alpha > 10).astype(np.uint8)) * 255
        mask_img = Image.fromarray(mask, mode="L")
        mask_img.save(str(char_dir / "mask.png"))

        # Simple humanoid skeleton
        cx = width // 2
        skeleton = [
            {"loc": [cx, int(height * 0.55)], "name": "root", "parent": None},
            {"loc": [cx, int(height * 0.55)], "name": "hip", "parent": "root"},
            {"loc": [cx, int(height * 0.40)], "name": "torso", "parent": "hip"},
            {"loc": [cx, int(height * 0.22)], "name": "neck", "parent": "torso"},
            {"loc": [cx - int(width * 0.2), int(height * 0.40)], "name": "right_shoulder", "parent": "torso"},
            {"loc": [cx - int(width * 0.25), int(height * 0.50)], "name": "right_elbow", "parent": "right_shoulder"},
            {"loc": [cx - int(width * 0.28), int(height * 0.58)], "name": "right_hand", "parent": "right_elbow"},
            {"loc": [cx + int(width * 0.2), int(height * 0.40)], "name": "left_shoulder", "parent": "torso"},
            {"loc": [cx + int(width * 0.25), int(height * 0.50)], "name": "left_elbow", "parent": "left_shoulder"},
            {"loc": [cx + int(width * 0.28), int(height * 0.58)], "name": "left_hand", "parent": "left_elbow"},
            {"loc": [cx - int(width * 0.1), int(height * 0.55)], "name": "right_hip", "parent": "root"},
            {"loc": [cx - int(width * 0.1), int(height * 0.75)], "name": "right_knee", "parent": "right_hip"},
            {"loc": [cx - int(width * 0.1), int(height * 0.93)], "name": "right_foot", "parent": "right_knee"},
            {"loc": [cx + int(width * 0.1), int(height * 0.55)], "name": "left_hip", "parent": "root"},
            {"loc": [cx + int(width * 0.1), int(height * 0.75)], "name": "left_knee", "parent": "left_hip"},
            {"loc": [cx + int(width * 0.1), int(height * 0.93)], "name": "left_foot", "parent": "left_knee"},
        ]

        # Write YAML manually (no yaml dependency needed)
        with open(char_dir / "char_cfg.yaml", "w") as f:
            f.write(f"width: {width}\nheight: {height}\nskeleton:\n")
            for joint in skeleton:
                f.write(f"- loc: {joint['loc']}\n  name: {joint['name']}\n")
                f.write(f"  parent: {'null' if joint['parent'] is None else joint['parent']}\n")

        return True
    except Exception as e:
        print(f"  Mask/skeleton error: {e}")
        return False


def ensure_thumbnail(char_dir):
    """Create thumbnail if it doesn't exist."""
    thumbnail = char_dir / "thumbnail.png"
    texture = char_dir / "texture.png"

    if thumbnail.exists() and thumbnail.stat().st_size > 100:
        return

    if not texture.exists():
        return

    try:
        from PIL import Image
        import numpy as np

        img = Image.open(str(texture)).convert("RGBA")
        w, h = img.size
        size = 256
        scale = min(size / w, size / h)
        new_w, new_h = int(w * scale), int(h * scale)
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas.paste(resized, ((size - new_w) // 2, (size - new_h) // 2))
        canvas.save(str(thumbnail))
    except Exception as e:
        print(f"  Thumbnail error: {e}")
        shutil.copy2(str(texture), str(thumbnail))


def main():
    project_root = Path(__file__).resolve().parent.parent
    cache_dir = project_root / ".cache" / "3d-models"
    output_dir = project_root / "public" / "characters"
    render_script = project_root / "scripts" / "render_3d_character.py"
    blender = find_blender()

    print(f"Blender: {blender}")
    print(f"Models cache: {cache_dir}")
    print(f"Output: {output_dir}")
    print()

    # Load existing manifest
    manifest_path = output_dir / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)
    else:
        manifest = {"characters": [], "categories": []}

    if "3d" not in manifest["categories"]:
        manifest["categories"].append("3d")

    existing_ids = {c["id"] for c in manifest["characters"]}

    # Remove old fake-3d entries (the 2D ones with shading)
    old_3d_ids = {c["id"] for c in manifest["characters"] if c["category"] == "3d"}
    fake_3d_prefixes = ("3d-boy-", "3d-girl-", "3d-man-", "3d-woman-", "3d-warrior-", "3d-monster-", "3d-dino-", "3d-astronaut")
    for old_id in old_3d_ids:
        if any(old_id.startswith(p) for p in fake_3d_prefixes):
            manifest["characters"] = [c for c in manifest["characters"] if c["id"] != old_id]
            existing_ids.discard(old_id)
            # Also remove directory
            old_dir = output_dir / old_id
            if old_dir.exists():
                shutil.rmtree(str(old_dir), ignore_errors=True)
                print(f"  Removed old fake-3d: {old_id}")

    successful = 0
    total = len(CHARACTERS_3D)

    print(f"=== Rendering {total} 3D Characters ===\n")

    for i, char in enumerate(CHARACTERS_3D, 1):
        char_id = char["id"]
        char_dir = output_dir / char_id
        model_path = cache_dir / char["model_file"]

        print(f"[{i}/{total}] {char['name']} ({char_id})")

        # Skip if already exists
        if char_id in existing_ids and (char_dir / "texture.png").exists():
            print(f"  Already exists, skipping")
            successful += 1
            continue

        if not model_path.exists():
            print(f"  Model not found: {model_path}")
            continue

        char_dir.mkdir(parents=True, exist_ok=True)

        # Render with Blender
        if not render_glb(blender, model_path, char_dir, render_script, char.get("animation")):
            continue

        # Create mask and skeleton for AnimatedDrawings
        create_mask_and_skeleton(char_dir)
        ensure_thumbnail(char_dir)

        if not (char_dir / "texture.png").exists():
            print(f"  ERROR: No texture.png produced")
            continue

        # Add to manifest
        if char_id not in existing_ids:
            manifest["characters"].append({
                "id": char_id,
                "name": char["name"],
                "category": "3d",
                "tags": char["tags"],
                "thumbnail": f"/characters/{char_id}/thumbnail.png",
                "texturePath": f"/characters/{char_id}/texture.png",
                "isPreRigged": True,
            })
            existing_ids.add(char_id)

        successful += 1
        print(f"  OK!")

    # Clean up test directory
    test_dir = output_dir / "3d-fox-test"
    if test_dir.exists():
        shutil.rmtree(str(test_dir), ignore_errors=True)

    # Save manifest
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n=== Done! ===")
    print(f"Rendered: {successful}/{total} 3D characters")
    print(f"Manifest: {len(manifest['characters'])} total characters")


if __name__ == "__main__":
    main()
