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

import json
import os
import sys
from statistics import median

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "images", "v5")
OUT = os.path.join(ROOT, "assets", "images", "v5cut")
# Written into the COMMITTED derived tree, because the UI needs it and the
# intermediate `v5cut/` is not committed.
ARTBOARDS = os.path.join(ROOT, "assets", "images", "v5w", ".artboards.json")

# How uniform the border ring has to be before we believe it is a backdrop
# rather than part of the picture. A photograph never passes this.
FLAT_FRACTION = 0.92
FLAT_TOLERANCE = 26

# Families that are photographs. Even if a photo happened to have a plain wall
# behind the subject, cutting it out is not what we want.
# Photographs. Even a product shot on a near-black studio sweep must keep
# its backdrop — the lighting IS the shot.
# `product-` too: these are studio packshots on a white sweep. The sweep IS the
# photograph — lifting it leaves the goods floating next to the lifestyle shots
# they sit beside in the reference grid, which is the one place they have to
# look like a matched set.
NEVER_CUT = ("people/", "scenes/", "video/", "product-")

# Illustrations whose art is painted INTO the backdrop, so there is no clean
# subject to lift: the paper plane's motion trail, the analytics panel's glass,
# and the smoke behind the chat bubbles are all soft gradients that only read
# against lavender. Cut out they become grey smears. These keep their backdrop
# and are presented on a deliberate artboard instead — see `Artwork`.
SKIP_CUTOUT = {
    "editorial/blog-omnichannel.png",
    "editorial/blog-analytics.png",
    "editorial/blog-ai-conversations.png",
    # The whole customer-story set. These three are glass-and-glow renders —
    # translucent panels, soft floor shadows, a gradient arrow that fades into
    # the plate. The matte cannot separate any of that from the backdrop it was
    # painted onto: story-2 came back 55% semi-transparent, story-1 kept a torn
    # shadow beside the chart, and story-3 kept a straight-edged slab of plate
    # down its right side. All three keep their backdrop and are mounted as
    # artboards instead — a frame you can see is honest, a half-removed one is
    # not.
    "editorial/customer-story-1.png",
    "editorial/customer-story-2.png",
    "editorial/customer-story-3.png",
    # And finally the rest of the editorial set. Cutting these worked
    # technically — clean edges, no residue — but the result was a page where
    # half the cards carried a mounted picture and half had art floating on the
    # dark surface, and the floating ones read as unfinished. Uniformity beats
    # a technically-better matte: every editorial illustration is now mounted
    # the same way. Nothing is cut out any more, which is the honest outcome of
    # the experiment rather than a pipeline kept alive for its own sake.
    "editorial/blog-local-growth.png",
    "editorial/guide-playbook-cover.png",
    "editorial/guide-playbook-spread.png",
    "editorial/resource-automation.png",
    "editorial/resource-deliverability.png",
    "editorial/template-library.png",

    # Reviewed as a contact sheet on a dark card, which is the only way these
    # faults show: a torn element, a shadow ghost, a slab of leftover plate, a
    # feathered wisp. Each one is attached to the subject, so no despeckle can
    # reach it — the matte simply could not separate this art from its backdrop.
    "editorial/blog-cart-recovery.png",
    "editorial/blog-social-dms.png",
    "editorial/press-kit.png",
    "editorial/resource-getting-started.png",
    "editorial/resource-storefront.png",
    "editorial/security-shield.png",
}


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


def drop_shadow_islands(im, colour, max_area=0.02, colour_reach=150, min_area=0.0012):
    """Delete the leftover smudges a matte leaves behind.

    Neither method removes the soft drop shadow cleanly: the colour key cannot
    (a shadow IS the backdrop, darkened) and the matting model often leaves a
    torn fragment of it. What survives is a small island floating clear of the
    subject — the grey smear under the chart, the smudge trailing the paper
    plane — and on a dark plate it is the first thing you see.

    A size test alone would also eat the art, because these illustrations are
    full of deliberate small floating pieces (stray cubes, separate speech
    bubbles). So size is only the trigger; the decision is COLOUR. A leftover
    shadow is still the backdrop hue, while a real floating element is saturated
    or white — far from the lavender it was rendered on.

    `min_area` is the exception to that: below about a tenth of a percent of the
    subject, a piece is a speck rather than an element, whatever colour it is.
    The deliverability envelope kept fifteen of them — invisible on the light
    theme and unmistakable specks once the card went dark — because each one
    happened to carry a saturated pixel and passed the colour test. The
    deliberate floating sphere in that same illustration is 0.35%, three times
    this floor, so the art survives.
    """
    rgb = np.asarray(im.convert("RGB")).astype(np.int16)
    alpha = np.asarray(im.getchannel("A")).copy()

    # Faint residue first, before anything else looks at the image.
    #
    # A matte does not only leave solid crumbs — it leaves *ghosts*: patches at
    # 10-50% alpha that are invisible on a light page and unmistakable smudges
    # once the card behind them goes dark. They never reach full opacity, which
    # is exactly what separates them from the artwork: a deliberate floating
    # element is solid somewhere. Labelling on `alpha > 127` cannot see them at
    # all, which is why fifteen of them survived on the deliverability envelope.
    faint, faint_count = ndimage.label(alpha > 12)
    if faint_count > 1:
        faint_sizes = ndimage.sum(alpha > 12, faint, range(1, faint_count + 1))
        biggest = faint_sizes.max()
        peaks = ndimage.maximum(alpha, faint, range(1, faint_count + 1))
        for index in range(1, faint_count + 1):
            if faint_sizes[index - 1] < biggest * max_area and peaks[index - 1] < 200:
                alpha[faint == index] = 0

    solid = alpha > 127
    if not solid.any():
        return im

    labels, count = ndimage.label(solid)
    if count <= 1:
        return im

    sizes = ndimage.sum(solid, labels, range(1, count + 1))
    largest = sizes.max()
    base = np.array(colour, dtype=np.int16)
    removed = 0

    for index in range(1, count + 1):
        size = sizes[index - 1]
        if size >= largest * max_area:
            continue
        piece = labels == index
        if size < largest * min_area:
            alpha[piece] = 0
            removed += 1
            continue
        mean = rgb[piece].mean(axis=0)
        if np.abs(mean - base).sum() < colour_reach:
            alpha[piece] = 0
            removed += 1

    if removed:
        out = im.copy()
        out.putalpha(Image.fromarray(alpha, mode="L"))
        return out
    return im


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
    artboards = []
    for full, rel in walk(SRC):
        if rel.startswith(NEVER_CUT):
            kept += 1
            if listing:
                print(f"  skip  {rel:52} photograph")
            continue

        if rel in SKIP_CUTOUT:
            kept += 1
            artboards.append(os.path.splitext(rel)[0])
            print(f"  keep  {rel:52} art depends on its backdrop")
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

        result = drop_shadow_islands(result, colour)
        result = trim_transparent(result)
        target = os.path.join(OUT, os.path.splitext(rel)[0] + ".png")
        os.makedirs(os.path.dirname(target), exist_ok=True)
        result.save(target)
        cut += 1
        print(f"  cut   {rel:52} kept {retained:.0%}  -> {result.size[0]}x{result.size[1]}")

    if not listing:
        os.makedirs(os.path.dirname(ARTBOARDS), exist_ok=True)
        with open(ARTBOARDS, "w", encoding="utf-8") as handle:
            json.dump(sorted(artboards), handle, indent=2)

    print(f"\n{cut} cut out, {kept} left as-is, {len(artboards)} kept as artboards")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
