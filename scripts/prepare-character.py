#!/usr/bin/env python3
"""
Prepare Character for AnimatedDrawings Library

Takes a character PNG image and creates a full character directory with:
- texture.png (RGBA image)
- mask.png (binary segmentation mask)
- char_cfg.yaml (skeleton joint positions)
- thumbnail.png (small preview for UI)

Usage:
    python prepare-character.py --input <image.png> --output <character_dir>
    python prepare-character.py --input <image.png> --output <character_dir> --use-torchserve
    python prepare-character.py --batch <input_dir> --output <output_dir>

The script can use TorchServe for automatic pose estimation (best quality)
or fall back to simple auto-skeleton generation (no dependencies).
"""

import argparse
import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np
import yaml

# Optionally try TorchServe
TORCHSERVE_URL = os.environ.get("TORCHSERVE_URL", "http://localhost:8080")


def is_torchserve_running() -> bool:
    try:
        import requests
        resp = requests.get(f"{TORCHSERVE_URL}/ping", timeout=3)
        return resp.status_code == 200
    except Exception:
        return False


def create_simple_skeleton(width: int, height: int) -> list:
    """Create a humanoid skeleton based on image dimensions."""
    cx = width // 2
    head_y = int(height * 0.15)
    neck_y = int(height * 0.22)
    torso_y = int(height * 0.40)
    hip_y = int(height * 0.55)
    knee_y = int(height * 0.75)
    foot_y = int(height * 0.95)
    shoulder_offset = int(width * 0.2)
    hip_offset = int(width * 0.1)

    return [
        {"loc": [cx, hip_y], "name": "root", "parent": None},
        {"loc": [cx, hip_y], "name": "hip", "parent": "root"},
        {"loc": [cx, torso_y], "name": "torso", "parent": "hip"},
        {"loc": [cx, neck_y], "name": "neck", "parent": "torso"},
        {"loc": [cx - shoulder_offset, torso_y], "name": "right_shoulder", "parent": "torso"},
        {"loc": [cx - shoulder_offset - 20, torso_y + 30], "name": "right_elbow", "parent": "right_shoulder"},
        {"loc": [cx - shoulder_offset - 40, torso_y + 60], "name": "right_hand", "parent": "right_elbow"},
        {"loc": [cx + shoulder_offset, torso_y], "name": "left_shoulder", "parent": "torso"},
        {"loc": [cx + shoulder_offset + 20, torso_y + 30], "name": "left_elbow", "parent": "left_shoulder"},
        {"loc": [cx + shoulder_offset + 40, torso_y + 60], "name": "left_hand", "parent": "left_elbow"},
        {"loc": [cx - hip_offset, hip_y], "name": "right_hip", "parent": "root"},
        {"loc": [cx - hip_offset, knee_y], "name": "right_knee", "parent": "right_hip"},
        {"loc": [cx - hip_offset, foot_y], "name": "right_foot", "parent": "right_knee"},
        {"loc": [cx + hip_offset, hip_y], "name": "left_hip", "parent": "root"},
        {"loc": [cx + hip_offset, knee_y], "name": "left_knee", "parent": "left_hip"},
        {"loc": [cx + hip_offset, foot_y], "name": "left_foot", "parent": "left_knee"},
    ]


def create_mask_from_image(img: np.ndarray) -> np.ndarray:
    """Create binary mask from character image (alpha channel or threshold)."""
    if len(img.shape) == 3 and img.shape[2] == 4:
        # Use alpha channel
        mask = img[:, :, 3]
        return ((mask > 128).astype(np.uint8) * 255)

    # No alpha — use threshold
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img

    _, mask = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_DILATE, kernel, iterations=1)
    return mask


