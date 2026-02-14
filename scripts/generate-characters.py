#!/usr/bin/env python3
"""
Generate simple 2D cartoon character PNGs using Pillow.
No external downloads needed — creates characters programmatically.

Each character: full-body, front-facing, transparent background, ~600x800px RGBA PNG.
Then runs prepare-character.py to create mask, skeleton, and thumbnail.

Usage:
    python scripts/generate-characters.py
"""

import json
import os
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Installing Pillow...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw


# Character definitions
CHARACTERS = [
    # Boys
    {
        "id": "boy-adventurer",
        "name": "Jake",
        "category": "boy",
        "tags": ["child", "adventure", "explorer"],
        "skin": "#F5D0A9", "hair": "#5C3317", "shirt": "#4CAF50", "pants": "#2196F3",
        "hair_style": "spiky",
    },
    {
        "id": "boy-cool",
        "name": "Ryan",
        "category": "boy",
        "tags": ["child", "cool", "trendy"],
        "skin": "#DEB887", "hair": "#1A1A1A", "shirt": "#E91E63", "pants": "#424242",
        "hair_style": "flat",
    },
    {
        "id": "boy-smart",
        "name": "Leo",
        "category": "boy",
        "tags": ["child", "smart", "glasses"],
        "skin": "#FFDAB9", "hair": "#8B4513", "shirt": "#3F51B5", "pants": "#795548",
        "hair_style": "neat",
        "glasses": True,
    },
    # Girls
    {
        "id": "girl-artist",
        "name": "Mia",
        "category": "girl",
        "tags": ["child", "creative", "artist"],
        "skin": "#FFE0BD", "hair": "#FF5722", "shirt": "#9C27B0", "pants": "#E91E63",
        "hair_style": "long",
    },
    {
        "id": "girl-sporty",
        "name": "Zoe",
        "category": "girl",
        "tags": ["child", "sporty", "active"],
        "skin": "#C68642", "hair": "#1A1A1A", "shirt": "#FF9800", "pants": "#4CAF50",
        "hair_style": "ponytail",
    },
    {
        "id": "girl-bookworm",
        "name": "Lily",
        "category": "girl",
        "tags": ["child", "smart", "reader"],
        "skin": "#F5D0A9", "hair": "#5C3317", "shirt": "#00BCD4", "pants": "#7B1FA2",
        "hair_style": "braids",
        "glasses": True,
    },
    # Men
    {
        "id": "man-teacher",
        "name": "Mr. Wilson",
        "category": "man",
        "tags": ["adult", "teacher", "professional"],
        "skin": "#FFDAB9", "hair": "#4E342E", "shirt": "#5D4037", "pants": "#37474F",
        "hair_style": "neat",
        "glasses": True,
    },
    {
        "id": "man-chef",
        "name": "Carlos",
        "category": "man",
        "tags": ["adult", "chef", "cooking"],
        "skin": "#DEB887", "hair": "#1A1A1A", "shirt": "#FAFAFA", "pants": "#212121",
        "hair_style": "flat",
        "hat": "chef",
    },
    {
        "id": "man-athlete",
        "name": "Marcus",
        "category": "man",
        "tags": ["adult", "athlete", "sporty"],
        "skin": "#8D5524", "hair": "#1A1A1A", "shirt": "#F44336", "pants": "#1565C0",
        "hair_style": "short",
    },
    # Women
    {
        "id": "woman-doctor",
        "name": "Dr. Sarah",
        "category": "woman",
        "tags": ["adult", "doctor", "medical"],
        "skin": "#FFDAB9", "hair": "#5C3317", "shirt": "#FAFAFA", "pants": "#42A5F5",
        "hair_style": "bun",
    },
    {
        "id": "woman-scientist",
        "name": "Nina",
        "category": "woman",
        "tags": ["adult", "scientist", "lab"],
        "skin": "#F5D0A9", "hair": "#D32F2F", "shirt": "#FAFAFA", "pants": "#616161",
        "hair_style": "short",
        "glasses": True,
    },
    {
        "id": "woman-artist",
        "name": "Priya",
        "category": "woman",
        "tags": ["adult", "artist", "creative"],
        "skin": "#C68642", "hair": "#1A1A1A", "shirt": "#E040FB", "pants": "#311B92",
        "hair_style": "long",
    },
    # Animals
    {
        "id": "dog-friendly",
        "name": "Buddy",
        "category": "animal",
        "tags": ["dog", "pet", "friendly"],
        "body_color": "#D2691E", "belly_color": "#FAEBD7",
        "animal_type": "dog",
    },
    {
        "id": "rabbit-cute",
        "name": "Hoppy",
        "category": "animal",
        "tags": ["rabbit", "bunny", "cute"],
        "body_color": "#E8E8E8", "belly_color": "#FAFAFA",
        "animal_type": "rabbit",
    },
    {
        "id": "bear-cuddly",
        "name": "Bruno",
        "category": "animal",
        "tags": ["bear", "cuddly", "forest"],
        "body_color": "#8B4513", "belly_color": "#DEB887",
        "animal_type": "bear",
    },
    {
        "id": "penguin-tuxedo",
        "name": "Pip",
        "category": "animal",
        "tags": ["penguin", "antarctic", "cute"],
        "body_color": "#212121", "belly_color": "#FAFAFA",
        "animal_type": "penguin",
    },
    {
        "id": "fox-clever",
        "name": "Roxy",
        "category": "animal",
        "tags": ["fox", "clever", "forest"],
        "body_color": "#E65100", "belly_color": "#FFE0B2",
        "animal_type": "fox",
    },
    # Fantasy
    {
        "id": "knight-brave",
        "name": "Sir Lancelot",
        "category": "fantasy",
        "tags": ["knight", "armor", "brave"],
        "skin": "#FFDAB9", "hair": "#5C3317", "shirt": "#9E9E9E", "pants": "#757575",
        "hair_style": "neat",
        "armor": True,
    },
    {
        "id": "fairy-sparkle",
        "name": "Twinkle",
        "category": "fantasy",
        "tags": ["fairy", "magic", "wings"],
        "skin": "#FFE0BD", "hair": "#FFD700", "shirt": "#E1BEE7", "pants": "#CE93D8",
        "hair_style": "long",
        "wings": True,
    },
    {
        "id": "robot-helper",
        "name": "Bolt",
        "category": "fantasy",
        "tags": ["robot", "sci-fi", "helper"],
        "body_color": "#78909C", "accent_color": "#00E5FF",
        "robot": True,
    },
    {
        "id": "alien-friendly",
        "name": "Zorp",
        "category": "fantasy",
        "tags": ["alien", "space", "friendly"],
        "skin": "#81C784", "shirt": "#7C4DFF", "pants": "#4527A0",
        "hair_style": "none",
        "antenna": True,
    },
    {
        "id": "wizard-wise",
        "name": "Merlin",
        "category": "fantasy",
        "tags": ["wizard", "magic", "wise"],
        "skin": "#FFDAB9", "hair": "#BDBDBD", "shirt": "#311B92", "pants": "#1A237E",
        "hair_style": "long",
        "hat": "wizard",
    },
    {
        "id": "superhero-star",
        "name": "Nova",
        "category": "fantasy",
        "tags": ["superhero", "cape", "powerful"],
        "skin": "#DEB887", "hair": "#1A1A1A", "shirt": "#D32F2F", "pants": "#1565C0",
        "hair_style": "spiky",
        "cape": True,
    },
    # 3D Characters
    {
        "id": "3d-boy-pixar",
        "name": "Max",
        "category": "3d",
        "tags": ["child", "pixar", "3d", "cute"],
        "skin": "#FFDAB9", "hair": "#8B4513", "shirt": "#42A5F5", "pants": "#1E88E5",
        "hair_style": "spiky",
        "style_3d": "pixar",
    },
    {
        "id": "3d-girl-pixar",
        "name": "Bella",
        "category": "3d",
        "tags": ["child", "pixar", "3d", "cute"],
        "skin": "#FFE0BD", "hair": "#D84315", "shirt": "#EC407A", "pants": "#AB47BC",
        "hair_style": "ponytail",
        "style_3d": "pixar",
    },
    {
        "id": "3d-man-clay",
        "name": "Gus",
        "category": "3d",
        "tags": ["adult", "clay", "3d", "claymation"],
        "skin": "#E8C4A0", "hair": "#5D4037", "shirt": "#FF8F00", "pants": "#6D4C41",
        "hair_style": "flat",
        "style_3d": "clay",
    },
    {
        "id": "3d-woman-clay",
        "name": "Dot",
        "category": "3d",
        "tags": ["adult", "clay", "3d", "claymation"],
        "skin": "#FFDAB9", "hair": "#F44336", "shirt": "#66BB6A", "pants": "#558B2F",
        "hair_style": "bun",
        "style_3d": "clay",
    },
    {
        "id": "3d-warrior-lowpoly",
        "name": "Kael",
        "category": "3d",
        "tags": ["warrior", "lowpoly", "3d", "geometric"],
        "skin": "#DEB887", "hair": "#37474F", "shirt": "#78909C", "pants": "#455A64",
        "hair_style": "short",
        "style_3d": "lowpoly",
        "armor": True,
    },
    {
        "id": "3d-monster-friendly",
        "name": "Gloop",
        "category": "3d",
        "tags": ["monster", "3d", "friendly", "cute"],
        "body_color": "#7E57C2", "accent_color": "#B39DDB",
        "style_3d": "pixar",
        "monster": True,
    },
    {
        "id": "3d-dino-clay",
        "name": "Rex",
        "category": "3d",
        "tags": ["dinosaur", "clay", "3d", "cute"],
        "body_color": "#4CAF50", "belly_color": "#C8E6C9",
        "style_3d": "clay",
        "dino": True,
    },
    {
        "id": "3d-astronaut",
        "name": "Stella",
        "category": "3d",
        "tags": ["astronaut", "space", "3d", "sci-fi"],
        "skin": "#C68642", "hair": "#1A1A1A", "shirt": "#ECEFF1", "pants": "#CFD8DC",
        "hair_style": "short",
        "style_3d": "pixar",
        "helmet": True,
    },
]


