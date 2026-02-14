#!/usr/bin/env python3
"""
Animate Character Script

Uses Meta's AnimatedDrawings to animate a character image.
Called from Node.js via child_process.spawn().

Usage:
    python animate_character.py --input <image_path> --output <video_path> --motion <motion_type> --duration <seconds>

Motion types: idle, talk, walk, wave, jump, dance

With TorchServe running (Docker), automatic character detection + pose estimation is used.
Without TorchServe, a simple auto-skeleton is generated from the image dimensions.
"""

import argparse
import json
import os
import sys
import yaml
import tempfile
from pathlib import Path
import cv2
import numpy as np
import requests as http_requests
from skimage import measure
from scipy import ndimage

# Add AnimatedDrawings to path - check common locations
ANIMATED_DRAWINGS_PATHS = [
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "AnimatedDrawings"),
    r"C:\Users\koffi\Dev\AnimatedDrawings",
    os.path.expanduser("~/Dev/AnimatedDrawings"),
]

for ad_path in ANIMATED_DRAWINGS_PATHS:
    if os.path.exists(ad_path):
        sys.path.insert(0, ad_path)
        break

try:
    from animated_drawings import render
except ImportError:
    print("Error: AnimatedDrawings not found. Please install it first.", file=sys.stderr)
    sys.exit(1)


# Motion mapping to AnimatedDrawings config files
# Each motion specifies the motion yaml and the matching retarget config
# fair1 BVH → fair1_ppf.yaml, cmu1 BVH → cmu1_pfp.yaml, rokoko BVH → mixamo_fff.yaml
MOTION_CONFIGS = {
    "idle": {"motion": "zombie.yaml", "retarget": "fair1_ppf.yaml"},
    "talk": {"motion": "wave_hello.yaml", "retarget": "fair1_ppf.yaml"},
    "walk": {"motion": "zombie.yaml", "retarget": "fair1_ppf.yaml"},
    "wave": {"motion": "wave_hello.yaml", "retarget": "fair1_ppf.yaml"},
    "jump": {"motion": "jumping.yaml", "retarget": "fair1_ppf.yaml"},
    "dance": {"motion": "jesse_dance.yaml", "retarget": "mixamo_fff.yaml"},
}

# TorchServe endpoint
TORCHSERVE_URL = os.environ.get("TORCHSERVE_URL", "http://localhost:8080")

# AnimatedDrawings root path
AD_ROOT = None
for ad_path in ANIMATED_DRAWINGS_PATHS:
    if os.path.exists(ad_path):
        AD_ROOT = Path(ad_path)
        break

if AD_ROOT is None:
    AD_ROOT = Path(r"C:\Users\koffi\Dev\AnimatedDrawings")


def is_torchserve_running() -> bool:
    """Check if TorchServe Docker container is running and healthy."""
    try:
        resp = http_requests.get(f"{TORCHSERVE_URL}/ping", timeout=3)
        return resp.status_code == 200
    except Exception:
        return False


