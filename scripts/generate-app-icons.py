#!/usr/bin/env python3
"""
Generate the Android launcher icons and the iOS AppIcon set from the ColdBoot
source art in assets/coldboot-assets/.

    python3 scripts/generate-app-icons.py

Requires Pillow (`pip install pillow`). One-off; re-run only if the source art
in assets/coldboot-assets/png/ changes.

Two things this handles that a naive resize does not:

1. iOS AppIcon images may not have an alpha channel, and must be a full square.
   The source tile (png/light/icon-1024.png) is a rounded rect with transparent
   corners, so App Store validation would reject it as-is. We rebuild the
   backing gradient by sampling the tile's own per-row colour and extending it
   into the corners, then flatten to RGB. The seam is exact because the fill
   colour is read out of the tile rather than guessed.

2. The Android adaptive foreground is masked by the launcher: of the 108dp
   canvas only the middle 72dp is guaranteed visible. To make the launcher icon
   read at the same proportions as the brand tile -- where the mark occupies
   72.3% of the tile -- the mark must be 0.723 * 72 = 52dp tall on the 108dp
   canvas, i.e. 48.1% of the canvas. Scaling the mark to fill the canvas would
   get it cropped.
"""

import pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/coldboot-assets/png"
TILE_LIGHT = SRC / "light/icon-1024.png"
MARK_INK = SRC / "mark/mark-ink-1024.png"

# Fraction of the 108dp adaptive canvas the mark should occupy vertically.
# See note 2 in the module docstring.
ADAPTIVE_MARK_HEIGHT = 0.481

ANDROID_RES = ROOT / "android/app/src/main/res"
# density -> (adaptive foreground px, legacy launcher px)
DENSITIES = {
    "mdpi": (108, 48),
    "hdpi": (162, 72),
    "xhdpi": (216, 96),
    "xxhdpi": (324, 144),
    "xxxhdpi": (432, 192),
}

IOS_APPICON = ROOT / "ios/TOAST/Images.xcassets/AppIcon.appiconset"
IOS_SIZES = {
    "icon-20x20@1x.png": 20,
    "icon-20x20@2x.png": 40,
    "icon-20x20@3x.png": 60,
    "icon-29x29@1x.png": 29,
    "icon-29x29@2x.png": 58,
    "icon-29x29@3x.png": 87,
    "icon-40x40@1x.png": 40,
    "icon-40x40@2x.png": 80,
    "icon-40x40@3x.png": 120,
    "icon-60x60@2x.png": 120,
    "icon-60x60@3x.png": 180,
    "icon-76x76@1x.png": 76,
    "icon-76x76@2x.png": 152,
    "icon-83.5x83.5@2x.png": 167,
    "icon-1024x1024@1x.png": 1024,
}


def squared_tile(tile: Image.Image) -> Image.Image:
    """Fill the tile's transparent rounded corners by extending its own
    per-row gradient colour outward, then flatten to opaque RGB."""
    tile = tile.convert("RGBA")
    w, h = tile.size
    px = tile.load()
    bg = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(bg)
    for y in range(h):
        colour = None
        for x in range(w):  # leftmost fully-opaque pixel gives this row's colour
            if px[x, y][3] == 255:
                colour = px[x, y][:3]
                break
        if colour is None:  # fully transparent row: reuse nearest known colour
            colour = px[w // 2, min(max(y, 0), h - 1)][:3]
        draw.line([(0, y), (w, y)], fill=colour + (255,))
    bg.alpha_composite(tile)
    return bg.convert("RGB")  # no alpha: required for App Store submission


def centred_mark(canvas: int, height_fraction: float) -> Image.Image:
    """The ink mark, trimmed to its own bounds, scaled to a fraction of the
    canvas height and centred on a transparent square."""
    mark = Image.open(MARK_INK).convert("RGBA")
    mark = mark.crop(mark.getchannel("A").getbbox())
    target_h = round(canvas * height_fraction)
    target_w = round(mark.width * target_h / mark.height)
    mark = mark.resize((target_w, target_h), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(mark, ((canvas - target_w) // 2, (canvas - target_h) // 2), mark)
    return out


def circular(img: Image.Image) -> Image.Image:
    """Mask an image to a circle, for the legacy ic_launcher_round asset."""
    img = img.convert("RGBA")
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse([0, 0, img.width - 1, img.height - 1], fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def main() -> None:
    tile = Image.open(TILE_LIGHT).convert("RGBA")
    square = squared_tile(tile)
    written = []

    for density, (fg_px, legacy_px) in DENSITIES.items():
        outdir = ANDROID_RES / f"mipmap-{density}"
        outdir.mkdir(parents=True, exist_ok=True)

        fg = centred_mark(fg_px, ADAPTIVE_MARK_HEIGHT)
        fg.save(outdir / "ic_launcher_foreground.png")
        written.append(outdir / "ic_launcher_foreground.png")

        legacy = tile.resize((legacy_px, legacy_px), Image.LANCZOS)
        legacy.save(outdir / "ic_launcher.png")
        written.append(outdir / "ic_launcher.png")

        circular(legacy).save(outdir / "ic_launcher_round.png")
        written.append(outdir / "ic_launcher_round.png")

    IOS_APPICON.mkdir(parents=True, exist_ok=True)
    for filename, px in IOS_SIZES.items():
        square.resize((px, px), Image.LANCZOS).save(IOS_APPICON / filename)
        written.append(IOS_APPICON / filename)

    for path in written:
        print(path.relative_to(ROOT))
    print(f"\n{len(written)} files written.")


if __name__ == "__main__":
    main()