def hex_to_rgb(hex_color: str):
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def darken(color_hex: str, factor: float = 0.7):
    r, g, b = hex_to_rgb(color_hex)
    return (int(r * factor), int(g * factor), int(b * factor), 255)


def draw_humanoid(char: dict, width: int = 600, height: int = 800) -> Image.Image:
    """Draw a simple cartoon humanoid character."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    skin = hex_to_rgb(char["skin"]) + (255,)
    hair_color = hex_to_rgb(char.get("hair", "#333333")) + (255,)
    shirt_color = hex_to_rgb(char["shirt"]) + (255,)
    pants_color = hex_to_rgb(char["pants"]) + (255,)
    shoe_color = (60, 60, 60, 255)
    outline = (40, 40, 40, 255)

    cx = width // 2  # Center x

    # --- Cape (behind body) ---
    if char.get("cape"):
        cape_color = (180, 0, 0, 255)
        d.polygon([
            (cx - 80, 200), (cx + 80, 200),
            (cx + 100, 620), (cx - 100, 620),
        ], fill=cape_color)

    # --- Legs ---
    leg_top = 480
    leg_bottom = 700
    leg_width = 40
    # Left leg
    d.rectangle([cx - 60, leg_top, cx - 60 + leg_width, leg_bottom], fill=pants_color, outline=outline, width=2)
    # Right leg
    d.rectangle([cx + 20, leg_top, cx + 20 + leg_width, leg_bottom], fill=pants_color, outline=outline, width=2)

    # --- Shoes ---
    d.ellipse([cx - 70, leg_bottom - 10, cx - 15, leg_bottom + 25], fill=shoe_color)
    d.ellipse([cx + 15, leg_bottom - 10, cx + 70, leg_bottom + 25], fill=shoe_color)

    # --- Body / Shirt ---
    body_top = 230
    body_bottom = 500
    if char.get("armor"):
        armor_color = hex_to_rgb(char["shirt"]) + (255,)
        d.rounded_rectangle([cx - 85, body_top, cx + 85, body_bottom], radius=15, fill=armor_color, outline=outline, width=3)
        # Armor details
        d.line([(cx, body_top + 20), (cx, body_bottom - 20)], fill=darken(char["shirt"], 0.8), width=3)
        d.line([(cx - 60, body_top + 80), (cx + 60, body_top + 80)], fill=darken(char["shirt"], 0.8), width=3)
    else:
        d.rounded_rectangle([cx - 85, body_top, cx + 85, body_bottom], radius=15, fill=shirt_color, outline=outline, width=2)

    # --- Arms ---
    arm_top = 250
    arm_bottom = 420
    arm_width = 35
    # Left arm
    d.rounded_rectangle([cx - 120, arm_top, cx - 120 + arm_width, arm_bottom], radius=10, fill=shirt_color, outline=outline, width=2)
    # Right arm
    d.rounded_rectangle([cx + 85, arm_top, cx + 85 + arm_width, arm_bottom], radius=10, fill=shirt_color, outline=outline, width=2)

    # Hands
    d.ellipse([cx - 130, arm_bottom - 5, cx - 95, arm_bottom + 30], fill=skin)
    d.ellipse([cx + 95, arm_bottom - 5, cx + 130, arm_bottom + 30], fill=skin)

    # --- Head ---
    head_cx, head_cy = cx, 150
    head_rx, head_ry = 70, 80
    d.ellipse([head_cx - head_rx, head_cy - head_ry, head_cx + head_rx, head_cy + head_ry], fill=skin, outline=outline, width=2)

    # --- Neck ---
    d.rectangle([cx - 20, 210, cx + 20, 250], fill=skin)

    # --- Hair ---
    hs = char.get("hair_style", "neat")
    if hs == "spiky":
        for dx in range(-50, 60, 20):
            d.polygon([
                (head_cx + dx - 12, head_cy - 60),
                (head_cx + dx + 12, head_cy - 60),
                (head_cx + dx, head_cy - 100),
            ], fill=hair_color)
        d.ellipse([head_cx - 70, head_cy - 80, head_cx + 70, head_cy - 30], fill=hair_color)
    elif hs == "long":
        d.ellipse([head_cx - 75, head_cy - 85, head_cx + 75, head_cy - 20], fill=hair_color)
        # Side hair
        d.rectangle([head_cx - 75, head_cy - 40, head_cx - 55, head_cy + 80], fill=hair_color)
        d.rectangle([head_cx + 55, head_cy - 40, head_cx + 75, head_cy + 80], fill=hair_color)
    elif hs == "ponytail":
        d.ellipse([head_cx - 72, head_cy - 85, head_cx + 72, head_cy - 25], fill=hair_color)
        # Ponytail
        d.ellipse([head_cx + 50, head_cy - 60, head_cx + 110, head_cy + 20], fill=hair_color)
    elif hs == "braids":
        d.ellipse([head_cx - 72, head_cy - 85, head_cx + 72, head_cy - 25], fill=hair_color)
        # Two braids
        d.rectangle([head_cx - 65, head_cy - 20, head_cx - 50, head_cy + 90], fill=hair_color)
        d.rectangle([head_cx + 50, head_cy - 20, head_cx + 65, head_cy + 90], fill=hair_color)
        d.ellipse([head_cx - 70, head_cy + 80, head_cx - 45, head_cy + 105], fill=hair_color)
        d.ellipse([head_cx + 45, head_cy + 80, head_cx + 70, head_cy + 105], fill=hair_color)
    elif hs == "bun":
        d.ellipse([head_cx - 72, head_cy - 85, head_cx + 72, head_cy - 25], fill=hair_color)
        d.ellipse([head_cx - 25, head_cy - 110, head_cx + 25, head_cy - 65], fill=hair_color)
    elif hs == "short":
        d.ellipse([head_cx - 72, head_cy - 85, head_cx + 72, head_cy - 20], fill=hair_color)
    elif hs == "flat":
        d.rectangle([head_cx - 68, head_cy - 80, head_cx + 68, head_cy - 40], fill=hair_color)
        d.ellipse([head_cx - 68, head_cy - 85, head_cx + 68, head_cy - 35], fill=hair_color)
    elif hs == "neat":
        d.ellipse([head_cx - 72, head_cy - 85, head_cx + 72, head_cy - 30], fill=hair_color)
        # Side part
        d.rectangle([head_cx - 20, head_cy - 82, head_cx + 60, head_cy - 55], fill=hair_color)
    elif hs == "none":
        pass  # Bald (alien, etc.)

    # --- Eyes ---
    eye_y = head_cy - 5
    eye_offset = 25
    # White
    d.ellipse([head_cx - eye_offset - 15, eye_y - 12, head_cx - eye_offset + 15, eye_y + 12], fill=(255, 255, 255, 255))
    d.ellipse([head_cx + eye_offset - 15, eye_y - 12, head_cx + eye_offset + 15, eye_y + 12], fill=(255, 255, 255, 255))
    # Pupil
    d.ellipse([head_cx - eye_offset - 7, eye_y - 7, head_cx - eye_offset + 7, eye_y + 7], fill=(30, 30, 30, 255))
    d.ellipse([head_cx + eye_offset - 7, eye_y - 7, head_cx + eye_offset + 7, eye_y + 7], fill=(30, 30, 30, 255))
    # Shine
    d.ellipse([head_cx - eye_offset - 2, eye_y - 6, head_cx - eye_offset + 4, eye_y - 1], fill=(255, 255, 255, 255))
    d.ellipse([head_cx + eye_offset - 2, eye_y - 6, head_cx + eye_offset + 4, eye_y - 1], fill=(255, 255, 255, 255))

    # --- Glasses ---
    if char.get("glasses"):
        d.ellipse([head_cx - eye_offset - 20, eye_y - 17, head_cx - eye_offset + 20, eye_y + 17], outline=(60, 60, 60, 255), width=3)
        d.ellipse([head_cx + eye_offset - 20, eye_y - 17, head_cx + eye_offset + 20, eye_y + 17], outline=(60, 60, 60, 255), width=3)
        d.line([(head_cx - 5, eye_y), (head_cx + 5, eye_y)], fill=(60, 60, 60, 255), width=3)

    # --- Mouth ---
    mouth_y = head_cy + 30
    d.arc([head_cx - 20, mouth_y - 5, head_cx + 20, mouth_y + 15], 0, 180, fill=(180, 60, 60, 255), width=3)

    # --- Nose ---
    nose_y = head_cy + 12
    d.ellipse([head_cx - 5, nose_y, head_cx + 5, nose_y + 8], fill=darken(char["skin"], 0.85))

    # --- Hat ---
    if char.get("hat") == "chef":
        d.ellipse([head_cx - 60, head_cy - 140, head_cx + 60, head_cy - 50], fill=(255, 255, 255, 255), outline=outline, width=2)
        d.rectangle([head_cx - 65, head_cy - 80, head_cx + 65, head_cy - 65], fill=(255, 255, 255, 255), outline=outline, width=2)
    elif char.get("hat") == "wizard":
        d.polygon([
            (head_cx, head_cy - 180),
            (head_cx - 70, head_cy - 60),
            (head_cx + 70, head_cy - 60),
        ], fill=hex_to_rgb(char["shirt"]) + (255,), outline=outline, width=2)
        # Stars on hat
        star_color = (255, 215, 0, 255)
        d.ellipse([head_cx - 10, head_cy - 130, head_cx + 10, head_cy - 110], fill=star_color)
        d.ellipse([head_cx + 15, head_cy - 100, head_cx + 30, head_cy - 85], fill=star_color)

    # --- Wings (fairy) ---
    if char.get("wings"):
        wing_color = (200, 180, 255, 150)
        # Left wing
        d.ellipse([cx - 170, 200, cx - 80, 380], fill=wing_color, outline=(180, 160, 235, 200), width=2)
        # Right wing
        d.ellipse([cx + 80, 200, cx + 170, 380], fill=wing_color, outline=(180, 160, 235, 200), width=2)

    # --- Antenna (alien) ---
    if char.get("antenna"):
        d.line([(head_cx - 20, head_cy - 75), (head_cx - 30, head_cy - 120)], fill=darken(char["skin"], 0.8), width=4)
        d.line([(head_cx + 20, head_cy - 75), (head_cx + 30, head_cy - 120)], fill=darken(char["skin"], 0.8), width=4)
        d.ellipse([head_cx - 40, head_cy - 135, head_cx - 20, head_cy - 115], fill=(255, 200, 0, 255))
        d.ellipse([head_cx + 20, head_cy - 135, head_cx + 40, head_cy - 115], fill=(255, 200, 0, 255))

    return img


def draw_animal(char: dict, width: int = 600, height: int = 800) -> Image.Image:
    """Draw a simple cartoon animal character."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    body_color = hex_to_rgb(char["body_color"]) + (255,)
    belly_color = hex_to_rgb(char["belly_color"]) + (255,)
    outline = (40, 40, 40, 255)
    cx = width // 2
    animal = char["animal_type"]

    if animal == "dog":
        # Body
        d.ellipse([cx - 100, 280, cx + 100, 530], fill=body_color, outline=outline, width=2)
        # Belly
        d.ellipse([cx - 60, 330, cx + 60, 510], fill=belly_color)
        # Head
        d.ellipse([cx - 80, 100, cx + 80, 280], fill=body_color, outline=outline, width=2)
        # Ears (floppy)
        d.ellipse([cx - 100, 80, cx - 40, 200], fill=darken(char["body_color"], 0.8))
        d.ellipse([cx + 40, 80, cx + 100, 200], fill=darken(char["body_color"], 0.8))
        # Snout
        d.ellipse([cx - 35, 190, cx + 35, 250], fill=belly_color, outline=outline, width=2)
        # Nose
        d.ellipse([cx - 12, 195, cx + 12, 215], fill=(30, 30, 30, 255))
        # Legs
        d.rounded_rectangle([cx - 70, 490, cx - 30, 680], radius=15, fill=body_color, outline=outline, width=2)
        d.rounded_rectangle([cx + 30, 490, cx + 70, 680], radius=15, fill=body_color, outline=outline, width=2)
        # Paws
        d.ellipse([cx - 80, 660, cx - 25, 710], fill=body_color, outline=outline, width=2)
        d.ellipse([cx + 25, 660, cx + 80, 710], fill=body_color, outline=outline, width=2)
        # Tail
        d.arc([cx + 60, 350, cx + 160, 450], 180, 360, fill=body_color, width=15)

    elif animal == "rabbit":
        # Body
        d.ellipse([cx - 90, 300, cx + 90, 540], fill=body_color, outline=outline, width=2)
        # Belly
        d.ellipse([cx - 55, 340, cx + 55, 510], fill=belly_color)
        # Head
        d.ellipse([cx - 70, 140, cx + 70, 310], fill=body_color, outline=outline, width=2)
        # Long ears
        d.ellipse([cx - 55, 10, cx - 15, 190], fill=body_color, outline=outline, width=2)
        d.ellipse([cx - 45, 30, cx - 25, 170], fill=(255, 180, 180, 255))
        d.ellipse([cx + 15, 10, cx + 55, 190], fill=body_color, outline=outline, width=2)
        d.ellipse([cx + 25, 30, cx + 45, 170], fill=(255, 180, 180, 255))
        # Nose
        d.ellipse([cx - 8, 230, cx + 8, 245], fill=(255, 150, 150, 255))
        # Whiskers
        d.line([(cx - 50, 240), (cx - 15, 238)], fill=outline, width=2)
        d.line([(cx - 48, 250), (cx - 15, 245)], fill=outline, width=2)
        d.line([(cx + 50, 240), (cx + 15, 238)], fill=outline, width=2)
        d.line([(cx + 48, 250), (cx + 15, 245)], fill=outline, width=2)
        # Legs
        d.ellipse([cx - 80, 500, cx - 20, 680], fill=body_color, outline=outline, width=2)
        d.ellipse([cx + 20, 500, cx + 80, 680], fill=body_color, outline=outline, width=2)
        # Feet
        d.ellipse([cx - 90, 640, cx - 15, 710], fill=body_color, outline=outline, width=2)
        d.ellipse([cx + 15, 640, cx + 90, 710], fill=body_color, outline=outline, width=2)

    elif animal == "bear":
        # Body
        d.ellipse([cx - 110, 280, cx + 110, 560], fill=body_color, outline=outline, width=2)
        # Belly
        d.ellipse([cx - 70, 330, cx + 70, 530], fill=belly_color)
        # Head
        d.ellipse([cx - 90, 90, cx + 90, 290], fill=body_color, outline=outline, width=2)
        # Ears (round)
        d.ellipse([cx - 95, 70, cx - 45, 130], fill=body_color, outline=outline, width=2)
        d.ellipse([cx - 80, 80, cx - 55, 118], fill=darken(char["body_color"], 0.7))
        d.ellipse([cx + 45, 70, cx + 95, 130], fill=body_color, outline=outline, width=2)
        d.ellipse([cx + 55, 80, cx + 80, 118], fill=darken(char["body_color"], 0.7))
        # Snout
        d.ellipse([cx - 40, 185, cx + 40, 250], fill=belly_color, outline=outline, width=2)
        # Nose
        d.ellipse([cx - 15, 195, cx + 15, 220], fill=(30, 30, 30, 255))
        # Arms
        d.rounded_rectangle([cx - 140, 300, cx - 95, 480], radius=20, fill=body_color, outline=outline, width=2)
        d.rounded_rectangle([cx + 95, 300, cx + 140, 480], radius=20, fill=body_color, outline=outline, width=2)
        # Legs
        d.rounded_rectangle([cx - 80, 520, cx - 30, 690], radius=15, fill=body_color, outline=outline, width=2)
        d.rounded_rectangle([cx + 30, 520, cx + 80, 690], radius=15, fill=body_color, outline=outline, width=2)
        # Paws
        d.ellipse([cx - 90, 665, cx - 20, 720], fill=body_color, outline=outline, width=2)
        d.ellipse([cx + 20, 665, cx + 90, 720], fill=body_color, outline=outline, width=2)

    elif animal == "penguin":
        # Body
        d.ellipse([cx - 90, 200, cx + 90, 550], fill=body_color, outline=outline, width=2)
        # Belly (white)
        d.ellipse([cx - 55, 250, cx + 55, 520], fill=belly_color)
        # Head
        d.ellipse([cx - 70, 80, cx + 70, 240], fill=body_color, outline=outline, width=2)
        # Beak
        d.polygon([(cx, 175), (cx - 20, 200), (cx + 20, 200)], fill=(255, 165, 0, 255), outline=outline, width=2)
        # Wings/flippers
        d.ellipse([cx - 120, 260, cx - 70, 450], fill=body_color, outline=outline, width=2)
        d.ellipse([cx + 70, 260, cx + 120, 450], fill=body_color, outline=outline, width=2)
        # Feet
        d.ellipse([cx - 70, 530, cx - 10, 580], fill=(255, 165, 0, 255), outline=outline, width=2)
        d.ellipse([cx + 10, 530, cx + 70, 580], fill=(255, 165, 0, 255), outline=outline, width=2)

    elif animal == "fox":
        # Body
        d.ellipse([cx - 95, 300, cx + 95, 530], fill=body_color, outline=outline, width=2)
        # Belly
        d.ellipse([cx - 55, 340, cx + 55, 510], fill=belly_color)
        # Head
        d.ellipse([cx - 80, 110, cx + 80, 310], fill=body_color, outline=outline, width=2)
        # Pointy ears
        d.polygon([(cx - 65, 130), (cx - 75, 40), (cx - 25, 110)], fill=body_color, outline=outline, width=2)
        d.polygon([(cx - 55, 110), (cx - 65, 55), (cx - 35, 110)], fill=belly_color)
        d.polygon([(cx + 65, 130), (cx + 75, 40), (cx + 25, 110)], fill=body_color, outline=outline, width=2)
        d.polygon([(cx + 55, 110), (cx + 65, 55), (cx + 35, 110)], fill=belly_color)
        # Snout (white)
        d.ellipse([cx - 40, 200, cx + 40, 270], fill=belly_color, outline=outline, width=2)
        # Nose
        d.ellipse([cx - 10, 210, cx + 10, 230], fill=(30, 30, 30, 255))
        # Legs
        d.rounded_rectangle([cx - 65, 490, cx - 25, 670], radius=12, fill=body_color, outline=outline, width=2)
        d.rounded_rectangle([cx + 25, 490, cx + 65, 670], radius=12, fill=body_color, outline=outline, width=2)
        # Paws (dark)
        d.ellipse([cx - 75, 650, cx - 20, 700], fill=(40, 40, 40, 255))
        d.ellipse([cx + 20, 650, cx + 75, 700], fill=(40, 40, 40, 255))
        # Tail (bushy)
        d.ellipse([cx + 50, 380, cx + 170, 480], fill=body_color, outline=outline, width=2)
        d.ellipse([cx + 110, 400, cx + 175, 470], fill=belly_color)

    # Eyes (shared for all animals)
    eye_y = 170 if animal != "penguin" else 150
    if animal == "bear":
        eye_y = 165
    elif animal == "rabbit":
        eye_y = 210
    eye_offset = 30

    d.ellipse([cx - eye_offset - 12, eye_y - 12, cx - eye_offset + 12, eye_y + 12],
              fill=(255, 255, 255, 255), outline=outline, width=2)
    d.ellipse([cx + eye_offset - 12, eye_y - 12, cx + eye_offset + 12, eye_y + 12],
              fill=(255, 255, 255, 255), outline=outline, width=2)
    d.ellipse([cx - eye_offset - 6, eye_y - 6, cx - eye_offset + 6, eye_y + 6], fill=(30, 30, 30, 255))
    d.ellipse([cx + eye_offset - 6, eye_y - 6, cx + eye_offset + 6, eye_y + 6], fill=(30, 30, 30, 255))
    # Shine
    d.ellipse([cx - eye_offset - 1, eye_y - 5, cx - eye_offset + 4, eye_y - 1], fill=(255, 255, 255, 255))
    d.ellipse([cx + eye_offset - 1, eye_y - 5, cx + eye_offset + 4, eye_y - 1], fill=(255, 255, 255, 255))

    # Mouth (smile)
    mouth_y = eye_y + 55
    if animal == "penguin":
        mouth_y = eye_y + 40
    d.arc([cx - 15, mouth_y - 5, cx + 15, mouth_y + 10], 0, 180, fill=outline, width=2)

    return img


