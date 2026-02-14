#!/usr/bin/env python3
"""
SadTalker Talking Face Generator for FlowSmartly Cartoon Maker

Generates a talking head video from:
  - A source face image (portrait/character)
  - A driving audio file (narration/speech)

Outputs a video with lip sync, head movement, eye blinks, and facial expressions.

Usage:
    python sadtalker_generate.py --image face.png --audio narration.mp3 --output talking.mp4
    python sadtalker_generate.py --image face.png --audio narration.mp3 --output talking.mp4 --size 512 --enhancer gfpgan
"""

import argparse
import os
import sys
import shutil
import time
from pathlib import Path

# SadTalker installation path
SADTALKER_ROOT = os.environ.get(
    "SADTALKER_PATH",
    str(Path(__file__).parent.parent.parent / "SadTalker")
)

# Add SadTalker to Python path
if SADTALKER_ROOT not in sys.path:
    sys.path.insert(0, SADTALKER_ROOT)

# Verify SadTalker exists
if not os.path.exists(os.path.join(SADTALKER_ROOT, "src")):
    print(f"Error: SadTalker not found at {SADTALKER_ROOT}", file=sys.stderr)
    print("Set SADTALKER_PATH environment variable or install SadTalker.", file=sys.stderr)
    sys.exit(1)


def check_models():
    """Check if required model checkpoints are downloaded."""
    checkpoint_dir = os.path.join(SADTALKER_ROOT, "checkpoints")
    required_files = [
        "SadTalker_V0.0.2_256.safetensors",
        "SadTalker_V0.0.2_512.safetensors",
        "mapping_00229-model.pth.tar",
        "mapping_00109-model.pth.tar",
    ]

    missing = []
    for f in required_files:
        fpath = os.path.join(checkpoint_dir, f)
        if not os.path.exists(fpath) or os.path.getsize(fpath) < 1000:
            missing.append(f)

    if missing:
        print(f"Missing model files in {checkpoint_dir}:", file=sys.stderr)
        for f in missing:
            print(f"  - {f}", file=sys.stderr)
        return False
    return True


def generate_talking_face(
    source_image: str,
    driven_audio: str,
    output_path: str,
    size: int = 256,
    preprocess: str = "crop",
    still_mode: bool = False,
    enhancer: str = None,
    expression_scale: float = 1.0,
    pose_style: int = 0,
    batch_size: int = 2,
):
    """
    Generate a talking face video using SadTalker.

    Args:
        source_image: Path to the source face image
        driven_audio: Path to the driving audio file
        output_path: Path for the output video
        size: Face render size (256 or 512)
        preprocess: How to preprocess images ('crop', 'resize', 'full')
        still_mode: Keep the original size, suitable for full body
        enhancer: Face enhancer ('gfpgan' or None)
        expression_scale: Expression intensity (default 1.0)
        pose_style: Head pose style (0-45)
        batch_size: Batch size for rendering
    """
    import torch
    from src.utils.preprocess import CropAndExtract
    from src.test_audio2coeff import Audio2Coeff
    from src.facerender.animate import AnimateFromCoeff
    from src.generate_batch import get_data
    from src.generate_facerender_batch import get_facerender_data
    from src.utils.init_path import init_path

    # Determine device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    # Setup paths
    checkpoint_dir = os.path.join(SADTALKER_ROOT, "checkpoints")
    config_dir = os.path.join(SADTALKER_ROOT, "src", "config")

    # Create temp result directory
    result_dir = os.path.join(SADTALKER_ROOT, "results")
    os.makedirs(result_dir, exist_ok=True)
    save_dir = os.path.join(result_dir, f"gen_{int(time.time())}")
    os.makedirs(save_dir, exist_ok=True)

    # Init model paths
    sadtalker_paths = init_path(checkpoint_dir, config_dir, size, False, preprocess)

    print("Loading models...")
    start_time = time.time()

    # Init models
    preprocess_model = CropAndExtract(sadtalker_paths, device)
    audio_to_coeff = Audio2Coeff(sadtalker_paths, device)
    animate_from_coeff = AnimateFromCoeff(sadtalker_paths, device)

    load_time = time.time() - start_time
    print(f"Models loaded in {load_time:.1f}s")

    # Step 1: Crop image and extract 3DMM
    first_frame_dir = os.path.join(save_dir, "first_frame_dir")
    os.makedirs(first_frame_dir, exist_ok=True)

    print("Extracting 3DMM from source image...")
    first_coeff_path, crop_pic_path, crop_info = preprocess_model.generate(
        source_image, first_frame_dir, preprocess, source_image_flag=True, pic_size=size
    )

    if first_coeff_path is None:
        raise RuntimeError("Failed to extract face coefficients from the source image. Make sure the image contains a clear face.")

    # Step 2: Audio to coefficients
    print("Processing audio to motion coefficients...")
    batch = get_data(first_coeff_path, driven_audio, device, ref_eyeblink_coeff_path=None, still=still_mode)
    coeff_path = audio_to_coeff.generate(batch, save_dir, pose_style, ref_pose_coeff_path=None)

    # Step 3: Render animation
    print("Rendering talking face animation...")
    data = get_facerender_data(
        coeff_path, crop_pic_path, first_coeff_path, driven_audio,
        batch_size, input_yaw_list=None, input_pitch_list=None, input_roll_list=None,
        expression_scale=expression_scale, still_mode=still_mode,
        preprocess=preprocess, size=size
    )

    result = animate_from_coeff.generate(
        data, save_dir, source_image, crop_info,
        enhancer=enhancer, background_enhancer=None,
        preprocess=preprocess, img_size=size
    )

    # Move result to output path
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    shutil.move(result, output_path)
    print(f"Talking face video saved: {output_path}")

    # Cleanup temp files
    try:
        shutil.rmtree(save_dir)
    except Exception:
        pass

    total_time = time.time() - start_time
    print(f"Total generation time: {total_time:.1f}s")

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Generate talking face video with SadTalker")
    parser.add_argument("--image", required=True, help="Path to source face image")
    parser.add_argument("--audio", required=True, help="Path to driving audio file")
    parser.add_argument("--output", required=True, help="Path for output video")
    parser.add_argument("--size", type=int, default=256, choices=[256, 512], help="Face render size")
    parser.add_argument("--preprocess", default="crop", choices=["crop", "resize", "full"], help="Image preprocessing mode")
    parser.add_argument("--still", action="store_true", help="Still mode (less head motion)")
    parser.add_argument("--enhancer", default=None, choices=["gfpgan", None], help="Face enhancer")
    parser.add_argument("--expression-scale", type=float, default=1.0, help="Expression intensity")
    parser.add_argument("--pose-style", type=int, default=0, help="Head pose style (0-45)")
    parser.add_argument("--batch-size", type=int, default=2, help="Render batch size")

    args = parser.parse_args()

    # Validate inputs
    if not os.path.exists(args.image):
        print(f"Error: Image not found: {args.image}", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(args.audio):
        print(f"Error: Audio not found: {args.audio}", file=sys.stderr)
        sys.exit(1)

    # Check models
    if not check_models():
        print("Please download SadTalker models first.", file=sys.stderr)
        sys.exit(1)

    try:
        generate_talking_face(
            source_image=args.image,
            driven_audio=args.audio,
            output_path=args.output,
            size=args.size,
            preprocess=args.preprocess,
            still_mode=args.still,
            enhancer=args.enhancer,
            expression_scale=args.expression_scale,
            pose_style=args.pose_style,
            batch_size=args.batch_size,
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