def auto_detect_and_rig(img_path: str, char_dir: Path) -> bool:
    """
    Use TorchServe to automatically detect the character, segment it,
    and estimate its pose/skeleton. Returns True on success.
    """
    char_dir.mkdir(parents=True, exist_ok=True)

    # Read and resize image
    img = cv2.imread(img_path)
    if img is None:
        return False

    cv2.imwrite(str(char_dir / "image.png"), img)

    if np.max(img.shape) > 1000:
        scale = 1000 / np.max(img.shape)
        img = cv2.resize(img, (round(scale * img.shape[1]), round(scale * img.shape[0])))

    # Step 1: Detect drawn humanoid
    img_bytes = cv2.imencode(".png", img)[1].tobytes()
    try:
        resp = http_requests.post(
            f"{TORCHSERVE_URL}/predictions/drawn_humanoid_detector",
            files={"data": img_bytes},
            timeout=30,
        )
        if resp.status_code >= 300:
            print(f"Detection failed: {resp.status_code}", file=sys.stderr)
            return False
        detection_results = json.loads(resp.content)
    except Exception as e:
        print(f"Detection request failed: {e}", file=sys.stderr)
        return False

    if not detection_results or len(detection_results) == 0:
        print("No humanoids detected in image.", file=sys.stderr)
        return False

    # Use highest scoring detection
    detection_results.sort(key=lambda x: x["score"], reverse=True)
    bbox = np.array(detection_results[0]["bbox"])
    l, t, r, b = [round(x) for x in bbox]

    # Save bounding box
    with open(str(char_dir / "bounding_box.yaml"), "w") as f:
        yaml.dump({"left": l, "top": t, "right": r, "bottom": b}, f)

    # Crop character
    cropped = img[t:b, l:r]

    # Step 2: Segment the character
    mask = segment_character(cropped)

    # Step 3: Estimate pose
    cropped_bytes = cv2.imencode(".png", cropped)[1].tobytes()
    try:
        resp = http_requests.post(
            f"{TORCHSERVE_URL}/predictions/drawn_humanoid_pose_estimator",
            files={"data": cropped_bytes},
            timeout=30,
        )
        if resp.status_code >= 300:
            print(f"Pose estimation failed: {resp.status_code}", file=sys.stderr)
            return False
        pose_results = json.loads(resp.content)
    except Exception as e:
        print(f"Pose request failed: {e}", file=sys.stderr)
        return False

    if not pose_results or len(pose_results) == 0:
        print("No skeleton detected.", file=sys.stderr)
        return False

    # Build skeleton from keypoints
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

    # Save texture (RGBA)
    cropped_rgba = cv2.cvtColor(cropped, cv2.COLOR_BGR2BGRA)
    cv2.imwrite(str(char_dir / "texture.png"), cropped_rgba)

    # Save mask
    cv2.imwrite(str(char_dir / "mask.png"), mask)

    # Save character config
    char_cfg = {"skeleton": skeleton, "height": cropped.shape[0], "width": cropped.shape[1]}
    with open(str(char_dir / "char_cfg.yaml"), "w") as f:
        yaml.dump(char_cfg, f)

    print(f"Auto-rigged character: {cropped.shape[1]}x{cropped.shape[0]}, {len(skeleton)} joints")
    return True


def segment_character(img: np.ndarray) -> np.ndarray:
    """Segment the character from the background using thresholding."""
    gray = np.min(img, axis=2)
    gray = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 115, 8)
    gray = cv2.bitwise_not(gray)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    gray = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel, iterations=2)
    gray = cv2.morphologyEx(gray, cv2.MORPH_DILATE, kernel, iterations=2)

    # Floodfill from edges
    mask = np.zeros([gray.shape[0] + 2, gray.shape[1] + 2], np.uint8)
    mask[1:-1, 1:-1] = gray.copy()

    im_floodfill = np.full(gray.shape, 255, np.uint8)
    h, w = gray.shape[:2]
    for x in range(0, w - 1, 10):
        cv2.floodFill(im_floodfill, mask, (x, 0), 0)
        cv2.floodFill(im_floodfill, mask, (x, h - 1), 0)
    for y in range(0, h - 1, 10):
        cv2.floodFill(im_floodfill, mask, (0, y), 0)
        cv2.floodFill(im_floodfill, mask, (w - 1, y), 0)

    im_floodfill[0, :] = 0
    im_floodfill[-1, :] = 0
    im_floodfill[:, 0] = 0
    im_floodfill[:, -1] = 0

    mask2 = cv2.bitwise_not(im_floodfill)
    final_mask = None
    biggest = 0

    contours = measure.find_contours(mask2, 0.0)
    for c in contours:
        x = np.zeros(mask2.T.shape, np.uint8)
        cv2.fillPoly(x, [np.int32(c)], 1)
        size = len(np.where(x == 1)[0])
        if size > biggest:
            final_mask = x
            biggest = size

    if final_mask is None:
        # Fallback: use simple threshold
        _, final_mask = cv2.threshold(np.min(img, axis=2), 240, 255, cv2.THRESH_BINARY_INV)
        return final_mask

    final_mask = ndimage.binary_fill_holes(final_mask).astype(int)
    final_mask = 255 * final_mask.astype(np.uint8)

    return final_mask.T


def create_simple_skeleton(width: int, height: int) -> list:
    """
    Create a simple humanoid skeleton based on image dimensions.
    Fallback when TorchServe is not available.
    """
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
    """Create mask from character image (alpha channel or threshold)."""
    if len(img.shape) == 3 and img.shape[2] == 4:
        mask = img[:, :, 3]
        return ((mask > 128).astype(np.uint8) * 255)

    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img

    _, mask = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_DILATE, kernel, iterations=1)
    return mask


