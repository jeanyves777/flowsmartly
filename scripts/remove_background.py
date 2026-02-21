#!/usr/bin/env python3
"""
Background Remover for FlowSmartly

Uses rembg library with u2net models to remove image backgrounds.
Called from Node.js via child_process.spawn().

Usage:
    python remove_background.py --input image.png --output result.png
    python remove_background.py --input image.png --output result.png --model u2net_human_seg
"""

import argparse
import sys
import os


def remove_bg(input_path: str, output_path: str, model: str = "u2net") -> None:
    from rembg import remove, new_session
    from PIL import Image

    session = new_session(model)

    img = Image.open(input_path)
    result = remove(img, session=session)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    result.save(output_path, "PNG")

    print(f"Background removed: {output_path}")
    print(f"Size: {result.width}x{result.height}")


def main():
    parser = argparse.ArgumentParser(
        description="Remove background from image using rembg"
    )
    parser.add_argument(
        "--input", "-i", required=True, help="Path to input image"
    )
    parser.add_argument(
        "--output",
        "-o",
        required=True,
        help="Path to output PNG (with transparency)",
    )
    parser.add_argument(
        "--model",
        "-m",
        default="u2net",
        choices=["u2net", "u2net_human_seg", "isnet-general-use", "u2netp"],
        help="Model to use (default: u2net)",
    )

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        remove_bg(args.input, args.output, args.model)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
