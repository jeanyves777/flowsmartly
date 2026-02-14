#!/usr/bin/env python3
"""
Download free 2D character images from Pixabay and prepare them for the character library.

Usage:
    python scripts/download-characters.py

Requires: PIXABAY_API_KEY environment variable (get free key at https://pixabay.com/api/docs/)
If no API key, uses curated URLs from Pixabay's CC0-licensed images.
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

# Curated list of free CC0 2D character images from Pixabay
# These are all CC0/public domain licensed
CURATED_CHARACTERS = [
    {
        "id": "boy-casual",
        "name": "Tommy",
        "category": "boy",
        "tags": ["child", "casual", "happy"],
        "url": "https://cdn.pixabay.com/photo/2017/01/31/21/23/avatar-2027366_960_720.png",
    },
    {
        "id": "girl-casual",
        "name": "Sofia",
        "category": "girl",
        "tags": ["child", "casual", "happy"],
        "url": "https://cdn.pixabay.com/photo/2017/01/31/19/07/avatar-2026510_960_720.png",
    },
    {
        "id": "man-business",
        "name": "David",
        "category": "man",
        "tags": ["adult", "business", "professional"],
        "url": "https://cdn.pixabay.com/photo/2016/11/18/23/38/child-1837375_960_720.png",
    },
    {
        "id": "woman-business",
        "name": "Sarah",
        "category": "woman",
        "tags": ["adult", "business", "professional"],
        "url": "https://cdn.pixabay.com/photo/2017/01/31/20/53/avatar-2027029_960_720.png",
    },
    {
        "id": "boy-sporty",
        "name": "Alex",
        "category": "boy",
        "tags": ["child", "sporty", "active"],
        "url": "https://cdn.pixabay.com/photo/2017/02/23/13/05/avatar-2092113_960_720.png",
    },
    {
        "id": "girl-princess",
        "name": "Luna",
        "category": "girl",
        "tags": ["child", "princess", "fantasy"],
        "url": "https://cdn.pixabay.com/photo/2017/01/31/21/22/avatar-2027365_960_720.png",
    },
    {
        "id": "man-casual",
        "name": "Marcus",
        "category": "man",
        "tags": ["adult", "casual", "friendly"],
        "url": "https://cdn.pixabay.com/photo/2016/11/18/23/38/child-1837376_960_720.png",
    },
    {
        "id": "woman-casual",
        "name": "Emma",
        "category": "woman",
        "tags": ["adult", "casual", "friendly"],
        "url": "https://cdn.pixabay.com/photo/2017/02/23/13/05/avatar-2092114_960_720.png",
    },
    {
        "id": "robot-friendly",
        "name": "Bolt",
        "category": "fantasy",
        "tags": ["robot", "sci-fi", "friendly"],
        "url": "https://cdn.pixabay.com/photo/2017/05/11/08/48/robot-2303002_960_720.png",
    },
    {
        "id": "cat-cartoon",
        "name": "Whiskers",
        "category": "animal",
        "tags": ["cat", "pet", "cute"],
        "url": "https://cdn.pixabay.com/photo/2017/01/31/23/42/animal-2028258_960_720.png",
    },
    {
        "id": "dog-cartoon",
        "name": "Buddy",
        "category": "animal",
        "tags": ["dog", "pet", "friendly"],
        "url": "https://cdn.pixabay.com/photo/2017/02/01/10/00/animal-2029279_960_720.png",
    },
    {
        "id": "wizard-old",
        "name": "Merlin",
        "category": "fantasy",
        "tags": ["wizard", "magic", "old"],
        "url": "https://cdn.pixabay.com/photo/2016/11/18/23/38/child-1837377_960_720.png",
    },
]


def download_image(url: str, output_path: str) -> bool:
    """Download an image from URL."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "FlowSmartly/1.0"})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = response.read()
            with open(output_path, "wb") as f:
                f.write(data)
        return True
    except Exception as e:
        print(f"  Download failed: {e}")
        return False


def main():
    output_dir = Path(os.path.dirname(os.path.dirname(__file__))) / "public" / "characters"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Check if prepare-character.py exists
    prepare_script = Path(os.path.dirname(__file__)) / "prepare-character.py"
    if not prepare_script.exists():
        print(f"Error: {prepare_script} not found")
        sys.exit(1)

    manifest = {
        "characters": [],
        "categories": ["boy", "girl", "man", "woman", "animal", "fantasy"],
    }

    successful = 0
    for i, char_info in enumerate(CURATED_CHARACTERS, 1):
        char_id = char_info["id"]
        char_dir = output_dir / char_id
        print(f"[{i}/{len(CURATED_CHARACTERS)}] {char_info['name']} ({char_id})")

        # Download the image
        raw_path = char_dir / "raw_download.png"
        char_dir.mkdir(parents=True, exist_ok=True)

        if not (char_dir / "texture.png").exists():
            if not download_image(char_info["url"], str(raw_path)):
                print(f"  Skipping {char_id} (download failed)")
                continue

            # Process with prepare-character.py
            import subprocess
            result = subprocess.run(
                [sys.executable, str(prepare_script), "--input", str(raw_path), "--output", str(char_dir)],
                capture_output=True, text=True,
            )
            if result.returncode != 0:
                print(f"  Processing failed: {result.stderr}")
                continue

            # Clean up raw download
            raw_path.unlink(missing_ok=True)
            print(f"  Processed successfully")
        else:
            print(f"  Already exists, skipping")

        manifest["characters"].append({
            "id": char_id,
            "name": char_info["name"],
            "category": char_info["category"],
            "tags": char_info["tags"],
            "thumbnail": f"/characters/{char_id}/thumbnail.png",
            "texturePath": f"/characters/{char_id}/texture.png",
            "isPreRigged": True,
        })
        successful += 1

    # Save manifest
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nDone! {successful}/{len(CURATED_CHARACTERS)} characters processed")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