def prepare_character_simple(input_path: str, char_dir: Path) -> None:
    """Prepare character files with simple auto-skeleton (no TorchServe)."""
    char_dir.mkdir(parents=True, exist_ok=True)

    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError(f"Could not read image: {input_path}")

    height, width = img.shape[:2]

    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    cv2.imwrite(str(char_dir / "texture.png"), img)
    mask = create_mask_from_image(img)
    cv2.imwrite(str(char_dir / "mask.png"), mask)

    skeleton = create_simple_skeleton(width, height)
    char_cfg = {"width": width, "height": height, "skeleton": skeleton}
    with open(char_dir / "char_cfg.yaml", "w") as f:
        yaml.dump(char_cfg, f, default_flow_style=False)


def create_render_config(char_dir: Path, motion: str, output_path: str) -> Path:
    """Create the MVC config file for AnimatedDrawings rendering."""
    motion_entry = MOTION_CONFIGS.get(motion, {"motion": "zombie.yaml", "retarget": "fair1_ppf.yaml"})
    motion_cfg_path = AD_ROOT / "examples" / "config" / "motion" / motion_entry["motion"]
    retarget_cfg_path = AD_ROOT / "examples" / "config" / "retarget" / motion_entry["retarget"]

    config = {
        "scene": {
            "ANIMATED_CHARACTERS": [
                {
                    "character_cfg": str(char_dir / "char_cfg.yaml"),
                    "motion_cfg": str(motion_cfg_path),
                    "retarget_cfg": str(retarget_cfg_path),
                }
            ]
        },
        "view": {
            "CAMERA_POS": [2.0, 0.7, 8.0],
            "CAMERA_FWD": [0.0, 0.5, 8.0],
            "USE_MESA": True,  # Always use OSMesa for headless rendering (works on both Linux and Windows)
            "WINDOW_DIMENSIONS": [512, 512],
        },
        "controller": {
            "MODE": "video_render",
            "OUTPUT_VIDEO_PATH": output_path,
            "OUTPUT_VIDEO_CODEC": "avc1",
        },
    }

    config_path = char_dir / "render_config.yaml"
    with open(config_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False)

    return config_path


def animate(input_path: str, output_path: str, motion: str, duration: float) -> None:
    """Animate the character and save to output video."""
    print(f"Animating character: {input_path}")
    print(f"Motion: {motion}, Duration: {duration}s")
    print(f"Output: {output_path}")

    with tempfile.TemporaryDirectory() as temp_dir:
        char_dir = Path(temp_dir) / "character"

        # Check if this is an already-rigged character directory
        input_p = Path(input_path)
        if (input_p.parent / "char_cfg.yaml").exists() and (input_p.parent / "mask.png").exists():
            # Use existing character directory (already rigged)
            char_dir = input_p.parent
            print(f"Using pre-rigged character from {char_dir}")
        else:
            # Try TorchServe auto-rigging first (best quality)
            use_torchserve = is_torchserve_running()

            if use_torchserve:
                print("TorchServe detected - using automatic character detection + pose estimation")
                success = auto_detect_and_rig(input_path, char_dir)
                if not success:
                    print("Auto-rigging failed, falling back to simple skeleton")
                    prepare_character_simple(input_path, char_dir)
            else:
                print("TorchServe not running - using simple auto-skeleton")
                prepare_character_simple(input_path, char_dir)

        # Create render config
        print("Creating render config...")
        config_path = create_render_config(char_dir, motion, output_path)

        # Render the animation
        original_dir = os.getcwd()
        os.chdir(str(AD_ROOT))

        try:
            print("Rendering animation...")
            render.start(str(config_path))
            print(f"Animation complete: {output_path}")
        finally:
            os.chdir(original_dir)


def main():
    parser = argparse.ArgumentParser(description="Animate a character image using Meta AnimatedDrawings")
    parser.add_argument("--input", "-i", required=True, help="Path to character image (PNG)")
    parser.add_argument("--output", "-o", required=True, help="Output video path (MP4)")
    parser.add_argument("--motion", "-m", default="idle",
                        choices=["idle", "talk", "walk", "wave", "jump", "dance"],
                        help="Type of motion animation")
    parser.add_argument("--duration", "-d", type=float, default=5.0,
                        help="Duration of animation in seconds")

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    try:
        animate(args.input, args.output, args.motion, args.duration)
    except Exception as e:
        print(f"Error during animation: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