def draw_robot(char: dict, width: int = 600, height: int = 800) -> Image.Image:
    """Draw a simple cartoon robot character."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    body_color = hex_to_rgb(char["body_color"]) + (255,)
    accent = hex_to_rgb(char["accent_color"]) + (255,)
    outline = (40, 40, 40, 255)
    cx = width // 2

    # Antenna
    d.rectangle([cx - 4, 30, cx + 4, 80], fill=(180, 180, 180, 255))
    d.ellipse([cx - 12, 15, cx + 12, 45], fill=accent)

    # Head (rectangular)
    d.rounded_rectangle([cx - 70, 80, cx + 70, 220], radius=15, fill=body_color, outline=outline, width=2)

    # Eyes (screens)
    d.rounded_rectangle([cx - 50, 110, cx - 10, 160], radius=5, fill=(20, 20, 30, 255), outline=accent, width=2)
    d.rounded_rectangle([cx + 10, 110, cx + 50, 160], radius=5, fill=(20, 20, 30, 255), outline=accent, width=2)
    # Eye glow
    d.ellipse([cx - 38, 122, cx - 22, 148], fill=accent)
    d.ellipse([cx + 22, 122, cx + 38, 148], fill=accent)

    # Mouth (LED strip)
    d.rounded_rectangle([cx - 35, 175, cx + 35, 195], radius=5, fill=(20, 20, 30, 255), outline=accent, width=1)
    for i in range(5):
        d.ellipse([cx - 28 + i * 14, 180, cx - 22 + i * 14, 190], fill=accent)

    # Neck
    d.rectangle([cx - 20, 220, cx + 20, 260], fill=(140, 140, 140, 255), outline=outline, width=2)

    # Body
    d.rounded_rectangle([cx - 95, 260, cx + 95, 500], radius=15, fill=body_color, outline=outline, width=2)
    # Chest panel
    d.rounded_rectangle([cx - 60, 290, cx + 60, 400], radius=10, fill=(60, 60, 70, 255), outline=accent, width=2)
    # Chest light
    d.ellipse([cx - 15, 320, cx + 15, 350], fill=accent)
    # Panel buttons
    d.ellipse([cx - 40, 365, cx - 25, 380], fill=(200, 60, 60, 255))
    d.ellipse([cx - 8, 365, cx + 8, 380], fill=(60, 200, 60, 255))
    d.ellipse([cx + 25, 365, cx + 40, 380], fill=(60, 60, 200, 255))

    # Arms
    d.rounded_rectangle([cx - 130, 280, cx - 95, 440], radius=10, fill=(140, 140, 150, 255), outline=outline, width=2)
    d.rounded_rectangle([cx + 95, 280, cx + 130, 440], radius=10, fill=(140, 140, 150, 255), outline=outline, width=2)
    # Claws/hands
    d.rounded_rectangle([cx - 140, 430, cx - 90, 470], radius=8, fill=body_color, outline=outline, width=2)
    d.rounded_rectangle([cx + 90, 430, cx + 140, 470], radius=8, fill=body_color, outline=outline, width=2)

    # Legs
    d.rounded_rectangle([cx - 60, 500, cx - 25, 660], radius=10, fill=(140, 140, 150, 255), outline=outline, width=2)
    d.rounded_rectangle([cx + 25, 500, cx + 60, 660], radius=10, fill=(140, 140, 150, 255), outline=outline, width=2)

    # Feet
    d.rounded_rectangle([cx - 75, 650, cx - 15, 700], radius=10, fill=body_color, outline=outline, width=2)
    d.rounded_rectangle([cx + 15, 650, cx + 75, 700], radius=10, fill=body_color, outline=outline, width=2)

    return img


def lighten(color_hex: str, factor: float = 1.3):
    r, g, b = hex_to_rgb(color_hex)
    return (min(255, int(r * factor)), min(255, int(g * factor)), min(255, int(b * factor)), 255)


def draw_3d_humanoid(char: dict, width: int = 600, height: int = 800) -> Image.Image:
    """Draw a 3D-style cartoon humanoid (Pixar/clay/lowpoly look) with shading and highlights."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    skin = hex_to_rgb(char["skin"]) + (255,)
    skin_shadow = darken(char["skin"], 0.75)
    skin_highlight = lighten(char["skin"], 1.15)
    hair_color = hex_to_rgb(char.get("hair", "#333333")) + (255,)
    shirt_color = hex_to_rgb(char["shirt"]) + (255,)
    shirt_shadow = darken(char["shirt"], 0.7)
    shirt_highlight = lighten(char["shirt"], 1.2)
    pants_color = hex_to_rgb(char["pants"]) + (255,)
    pants_shadow = darken(char["pants"], 0.7)
    outline = (30, 30, 30, 255)
    style = char.get("style_3d", "pixar")

    cx = width // 2
    # 3D characters are rounder/chunkier
    outline_w = 3 if style == "lowpoly" else 2

    # --- Legs (chunky) ---
    leg_top = 470
    leg_bottom = 690
    leg_w = 50 if style == "clay" else 45
    # Left leg
    d.rounded_rectangle([cx - 65, leg_top, cx - 65 + leg_w, leg_bottom], radius=18, fill=pants_color, outline=outline, width=outline_w)
    d.rounded_rectangle([cx - 65, leg_top, cx - 65 + leg_w // 2, leg_bottom - 20], radius=12, fill=pants_shadow)
    # Right leg
    d.rounded_rectangle([cx + 15, leg_top, cx + 15 + leg_w, leg_bottom], radius=18, fill=pants_color, outline=outline, width=outline_w)
    d.rounded_rectangle([cx + 15 + leg_w // 2, leg_top, cx + 15 + leg_w, leg_bottom - 20], radius=12, fill=pants_shadow)

    # Shoes (chunky rounded)
    shoe = (70, 60, 55, 255)
    shoe_hi = (100, 90, 85, 255)
    d.rounded_rectangle([cx - 80, leg_bottom - 15, cx - 15, leg_bottom + 25], radius=14, fill=shoe, outline=outline, width=outline_w)
    d.ellipse([cx - 70, leg_bottom - 12, cx - 30, leg_bottom + 5], fill=shoe_hi)
    d.rounded_rectangle([cx + 10, leg_bottom - 15, cx + 75, leg_bottom + 25], radius=14, fill=shoe, outline=outline, width=outline_w)
    d.ellipse([cx + 20, leg_bottom - 12, cx + 60, leg_bottom + 5], fill=shoe_hi)

    # --- Body (round/chunky torso) ---
    body_top = 220
    body_bottom = 490
    if char.get("armor"):
        armor_c = shirt_color
        armor_s = shirt_shadow
        armor_h = shirt_highlight
        d.rounded_rectangle([cx - 95, body_top, cx + 95, body_bottom], radius=25, fill=armor_c, outline=outline, width=outline_w)
        # Shadow on left
        d.rounded_rectangle([cx - 95, body_top + 10, cx - 40, body_bottom - 10], radius=20, fill=armor_s)
        # Highlight on right
        d.rounded_rectangle([cx + 20, body_top + 20, cx + 70, body_top + 100], radius=15, fill=armor_h)
        # Belt
        d.rectangle([cx - 95, body_bottom - 40, cx + 95, body_bottom - 25], fill=darken(char["pants"], 0.6))
    elif char.get("helmet"):
        # Spacesuit body
        d.rounded_rectangle([cx - 100, body_top, cx + 100, body_bottom], radius=30, fill=shirt_color, outline=outline, width=outline_w)
        d.rounded_rectangle([cx - 100, body_top + 10, cx - 30, body_bottom - 10], radius=20, fill=shirt_shadow)
        d.rounded_rectangle([cx + 10, body_top + 20, cx + 65, body_top + 90], radius=15, fill=shirt_highlight)
        # Chest panel
        d.rounded_rectangle([cx - 40, body_top + 50, cx + 40, body_top + 120], radius=10, fill=(200, 200, 210, 255), outline=outline, width=1)
        # Buttons
        d.ellipse([cx - 15, body_top + 70, cx - 5, body_top + 80], fill=(60, 200, 60, 255))
        d.ellipse([cx + 5, body_top + 70, cx + 15, body_top + 80], fill=(200, 60, 60, 255))
    else:
        d.rounded_rectangle([cx - 95, body_top, cx + 95, body_bottom], radius=25, fill=shirt_color, outline=outline, width=outline_w)
        # Shadow side
        d.rounded_rectangle([cx - 95, body_top + 10, cx - 40, body_bottom - 10], radius=20, fill=shirt_shadow)
        # Highlight
        d.rounded_rectangle([cx + 20, body_top + 20, cx + 65, body_top + 90], radius=15, fill=shirt_highlight)

    # --- Arms (chunky, rounded) ---
    arm_top = 240
    arm_bottom = 420
    arm_w = 42 if style == "clay" else 38
    d.rounded_rectangle([cx - 130, arm_top, cx - 130 + arm_w, arm_bottom], radius=16, fill=shirt_color, outline=outline, width=outline_w)
    d.rounded_rectangle([cx - 130, arm_top + 5, cx - 130 + arm_w // 2, arm_bottom - 10], radius=10, fill=shirt_shadow)
    d.rounded_rectangle([cx + 90, arm_top, cx + 90 + arm_w, arm_bottom], radius=16, fill=shirt_color, outline=outline, width=outline_w)
    d.rounded_rectangle([cx + 90 + arm_w // 2, arm_top + 5, cx + 90 + arm_w, arm_bottom - 10], radius=10, fill=shirt_shadow)

    # Hands (round)
    d.ellipse([cx - 140, arm_bottom - 5, cx - 100, arm_bottom + 35], fill=skin, outline=outline, width=outline_w)
    d.ellipse([cx - 135, arm_bottom, cx - 115, arm_bottom + 15], fill=skin_highlight)
    d.ellipse([cx + 100, arm_bottom - 5, cx + 140, arm_bottom + 35], fill=skin, outline=outline, width=outline_w)
    d.ellipse([cx + 110, arm_bottom, cx + 130, arm_bottom + 15], fill=skin_highlight)

    # --- Head (big, round — 3D characters have large heads) ---
    head_cx, head_cy = cx, 140
    head_rx, head_ry = 80, 90
    d.ellipse([head_cx - head_rx, head_cy - head_ry, head_cx + head_rx, head_cy + head_ry], fill=skin, outline=outline, width=outline_w)
    # Cheek shadows
    d.ellipse([head_cx - head_rx + 5, head_cy, head_cx - head_rx + 35, head_cy + 40], fill=skin_shadow)
    d.ellipse([head_cx + head_rx - 35, head_cy, head_cx + head_rx - 5, head_cy + 40], fill=skin_shadow)
    # Forehead highlight
    d.ellipse([head_cx - 30, head_cy - head_ry + 10, head_cx + 30, head_cy - head_ry + 50], fill=skin_highlight)

    # Helmet (if astronaut)
    if char.get("helmet"):
        d.ellipse([head_cx - head_rx - 15, head_cy - head_ry - 15, head_cx + head_rx + 15, head_cy + head_ry + 15],
                  outline=(180, 180, 190, 255), width=6)
        # Visor reflection
        d.ellipse([head_cx - 50, head_cy - 50, head_cx + 50, head_cy + 30],
                  fill=(180, 220, 255, 60), outline=(160, 200, 240, 100), width=2)

    # --- Neck ---
    d.rectangle([cx - 22, 210, cx + 22, 240], fill=skin)

    # --- Hair (same styles, but thicker) ---
    hs = char.get("hair_style", "neat")
    if hs == "spiky":
        for dx in range(-55, 65, 18):
            d.polygon([
                (head_cx + dx - 14, head_cy - 65),
                (head_cx + dx + 14, head_cy - 65),
                (head_cx + dx, head_cy - 110),
            ], fill=hair_color)
        d.ellipse([head_cx - 78, head_cy - 90, head_cx + 78, head_cy - 30], fill=hair_color)
    elif hs == "ponytail":
        d.ellipse([head_cx - 80, head_cy - 95, head_cx + 80, head_cy - 25], fill=hair_color)
        d.ellipse([head_cx + 55, head_cy - 65, head_cx + 120, head_cy + 25], fill=hair_color)
    elif hs == "bun":
        d.ellipse([head_cx - 80, head_cy - 95, head_cx + 80, head_cy - 25], fill=hair_color)
        d.ellipse([head_cx - 28, head_cy - 120, head_cx + 28, head_cy - 70], fill=hair_color)
    elif hs == "flat":
        d.rounded_rectangle([head_cx - 76, head_cy - 90, head_cx + 76, head_cy - 40], radius=15, fill=hair_color)
    elif hs == "short":
        d.ellipse([head_cx - 80, head_cy - 95, head_cx + 80, head_cy - 20], fill=hair_color)
    elif hs == "neat":
        d.ellipse([head_cx - 80, head_cy - 95, head_cx + 80, head_cy - 30], fill=hair_color)

    # --- Eyes (big, expressive — 3D style) ---
    eye_y = head_cy - 5
    eye_offset = 28
    # White (bigger)
    d.ellipse([head_cx - eye_offset - 20, eye_y - 18, head_cx - eye_offset + 20, eye_y + 18], fill=(255, 255, 255, 255), outline=outline, width=1)
    d.ellipse([head_cx + eye_offset - 20, eye_y - 18, head_cx + eye_offset + 20, eye_y + 18], fill=(255, 255, 255, 255), outline=outline, width=1)
    # Iris (colored)
    iris_color = (80, 140, 200, 255)
    d.ellipse([head_cx - eye_offset - 10, eye_y - 10, head_cx - eye_offset + 10, eye_y + 10], fill=iris_color)
    d.ellipse([head_cx + eye_offset - 10, eye_y - 10, head_cx + eye_offset + 10, eye_y + 10], fill=iris_color)
    # Pupil
    d.ellipse([head_cx - eye_offset - 5, eye_y - 5, head_cx - eye_offset + 5, eye_y + 5], fill=(20, 20, 20, 255))
    d.ellipse([head_cx + eye_offset - 5, eye_y - 5, head_cx + eye_offset + 5, eye_y + 5], fill=(20, 20, 20, 255))
    # Big shine
    d.ellipse([head_cx - eye_offset + 2, eye_y - 12, head_cx - eye_offset + 12, eye_y - 4], fill=(255, 255, 255, 255))
    d.ellipse([head_cx + eye_offset + 2, eye_y - 12, head_cx + eye_offset + 12, eye_y - 4], fill=(255, 255, 255, 255))
    # Small shine
    d.ellipse([head_cx - eye_offset - 6, eye_y + 2, head_cx - eye_offset - 1, eye_y + 6], fill=(255, 255, 255, 200))
    d.ellipse([head_cx + eye_offset - 6, eye_y + 2, head_cx + eye_offset - 1, eye_y + 6], fill=(255, 255, 255, 200))

    # Eyebrows
    d.rounded_rectangle([head_cx - eye_offset - 18, eye_y - 28, head_cx - eye_offset + 18, eye_y - 22], radius=3, fill=darken(char.get("hair", "#333333"), 0.8))
    d.rounded_rectangle([head_cx + eye_offset - 18, eye_y - 28, head_cx + eye_offset + 18, eye_y - 22], radius=3, fill=darken(char.get("hair", "#333333"), 0.8))

    # --- Nose (small rounded bump) ---
    nose_y = head_cy + 15
    d.ellipse([head_cx - 8, nose_y, head_cx + 8, nose_y + 12], fill=skin_shadow)
    d.ellipse([head_cx - 4, nose_y + 1, head_cx + 4, nose_y + 7], fill=skin_highlight)

    # --- Mouth (friendly smile) ---
    mouth_y = head_cy + 35
    d.arc([head_cx - 22, mouth_y - 8, head_cx + 22, mouth_y + 12], 0, 180, fill=(160, 50, 50, 255), width=3)
    # Rosy cheeks (3D signature)
    d.ellipse([head_cx - 55, head_cy + 15, head_cx - 35, head_cy + 30], fill=(255, 180, 170, 100))
    d.ellipse([head_cx + 35, head_cy + 15, head_cx + 55, head_cy + 30], fill=(255, 180, 170, 100))

    return img


def draw_3d_monster(char: dict, width: int = 600, height: int = 800) -> Image.Image:
    """Draw a 3D-style friendly monster (Monsters Inc. vibe)."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    body_color = hex_to_rgb(char["body_color"]) + (255,)
    accent = hex_to_rgb(char["accent_color"]) + (255,)
    body_shadow = darken(char["body_color"], 0.7)
    body_highlight = lighten(char["body_color"], 1.2)
    outline = (30, 30, 30, 255)
    cx = width // 2

    # Body (big round blob)
    d.ellipse([cx - 130, 180, cx + 130, 550], fill=body_color, outline=outline, width=3)
    d.ellipse([cx - 130, 200, cx - 30, 500], fill=body_shadow)
    d.ellipse([cx + 10, 220, cx + 80, 350], fill=body_highlight)

    # Belly
    d.ellipse([cx - 70, 300, cx + 70, 500], fill=accent)

    # Legs (short and stubby)
    d.rounded_rectangle([cx - 80, 510, cx - 30, 660], radius=20, fill=body_color, outline=outline, width=3)
    d.rounded_rectangle([cx + 30, 510, cx + 80, 660], radius=20, fill=body_color, outline=outline, width=3)
    # Feet
    d.ellipse([cx - 95, 635, cx - 20, 700], fill=body_color, outline=outline, width=3)
    d.ellipse([cx + 20, 635, cx + 95, 700], fill=body_color, outline=outline, width=3)

    # Arms (short)
    d.rounded_rectangle([cx - 160, 260, cx - 120, 420], radius=18, fill=body_color, outline=outline, width=3)
    d.rounded_rectangle([cx + 120, 260, cx + 160, 420], radius=18, fill=body_color, outline=outline, width=3)
    # Hands
    d.ellipse([cx - 170, 400, cx - 120, 450], fill=body_color, outline=outline, width=2)
    d.ellipse([cx + 120, 400, cx + 170, 450], fill=body_color, outline=outline, width=2)

    # Horns
    horn_color = (255, 200, 100, 255)
    d.polygon([(cx - 50, 200), (cx - 70, 100), (cx - 30, 180)], fill=horn_color, outline=outline, width=2)
    d.polygon([(cx + 50, 200), (cx + 70, 100), (cx + 30, 180)], fill=horn_color, outline=outline, width=2)

    # Eyes (one big, one small — Monsters Inc. style)
    # Big eye
    d.ellipse([cx - 50, 230, cx + 10, 310], fill=(255, 255, 255, 255), outline=outline, width=2)
    d.ellipse([cx - 30, 250, cx, 290], fill=(100, 200, 100, 255))
    d.ellipse([cx - 22, 260, cx - 8, 278], fill=(20, 20, 20, 255))
    d.ellipse([cx - 15, 252, cx - 7, 262], fill=(255, 255, 255, 255))
    # Small eye
    d.ellipse([cx + 20, 250, cx + 65, 300], fill=(255, 255, 255, 255), outline=outline, width=2)
    d.ellipse([cx + 32, 262, cx + 53, 288], fill=(100, 200, 100, 255))
    d.ellipse([cx + 37, 268, cx + 47, 282], fill=(20, 20, 20, 255))
    d.ellipse([cx + 40, 263, cx + 46, 270], fill=(255, 255, 255, 255))

    # Mouth (wide grin with teeth)
    d.arc([cx - 55, 310, cx + 55, 380], 0, 180, fill=outline, width=4)
    # Teeth
    teeth_y = 345
    for tx in range(-35, 40, 18):
        d.polygon([
            (cx + tx, teeth_y - 5),
            (cx + tx + 10, teeth_y - 5),
            (cx + tx + 5, teeth_y + 10),
        ], fill=(255, 255, 255, 255), outline=outline, width=1)

    # Spots
    d.ellipse([cx + 60, 250, cx + 85, 275], fill=accent)
    d.ellipse([cx - 90, 350, cx - 70, 370], fill=accent)
    d.ellipse([cx + 70, 380, cx + 95, 405], fill=accent)

    return img


def draw_3d_dino(char: dict, width: int = 600, height: int = 800) -> Image.Image:
    """Draw a 3D clay-style cute dinosaur."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    body_color = hex_to_rgb(char["body_color"]) + (255,)
    belly_color = hex_to_rgb(char["belly_color"]) + (255,)
    body_shadow = darken(char["body_color"], 0.7)
    body_highlight = lighten(char["body_color"], 1.2)
    outline = (30, 30, 30, 255)
    cx = width // 2

    # Tail
    d.ellipse([cx + 60, 380, cx + 200, 480], fill=body_color, outline=outline, width=2)
    d.ellipse([cx + 140, 390, cx + 210, 440], fill=body_shadow)
    # Spines on tail
    for tx in range(80, 180, 30):
        d.polygon([
            (cx + tx, 380), (cx + tx + 15, 380), (cx + tx + 8, 355),
        ], fill=darken(char["body_color"], 0.6))

    # Body (round, upright)
    d.ellipse([cx - 110, 220, cx + 110, 560], fill=body_color, outline=outline, width=3)
    d.ellipse([cx - 110, 240, cx - 20, 520], fill=body_shadow)
    d.ellipse([cx + 10, 260, cx + 70, 380], fill=body_highlight)

    # Belly
    d.ellipse([cx - 65, 300, cx + 65, 520], fill=belly_color)

    # Legs (stubby)
    d.rounded_rectangle([cx - 75, 520, cx - 25, 670], radius=22, fill=body_color, outline=outline, width=3)
    d.rounded_rectangle([cx + 25, 520, cx + 75, 670], radius=22, fill=body_color, outline=outline, width=3)
    # Feet
    d.ellipse([cx - 90, 645, cx - 15, 710], fill=body_color, outline=outline, width=2)
    d.ellipse([cx + 15, 645, cx + 90, 710], fill=body_color, outline=outline, width=2)
    # Toes
    for fx in [-70, -52, -34]:
        d.ellipse([cx + fx, 680, cx + fx + 15, 710], fill=body_shadow)
    for fx in [30, 48, 66]:
        d.ellipse([cx + fx, 680, cx + fx + 15, 710], fill=body_shadow)

    # Arms (tiny T-rex arms)
    d.rounded_rectangle([cx - 120, 310, cx - 90, 400], radius=12, fill=body_color, outline=outline, width=2)
    d.rounded_rectangle([cx + 90, 310, cx + 120, 400], radius=12, fill=body_color, outline=outline, width=2)

    # Head
    d.ellipse([cx - 80, 80, cx + 80, 260], fill=body_color, outline=outline, width=3)
    d.ellipse([cx - 80, 100, cx - 20, 240], fill=body_shadow)
    d.ellipse([cx, 100, cx + 50, 170], fill=body_highlight)

    # Spines on head/back
    for sx, sy in [(-15, 65), (5, 55), (25, 65)]:
        d.polygon([
            (cx + sx, sy), (cx + sx + 20, sy), (cx + sx + 10, sy - 30),
        ], fill=darken(char["body_color"], 0.6))

    # Eyes (big cute)
    eye_y = 150
    d.ellipse([cx - 45, eye_y - 20, cx - 5, eye_y + 20], fill=(255, 255, 255, 255), outline=outline, width=2)
    d.ellipse([cx + 5, eye_y - 20, cx + 45, eye_y + 20], fill=(255, 255, 255, 255), outline=outline, width=2)
    # Iris
    d.ellipse([cx - 32, eye_y - 10, cx - 12, eye_y + 10], fill=(80, 60, 40, 255))
    d.ellipse([cx + 12, eye_y - 10, cx + 32, eye_y + 10], fill=(80, 60, 40, 255))
    # Pupil
    d.ellipse([cx - 26, eye_y - 5, cx - 18, eye_y + 5], fill=(20, 20, 20, 255))
    d.ellipse([cx + 18, eye_y - 5, cx + 26, eye_y + 5], fill=(20, 20, 20, 255))
    # Shine
    d.ellipse([cx - 20, eye_y - 14, cx - 12, eye_y - 6], fill=(255, 255, 255, 255))
    d.ellipse([cx + 22, eye_y - 14, cx + 30, eye_y - 6], fill=(255, 255, 255, 255))

    # Nostrils
    d.ellipse([cx - 15, 195, cx - 5, 207], fill=body_shadow)
    d.ellipse([cx + 5, 195, cx + 15, 207], fill=body_shadow)

    # Smile
    d.arc([cx - 30, 210, cx + 30, 245], 0, 180, fill=outline, width=3)
    # Rosy cheeks
    d.ellipse([cx - 60, 185, cx - 40, 200], fill=(255, 180, 170, 80))
    d.ellipse([cx + 40, 185, cx + 60, 200], fill=(255, 180, 170, 80))

    return img


def generate_character(char: dict, output_dir: Path) -> bool:
    """Generate a character PNG and process it."""
    char_dir = output_dir / char["id"]

    # Skip if already exists
    if (char_dir / "texture.png").exists():
        print(f"  Already exists, skipping")
        return True

    char_dir.mkdir(parents=True, exist_ok=True)

    # Draw the character
    if char.get("monster"):
        img = draw_3d_monster(char)
    elif char.get("dino"):
        img = draw_3d_dino(char)
    elif char.get("animal_type"):
        img = draw_animal(char)
    elif char.get("robot"):
        img = draw_robot(char)
    elif char.get("style_3d"):
        img = draw_3d_humanoid(char)
    else:
        img = draw_humanoid(char)

    # Save raw PNG
    raw_path = char_dir / "raw_generated.png"
    img.save(str(raw_path), "PNG")

    # Process with prepare-character.py
    prepare_script = Path(os.path.dirname(__file__)) / "prepare-character.py"
    result = subprocess.run(
        [sys.executable, str(prepare_script), "--input", str(raw_path), "--output", str(char_dir)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"  Processing failed: {result.stderr}")
        # Clean up
        raw_path.unlink(missing_ok=True)
        return False

    # Clean up raw file
    raw_path.unlink(missing_ok=True)
    return True


def main():
    output_dir = Path(os.path.dirname(os.path.dirname(__file__))) / "public" / "characters"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load existing manifest
    manifest_path = output_dir / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)
    else:
        manifest = {"characters": [], "categories": ["boy", "girl", "man", "woman", "animal", "fantasy", "3d"]}

    existing_ids = {c["id"] for c in manifest["characters"]}

    successful = 0
    new_count = 0
    for i, char in enumerate(CHARACTERS, 1):
        char_id = char["id"]
        print(f"[{i}/{len(CHARACTERS)}] {char['name']} ({char_id})")

        if char_id in existing_ids:
            print(f"  Already in manifest, skipping")
            successful += 1
            continue

        if generate_character(char, output_dir):
            manifest["characters"].append({
                "id": char_id,
                "name": char["name"],
                "category": char["category"],
                "tags": char["tags"],
                "thumbnail": f"/characters/{char_id}/thumbnail.png",
                "texturePath": f"/characters/{char_id}/texture.png",
                "isPreRigged": True,
            })
            successful += 1
            new_count += 1
            print(f"  Done!")
        else:
            print(f"  Failed!")

    # Save manifest
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nDone! {new_count} new characters generated ({successful} total in manifest)")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