def auto_detect_and_rig(img_path: str, char_dir: Path) -> bool:
    """Use TorchServe for automatic character detection + pose estimation."""
    import requests

    img = cv2.imread(img_path)
    if img is None:
        return False

    if np.max(img.shape) > 1000:
        scale = 1000 / np.max(img.shape)
        img = cv2.resize(img, (round(scale * img.shape[1]), round(scale * img.shape[0])))

    img_bytes = cv2.imencode(".png", img)[1].tobytes()

    # Detect humanoid
    try:
        resp = requests.post(
            f"{TORCHSERVE_URL}/predictions/drawn_humanoid_detector",
            files={"data": img_bytes}, timeout=30,
        )
        if resp.status_code >= 300:
            return False
        detections = json.loads(resp.content)
    except Exception:
        return False

    if not detections:
        return False

    detections.sort(key=lambda x: x["score"], reverse=True)
    bbox = np.array(detections[0]["bbox"])
    l, t, r, b = [round(x) for x in bbox]
    cropped = img[t:b, l:r]

    # Estimate pose
    cropped_bytes = cv2.imencode(".png", cropped)[1].tobytes()
    try:
        resp = requests.post(
            f"{TORCHSERVE_URL}/predictions/drawn_humanoid_pose_estimator",
            files={"data": cropped_bytes}, timeout=30,
        )
        if resp.status_code >= 300:
            return False
        pose_results = json.loads(resp.content)
    except Exception:
        return False

    if not pose_results:
        return False

    kpts = np.array(pose_results[0]["keypoints"])[:, :2]
    skeleton = [
        {"loc": [round(x) for x in (kpts[11] + kpts[12]) / 2], "name": "root", "parent": None},
        {"loc": [round(x) for x in (kpts[11] + kpts[12]) / 2], "name": "hip", "parent": "root"},
        {"loc": [round(x) for x in (kpts[5] + kpts[6]) / 2], "name": "torso", "parent": "hip"},
        {"loc": [round(x) for x in kpts[0]], "name": "neck", "parent": "torso"},
        {"loc": [round(x) for x in kpts[6]], "name": "right_shoulder", "parent": "torso"},
        {"loc": [round(x) for x in kpts[8]], "name": "right_elbow", "parent": "right_shoulder"},
        {"loc": [round(x) for x in kpts[10]], "name": "right_hand", "parent": "right_elbow"},
        {"loc": [round(x) for x in kpts[5]], "name": "left_shoulder", "parent": "torso"},
        {"loc": [round(x) for x in kpts[7]], "name": "left_elbow", "parent": "left_shoulder"},
        {"loc": [round(x) for x in kpts[9]], "name": "left_hand", "parent": "left_elbow"},
        {"loc": [round(x) for x in kpts[12]], "name": "right_hip", "parent": "root"},
        {"loc": [round(x) for x in kpts[14]], "name": "right_knee", "parent": "right_hip"},
        {"loc": [round(x) for x in kpts[16]], "name": "right_foot", "parent": "right_knee"},
        {"loc": [round(x) for x in kpts[11]], "name": "left_hip", "parent": "root"},
        {"loc": [round(x) for x in kpts[13]], "name": "left_knee", "parent": "left_hip"},
        {"loc": [round(x) for x in kpts[15]], "name": "left_foot", "parent": "left_knee"},
    ]

    # Save RGBA texture
    cropped_rgba = cv2.cvtColor(cropped, cv2.COLOR_BGR2BGRA)
    cv2.imwrite(str(char_dir / "texture.png"), cropped_rgba)

    # Save mask
    from skimage import measure
    from scipy import ndimage
    gray = np.min(cropped, axis=2)
    gray = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 115, 8)
    gray = cv2.bitwise_not(gray)
    kern = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    gray = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kern, iterations=2)
    gray = cv2.morphologyEx(gray, cv2.MORPH_DILATE, kern, iterations=2)
    cv2.imwrite(str(char_dir / "mask.png"), gray)

    # Save char_cfg
    char_cfg = {"skeleton": skeleton, "height": cropped.shape[0], "width": cropped.shape[1]}
    with open(char_dir / "char_cfg.yaml", "w") as f:
        yaml.dump(char_cfg, f, default_flow_style=False)

    print(f"  Auto-rigged: {cropped.shape[1]}x{cropped.shape[0]}, {len(skeleton)} joints")
    return True


