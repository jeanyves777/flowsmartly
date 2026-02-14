#!/usr/bin/env python3
"""
Setup 3D Characters — Download Quaternius CC0 models and render them as character library assets.

Downloads free 3D character models (GLB format) from Quaternius,
renders them using Blender's Workbench engine, and adds them to the character manifest.

Usage:
    python scripts/setup-3d-characters.py

Requires: Blender installed (winget install BlenderFoundation.Blender)
"""

import json
import os
import subprocess
import sys
import shutil
import zipfile
import urllib.request
from pathlib import Path

# Blender path
BLENDER_PATHS = [
    r"C:\Program Files\Blender Foundation\Blender 5.0\blender.exe",
    r"C:\Program Files\Blender Foundation\Blender\blender.exe",
    r"C:\Program Files\Blender Foundation\Blender 4.0\blender.exe",
    r"C:\Program Files\Blender Foundation\Blender 3.6\blender.exe",
]

# Quaternius CC0 character packs — direct download links
# These are all public domain (CC0) licensed
QUATERNIUS_PACKS = {
    "animated-characters": {
        "url": "https://quaternius.com/packs/ultimateAnimatedCharacterPack.zip",
        "description": "Ultimate Animated Characters (humans, stylized)",
    },
}

# Individual GLB models from various CC0 sources
# We'll use direct model files where available
CHARACTER_MODELS = [
    {
        "id": "3d-knight",
        "name": "Sir Lance",
        "category": "3d",
        "tags": ["knight", "warrior", "3d", "medieval", "armor"],
        "source": "quaternius",
        "pack": "animated-characters",
        "glob_pattern": "*Knight*",
        "fallback_pattern": "*Warrior*",
    },
    {
        "id": "3d-wizard-char",
        "name": "Archibald",
        "category": "3d",
        "tags": ["wizard", "mage", "3d", "fantasy", "magic"],
        "source": "quaternius",
        "pack": "animated-characters",
        "glob_pattern": "*Mage*",
        "fallback_pattern": "*Wizard*",
    },
    {
        "id": "3d-rogue",
        "name": "Shadow",
        "category": "3d",
        "tags": ["rogue", "thief", "3d", "stealth"],
        "source": "quaternius",
        "pack": "animated-characters",
        "glob_pattern": "*Rogue*",
        "fallback_pattern": "*Assassin*",
    },
    {
        "id": "3d-barbarian",
        "name": "Grog",
        "category": "3d",
        "tags": ["barbarian", "warrior", "3d", "strong"],
        "source": "quaternius",
        "pack": "animated-characters",
        "glob_pattern": "*Barbarian*",
        "fallback_pattern": "*Fighter*",
    },
]

# Fallback: use direct Kenney/Quaternius GLB URLs if pack download fails
DIRECT_MODELS = [
    {
        "id": "3d-adventurer",
        "name": "Finn",
        "category": "3d",
        "tags": ["adventurer", "explorer", "3d", "hero"],
        "url": "https://raw.githubusercontent.com/AlaricBaraworworworworworked/3d-assets/main/adventurer.glb",
    },
]


def find_blender() -> str:
    """Find Blender executable."""
    # Check PATH first
    blender = shutil.which("blender")
    if blender:
        return blender

    # Check known install paths
    for path in BLENDER_PATHS:
        if os.path.exists(path):
            return path

    print("ERROR: Blender not found. Install with: winget install BlenderFoundation.Blender")
    sys.exit(1)


def download_file(url: str, output_path: str) -> bool:
    """Download a file from URL."""
    try:
        print(f"  Downloading: {url[:80]}...")
        req = urllib.request.Request(url, headers={"User-Agent": "FlowSmartly/1.0"})
        with urllib.request.urlopen(req, timeout=120) as response:
            data = response.read()
            with open(output_path, "wb") as f:
                f.write(data)
        size_mb = len(data) / (1024 * 1024)
        print(f"  Downloaded: {size_mb:.1f} MB")
        return True
    except Exception as e:
        print(f"  Download failed: {e}")
        return False


def download_pack(pack_name: str, pack_info: dict, cache_dir: Path) -> Path:
    """Download and extract a character pack."""
    pack_dir = cache_dir / pack_name
    zip_path = cache_dir / f"{pack_name}.zip"

    if pack_dir.exists() and any(pack_dir.rglob("*.glb")) or any(pack_dir.rglob("*.fbx")):
        print(f"  Pack already cached: {pack_dir}")
        return pack_dir

    print(f"  Downloading pack: {pack_info['description']}")
    if not download_file(pack_info["url"], str(zip_path)):
        return pack_dir

    # Extract
    pack_dir.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(str(zip_path), 'r') as z:
            z.extractall(str(pack_dir))
        print(f"  Extracted to: {pack_dir}")
    except Exception as e:
        print(f"  Extract failed: {e}")

    # Clean up zip
    zip_path.unlink(missing_ok=True)
    return pack_dir


