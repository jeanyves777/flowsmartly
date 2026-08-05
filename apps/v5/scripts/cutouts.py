"""Cuts the flat backdrop off the illustration assets.

    python scripts/cutouts.py            # write assets/images/v5cut/**
    python scripts/cutouts.py --list     # just report what would be cut, and why

WHY
---
The 3D illustrations were produced on a flat lavender backdrop. Dropped into a
page as opaque rectangles they read as pasted-in stock: a glaring light block in
the dark and grey themes, and a hard edge that ignores the layout around it.
Cutting the subject out lets the same asset sit on any theme surface.

THE ORIGINALS ARE NEVER MODIFIED. This only ever writes into `v5cut/`, a
derived tree. Photographs are deliberately left alone — a cut-out photo of a
room is not an improvement, it is a mistake — so the backdrop is detected rather
than assumed, and anything that is not a flat backdrop is skipped.
"""

import os
import sys
from statistics import median

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "images", "v5")
OUT = os.path.join(ROOT, "assets", "images", "v5cut")

# How uniform the border ring has to be before we believe it is a backdrop
# rather than part of the picture. A photograph never passes this.
FLAT_FRACTION = 0.92
FLAT_TOLERANCE = 26

# Families that are photographs. Even if a photo happened to have a plain wall
# behind the subject, cutting it out is not what we want.
# Photographs. Even a product shot on a near-black studio sweep must keep
# its backdrop — the lighting IS the shot.
NEVER_CUT = ("people/", "scenes/", "video/")


def border_pixels(im, step=4):
    w, h = im.size
    px = im.load()
    out = []
    for x in range(0, w, step):
        out.append(px[x, 0])
        out.append(px[x, h - 1])
    for y in range(0, h, step):
        out.append(px[0, y])
        out.append(px[w - 1, y])
    return out


def already_transparent(im):
    """A logo shipped as RGBA has no backdrop to remove — and running a matting
    model over it would eat the mark. Its RGB border also reads as flat black,
    which is exactly the false positive this catches."""
    if im.mode not in ("RGBA", "LA", "P"):
        return False
    alpha = im.convert("RGBA").getchannel("A")
    return alpha.getextrema()[0] < 250


def flat_backdrop(im):
    """(is_flat, colour, uniform_fraction) for the border ring."""
    ring = border_pixels(im.convert("RGB"))
    if not ring:
        return False, None, 0.0
    base = tuple(int(median([p[i] for p in ring])) for i in range(3))
    close = sum(
        1
        for p in ring
        if abs(p[0] - base[0]) + abs(p[1] - base[1]) + abs(p[2] - base[2]) <= FLAT_TOLERANCE * 3
    )
    frac = close / len(ring)
    return frac >= FLAT_FRACTION, base, frac


def flood_alpha(im, colour, tolerance=52):
    """Alpha from connectivity alone: transparent exactly where the image is the
    backdrop colour AND reachable from the edge.

    This can never eat an interior detail however pale it is, which is its whole
    value — but it cannot remove the soft drop shadow either, because a shadow is
    the backdrop colour darkened and there is no colour test that separates that
    from a pale surface lying on the same backdrop. So this is the safe fallback,
    not the preferred result.
    """
    rgb = np.asarray(im.convert("RGB")).astype(np.int16)
    base = np.array(colour, dtype=np.int16)
    dist = np.abs(rgb - base).sum(axis=2)

    labels, _ = ndimage.label(dist <= tolerance)
    edge = np.unique(np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]]))
    edge = edge[edge != 0]
    background = np.isin(labels, edge)

    alpha = np.full(dist.shape, 255, dtype=np.uint8)
    alpha[background] = 0
    return alpha


def key_backdrop(im, colour, tolerance=52, shadow_reach=132):
    """Remove the backdrop by connectivity, not by salience.

    A matting model guesses which object is "the subject", and on
    editorial/blog-analytics it kept a single icon and threw the rest of the
    illustration away. When the backdrop really is one flat colour, the honest
    definition is "everything that is that colour AND reachable from the edge" —
    which can never eat an interior detail, however pale it is.

    The soft drop shadow is the hard part: it is the backdrop colour, darkened.
    So a second, much wider pass fades out only the background-connected pixels
    that sit between the two thresholds, which turns the shadow into a gentle
    ramp to nothing instead of a hard lavender halo.
    """
    rgb = np.asarray(im.convert("RGB")).astype(np.int16)
    base = np.array(colour, dtype=np.int16)
    dist = np.abs(rgb - base).sum(axis=2)

    near = dist <= tolerance
    labels, _ = ndimage.label(near)
    edge = np.unique(
        np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])
    )
    edge = edge[edge != 0]
    background = np.isin(labels, edge)

    # The soft drop shadow: backdrop colour, DARKENED. The "darker" half of that
    # sentence is load-bearing — without it the pass also swallows the pale parts
    # of the subject, and a white book page is within the same colour distance of
    # lavender as its own shadow is. That mistake renders as a book you can see
    # straight through.
    luma = (rgb[:, :, 0] * 299 + rgb[:, :, 1] * 587 + rgb[:, :, 2] * 114) / 1000.0
    base_luma = (int(base[0]) * 299 + int(base[1]) * 587 + int(base[2]) * 114) / 1000.0
    darker = luma <= base_luma - 2

    wide = (dist <= shadow_reach) & darker
    wide_labels, _ = ndimage.label(wide | background)
    keep = np.unique(wide_labels[background])
    keep = keep[keep != 0]
    halo = np.isin(wide_labels, keep) & ~background & darker

    alpha = np.full(dist.shape, 255, dtype=np.float32)
    alpha[background] = 0.0
    # The shadow belongs to the old backdrop, not to the subject, so it goes
    # entirely — the layout draws its own shadow against whatever surface the
    # cutout actually lands on.
    alpha[halo] = 0.0

    out = im.convert("RGBA")
    mask = Image.fromarray(alpha.astype(np.uint8), mode="L")
    # a sub-pixel feather kills the stair-stepping on curved edges
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    out.putalpha(mask)
    return out, float((alpha > 127).mean())