def prepare_character(input_path: str, output_dir: str, use_torchserve: bool = False) -> None:
    """Process a single character image into a rigged character directory."""
    char_dir = Path(output_dir)
    char_dir.mkdir(parents=True, exist_ok=True)

    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError(f"Could not read image: {input_path}")

    height, width = img.shape[:2]
    print(f"  Input: {width}x{height}, channels={img.shape[2] if len(img.shape) > 2 else 1}")

    # Try TorchServe first if requested
    if use_torchserve and is_torchserve_running():
        print("  Using TorchServe for auto-detection + pose estimation...")
        if auto_detect_and_rig(input_path, char_dir):
            # Generate thumbnail
            _create_thumbnail(char_dir)
            return
        print("  TorchServe failed, falling back to simple skeleton")

    # Ensure RGBA
    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    # Save texture
    cv2.imwrite(str(char_dir / "texture.png"), img)

    # Generate mask
    mask = create_mask_from_image(img)
    cv2.imwrite(str(char_dir / "mask.png"), mask)

    # Generate skeleton
    skeleton = create_simple_skeleton(width, height)
    char_cfg = {"width": width, "height": height, "skeleton": skeleton}
    with open(char_dir / "char_cfg.yaml", "w") as f:
        yaml.dump(char_cfg, f, default_flow_style=False)

    print(f"  Simple skeleton: {width}x{height}, {len(skeleton)} joints")

    # Generate thumbnail
    _create_thumbnail(char_dir)


def _create_thumbnail(char_dir: Path) -> None:
    """Create a small 256x256 thumbnail for the UI grid."""
    texture_path = char_dir / "texture.png"
    if not texture_path.exists():
        return

    img = cv2.imread(str(texture_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return

    # Resize to fit in 256x256 while maintaining aspect ratio
    h, w = img.shape[:2]
    scale = min(256 / w, 256 / h)
    new_w, new_h = round(w * scale), round(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # Center on 256x256 transparent canvas
    canvas = np.zeros((256, 256, 4), dtype=np.uint8)
    x_off = (256 - new_w) // 2
    y_off = (256 - new_h) // 2
    canvas[y_off:y_off + new_h, x_off:x_off + new_w] = resized

    cv2.imwrite(str(char_dir / "thumbnail.png"), canvas)
    print(f"  Thumbnail: 256x256")


def batch_process(input_dir: str, output_dir: str, use_torchserve: bool = False) -> None:
    """Process all PNG images in a directory."""
    input_path = Path(input_dir)
    output_path = Path(output_dir)

    png_files = sorted(input_path.glob("*.png"))
    if not png_files:
        print(f"No PNG files found in {input_dir}")
        return

    manifest = {"characters": [], "categories": ["boy", "girl", "man", "woman", "animal", "fantasy"]}

    for i, png_file in enumerate(png_files, 1):
        char_id = png_file.stem.lower().replace(" ", "-")
        char_dir = output_path / char_id
        print(f"[{i}/{len(png_files)}] Processing {png_file.name} -> {char_id}/")

        try:
            prepare_character(str(png_file), str(char_dir), use_torchserve)

            manifest["characters"].append({
                "id": char_id,
                "name": png_file.stem.replace("-", " ").replace("_", " ").title(),
                "category": "boy",  # Default; edit manifest.json manually to set correct categories
                "tags": [],
                "thumbnail": f"/characters/{char_id}/thumbnail.png",
                "texturePath": f"/characters/{char_id}/texture.png",
                "isPreRigged": True,
            })
        except Exception as e:
            print(f"  ERROR: {e}")

    # Save manifest
    manifest_path = output_path / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest saved: {manifest_path} ({len(manifest['characters'])} characters)")


def main():
    parser = argparse.ArgumentParser(description="Prepare character images for AnimatedDrawings library")
    parser.add_argument("--input", "-i", help="Path to a single character PNG image")
    parser.add_argument("--output", "-o", required=True, help="Output directory for character files")
    parser.add_argument("--batch", "-b", help="Batch process all PNGs in a directory")
    parser.add_argument("--use-torchserve", action="store_true", help="Use TorchServe for auto pose estimation")

    args = parser.parse_args()

    if args.batch:
        batch_process(args.batch, args.output, args.use_torchserve)
    elif args.input:
        if not os.path.exists(args.input):
            print(f"Error: Input file not found: {args.input}", file=sys.stderr)
            sys.exit(1)
        prepare_character(args.input, args.output, args.use_torchserve)
    else:
        parser.error("Either --input or --batch is required")


if __name__ == "__main__":
    main()