def find_model_in_pack(pack_dir: Path, glob_pattern: str, fallback_pattern: str = None) -> Path:
    """Find a model file matching the pattern in a pack directory."""
    # Search for GLB files first, then FBX
    for ext in ("*.glb", "*.fbx", "*.gltf"):
        for pattern in [glob_pattern, fallback_pattern]:
            if not pattern:
                continue
            full_pattern = f"**/{pattern}{ext[1:]}"  # e.g. **/*Knight*.glb
            matches = list(pack_dir.rglob(full_pattern))
            if matches:
                return matches[0]

    # If no specific match, try broader search
    all_models = list(pack_dir.rglob("*.glb")) + list(pack_dir.rglob("*.fbx"))
    if all_models:
        print(f"  Warning: No match for '{glob_pattern}', available models:")
        for m in all_models[:20]:
            print(f"    - {m.name}")
    return None


def render_model(blender_path: str, model_path: str, output_dir: str, script_path: str) -> bool:
    """Render a 3D model using Blender."""
    cmd = [
        blender_path, "-b", "-P", script_path,
        "--", "--input", model_path, "--output", output_dir,
        "--width", "600", "--height", "800",
    ]

    print(f"  Rendering with Blender...")
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            print(f"  Blender render failed:")
            # Show last 10 lines of stderr
            for line in result.stderr.strip().split("\n")[-10:]:
                print(f"    {line}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print("  Blender render timed out (120s)")
        return False
    except Exception as e:
        print(f"  Blender render error: {e}")
        return False


def create_mask_from_texture(char_dir: Path):
    """Create a binary mask from the rendered RGBA texture."""
    try:
        from PIL import Image
        import numpy as np

        texture_path = char_dir / "texture.png"
        if not texture_path.exists():
            return

        img = Image.open(str(texture_path)).convert("RGBA")
        alpha = np.array(img)[:, :, 3]
        mask = ((alpha > 10).astype(np.uint8)) * 255

        mask_img = Image.fromarray(mask, mode="L")
        mask_img.save(str(char_dir / "mask.png"))
        print(f"  Mask created from alpha channel")
    except ImportError:
        print("  Warning: Pillow not installed, skipping mask generation")
    except Exception as e:
        print(f"  Mask creation failed: {e}")


def create_simple_skeleton(char_dir: Path):
    """Create a simple humanoid skeleton config for AnimatedDrawings compatibility."""
    try:
        from PIL import Image
        img = Image.open(str(char_dir / "texture.png"))
        width, height = img.size
    except Exception:
        width, height = 600, 800

    cx = width // 2
    skeleton = [
        {"loc": [cx, int(height * 0.55)], "name": "root", "parent": None},
        {"loc": [cx, int(height * 0.55)], "name": "hip", "parent": "root"},
        {"loc": [cx, int(height * 0.40)], "name": "torso", "parent": "hip"},
        {"loc": [cx, int(height * 0.22)], "name": "neck", "parent": "torso"},
        {"loc": [cx - int(width * 0.2), int(height * 0.40)], "name": "right_shoulder", "parent": "torso"},
        {"loc": [cx - int(width * 0.2) - 20, int(height * 0.40) + 30], "name": "right_elbow", "parent": "right_shoulder"},
        {"loc": [cx - int(width * 0.2) - 40, int(height * 0.40) + 60], "name": "right_hand", "parent": "right_elbow"},
        {"loc": [cx + int(width * 0.2), int(height * 0.40)], "name": "left_shoulder", "parent": "torso"},
        {"loc": [cx + int(width * 0.2) + 20, int(height * 0.40) + 30], "name": "left_elbow", "parent": "left_shoulder"},
        {"loc": [cx + int(width * 0.2) + 40, int(height * 0.40) + 60], "name": "left_hand", "parent": "left_elbow"},
        {"loc": [cx - int(width * 0.1), int(height * 0.55)], "name": "right_hip", "parent": "root"},
        {"loc": [cx - int(width * 0.1), int(height * 0.75)], "name": "right_knee", "parent": "right_hip"},
        {"loc": [cx - int(width * 0.1), int(height * 0.95)], "name": "right_foot", "parent": "right_knee"},
        {"loc": [cx + int(width * 0.1), int(height * 0.55)], "name": "left_hip", "parent": "root"},
        {"loc": [cx + int(width * 0.1), int(height * 0.75)], "name": "left_knee", "parent": "left_hip"},
        {"loc": [cx + int(width * 0.1), int(height * 0.95)], "name": "left_foot", "parent": "left_knee"},
    ]

    try:
        import yaml
        char_cfg = {"width": width, "height": height, "skeleton": skeleton}
        with open(char_dir / "char_cfg.yaml", "w") as f:
            yaml.dump(char_cfg, f, default_flow_style=False)
        print(f"  Skeleton config: {width}x{height}, {len(skeleton)} joints")
    except ImportError:
        # Fallback to JSON if yaml not available
        char_cfg = {"width": width, "height": height, "skeleton": skeleton}
        with open(char_dir / "char_cfg.yaml", "w") as f:
            # Write as YAML manually
            f.write(f"width: {width}\nheight: {height}\n")
            f.write("skeleton:\n")
            for joint in skeleton:
                f.write(f"- loc: {joint['loc']}\n")
                f.write(f"  name: {joint['name']}\n")
                if joint['parent'] is None:
                    f.write(f"  parent: null\n")
                else:
                    f.write(f"  parent: {joint['parent']}\n")
        print(f"  Skeleton config (manual YAML): {width}x{height}, {len(skeleton)} joints")


def create_thumbnail_from_texture(char_dir: Path, size: int = 256):
    """Create a thumbnail from the texture if Blender didn't create one."""
    thumbnail_path = char_dir / "thumbnail.png"
    texture_path = char_dir / "texture.png"

    if thumbnail_path.exists() and thumbnail_path.stat().st_size > 0:
        return  # Already exists

    if not texture_path.exists():
        return

    try:
        from PIL import Image
        import numpy as np

        img = Image.open(str(texture_path)).convert("RGBA")
        w, h = img.size

        # Scale to fit in size x size
        scale = min(size / w, size / h)
        new_w, new_h = int(w * scale), int(h * scale)
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Center on transparent canvas
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        x_off = (size - new_w) // 2
        y_off = (size - new_h) // 2
        canvas.paste(resized, (x_off, y_off))

        canvas.save(str(thumbnail_path))
        print(f"  Thumbnail: {size}x{size}")
    except ImportError:
        print("  Warning: Pillow not installed, using texture as thumbnail")
        shutil.copy2(str(texture_path), str(thumbnail_path))


def main():
    project_root = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    output_dir = project_root / "public" / "characters"
    cache_dir = project_root / ".cache" / "3d-models"
    render_script = project_root / "scripts" / "render_3d_character.py"

    output_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)

    blender_path = find_blender()
    print(f"Blender: {blender_path}")
    print(f"Output: {output_dir}")
    print(f"Cache: {cache_dir}")
    print()

    # Load existing manifest
    manifest_path = output_dir / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)
    else:
        manifest = {"characters": [], "categories": ["boy", "girl", "man", "woman", "animal", "fantasy", "3d"]}

    # Ensure "3d" is in categories
    if "3d" not in manifest["categories"]:
        manifest["categories"].append("3d")

    existing_ids = {c["id"] for c in manifest["characters"]}

    # Step 1: Download packs
    print("=== Downloading 3D Model Packs ===")
    pack_dirs = {}
    for pack_name, pack_info in QUATERNIUS_PACKS.items():
        print(f"\nPack: {pack_name}")
        pack_dirs[pack_name] = download_pack(pack_name, pack_info, cache_dir)

    # Step 2: Process each character
    print("\n=== Processing 3D Characters ===")
    successful = 0
    total = len(CHARACTER_MODELS)

    for i, char_info in enumerate(CHARACTER_MODELS, 1):
        char_id = char_info["id"]
        char_dir = output_dir / char_id

        print(f"\n[{i}/{total}] {char_info['name']} ({char_id})")

        # Skip if already fully processed
        if char_id in existing_ids and (char_dir / "texture.png").exists():
            print(f"  Already exists, skipping")
            successful += 1
            continue

        # Find the model file
        model_path = None
        if char_info.get("source") == "quaternius":
            pack_name = char_info.get("pack")
            if pack_name and pack_name in pack_dirs:
                model_path = find_model_in_pack(
                    pack_dirs[pack_name],
                    char_info.get("glob_pattern", "*"),
                    char_info.get("fallback_pattern"),
                )
        elif char_info.get("url"):
            # Direct download
            model_filename = char_id + os.path.splitext(char_info["url"])[1]
            model_path_candidate = cache_dir / model_filename
            if not model_path_candidate.exists():
                if download_file(char_info["url"], str(model_path_candidate)):
                    model_path = model_path_candidate
            else:
                model_path = model_path_candidate

        if not model_path or not model_path.exists():
            print(f"  Model not found, skipping")
            continue

        print(f"  Model: {model_path}")

        # Render with Blender
        char_dir.mkdir(parents=True, exist_ok=True)
        if not render_model(blender_path, str(model_path), str(char_dir), str(render_script)):
            print(f"  Render failed, skipping")
            continue

        # Create mask from alpha channel
        create_mask_from_texture(char_dir)

        # Create skeleton config for AnimatedDrawings
        create_simple_skeleton(char_dir)

        # Create thumbnail if Blender didn't
        create_thumbnail_from_texture(char_dir)

        # Verify texture exists
        if not (char_dir / "texture.png").exists():
            print(f"  ERROR: texture.png not created")
            continue

        # Add to manifest
        if char_id not in existing_ids:
            manifest["characters"].append({
                "id": char_id,
                "name": char_info["name"],
                "category": char_info["category"],
                "tags": char_info["tags"],
                "thumbnail": f"/characters/{char_id}/thumbnail.png",
                "texturePath": f"/characters/{char_id}/texture.png",
                "isPreRigged": True,
            })
            existing_ids.add(char_id)

        successful += 1
        print(f"  OK!")

    # Save manifest
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n=== Done! ===")
    print(f"Processed: {successful}/{total} characters")
    print(f"Manifest: {manifest_path} ({len(manifest['characters'])} total characters)")


if __name__ == "__main__":
    main()