def trim_transparent(im, pad_ratio=0.02):
    """Crop the empty margin the backdrop used to occupy.

    Without this the cutout keeps the original framing, so the subject still
    renders small inside a mostly-empty box and the layout gains nothing.
    """
    bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return im
    pad = int(max(im.size) * pad_ratio)
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(im.width, bbox[2] + pad)
    bottom = min(im.height, bbox[3] + pad)
    return im.crop((left, top, right, bottom))


def walk(dir_, prefix=""):
    out = []
    for name in sorted(os.listdir(dir_)):
        full = os.path.join(dir_, name)
        if os.path.isdir(full):
            out.extend(walk(full, prefix + name + "/"))
        elif name.lower().endswith((".png", ".jpg", ".jpeg")):
            out.append((full, prefix + name))
    return out


def main():
    listing = "--list" in sys.argv
    if not os.path.isdir(SRC):
        print("no source images at", SRC)
        return 1

    session = None
    remove = None
    if not listing:
        from rembg import new_session, remove as rembg_remove

        session = new_session('u2net')
        remove = rembg_remove

    cut = kept = 0
    for full, rel in walk(SRC):
        if rel.startswith(NEVER_CUT):
            kept += 1
            if listing:
                print(f"  skip  {rel:52} photograph")
            continue

        im = Image.open(full)
        if already_transparent(im):
            kept += 1
            if listing:
                print(f"  skip  {rel:52} already has transparency")
            continue

        is_flat, colour, frac = flat_backdrop(im)
        if not is_flat:
            kept += 1
            if listing:
                print(f"  skip  {rel:52} backdrop only {frac:.0%} uniform")
            continue

        if listing:
            print(f"  CUT   {rel:52} flat {colour} at {frac:.0%}")
            cut += 1
            continue

        # Two mattes, and a rule for choosing between them.
        #
        # The matting model gives the better result when it works: it recognises
        # the drop shadow as backdrop, which no colour test can. But it decides
        # what "the subject" is, and on editorial/blog-analytics it kept one icon
        # and discarded the rest of the illustration. So it is used only when it
        # agrees with the colour key about how much picture there is.
        safe = flood_alpha(im, colour)
        safe_area = int((safe > 127).sum())

        matted = remove(im.convert("RGBA"), session=session)
        model = np.asarray(matted.getchannel("A"))
        model_area = int((model > 127).sum())

        # Area alone is not enough. On editorial/blog-analytics the model kept a
        # single compact tile whose AREA passed the ratio test while its EXTENT
        # covered a third of the picture — the rising line chart either side of
        # it was simply gone. So the extent has to agree too.
        def extent(mask):
            box = Image.fromarray((mask > 127).astype(np.uint8) * 255, mode="L").getbbox()
            return (box[2] - box[0], box[3] - box[1]) if box else (0, 0)

        safe_w, safe_h = extent(safe)
        model_w, model_h = extent(model)
        covers = (
            safe_w
            and safe_h
            and model_w >= 0.6 * safe_w
            and model_h >= 0.6 * safe_h
        )

        if safe_area and model_area >= 0.5 * safe_area and covers:
            result, method = matted, "matte"
        else:
            out = im.convert("RGBA")
            out.putalpha(Image.fromarray(safe, mode="L").filter(ImageFilter.GaussianBlur(0.6)))
            result, method = out, "key "
            print(
                f"  note  {rel}: model kept {model_area / max(1, safe_area):.0%} of the picture,"
                " falling back to the colour key (its soft shadow is kept)"
            )

        retained = (np.asarray(result.getchannel("A")) > 127).mean()
        # Kept nearly everything → no backdrop was found. Kept nearly nothing →
        # the subject was eaten. Either way, ship the original rather than junk.
        if retained > 0.97 or retained < 0.01:
            kept += 1
            print(f"  SKIP  {rel} — retained {retained:.0%}, refusing to ship it")
            continue

        result = trim_transparent(result)
        target = os.path.join(OUT, os.path.splitext(rel)[0] + ".png")
        os.makedirs(os.path.dirname(target), exist_ok=True)
        result.save(target)
        cut += 1
        print(f"  cut   {rel:52} kept {retained:.0%}  -> {result.size[0]}x{result.size[1]}")

    print(f"\n{cut} cut out, {kept} left as-is")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
