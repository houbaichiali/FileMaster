"""Image conversion, compression and editing (Pillow)."""
import io
from pathlib import Path

from PIL import Image, ImageOps

from app.core.config import get_settings
from app.core.errors import AppError

PIL_FORMAT = {"jpg": "JPEG", "png": "PNG", "webp": "WEBP", "bmp": "BMP", "tiff": "TIFF"}

# level -> (jpeg/webp quality, scale factor, png palette colours)
LEVELS = {
    "low": (90, 1.0, None),
    "medium": (78, 1.0, None),
    "high": (62, 0.85, 256),
    "maximum": (45, 0.7, 64),
}


def load(path: Path) -> Image.Image:
    Image.MAX_IMAGE_PIXELS = get_settings().max_image_pixels
    try:
        img = Image.open(path)
        img.load()
    except Image.DecompressionBombError:
        raise AppError("image_too_large", 413)
    except Exception:
        raise AppError("invalid_image", 422)
    return ImageOps.exif_transpose(img)


def _has_alpha(img: Image.Image) -> bool:
    return img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)


def prepare(img: Image.Image, fmt: str) -> Image.Image:
    if fmt in ("jpg", "bmp"):
        if _has_alpha(img):
            rgba = img.convert("RGBA")
            bg = Image.new("RGB", rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.getchannel("A"))
            return bg
        return img.convert("RGB") if img.mode not in ("RGB", "L") else img
    if fmt == "webp":
        return img.convert("RGBA" if _has_alpha(img) else "RGB")
    if fmt == "png":
        return img if img.mode in ("RGB", "RGBA", "L", "LA") else img.convert("RGBA" if _has_alpha(img) else "RGB")
    return img.convert("RGB") if img.mode in ("P", "CMYK", "I;16") else img  # tiff


def _scaled(img: Image.Image, scale: float) -> Image.Image:
    if scale >= 0.999:
        return img
    return img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)


def encode(img: Image.Image, fmt: str, quality: int = 90, colors: int | None = None) -> bytes:
    buf = io.BytesIO()
    if fmt == "jpg":
        img.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    elif fmt == "webp":
        img.save(buf, "WEBP", quality=quality, method=6)
    elif fmt == "png":
        im = img.quantize(colors=colors, method=Image.Quantize.FASTOCTREE) if colors else img
        im.save(buf, "PNG", optimize=True, compress_level=9)
    elif fmt == "tiff":
        img.save(buf, "TIFF", compression="tiff_adobe_deflate")
    elif fmt == "bmp":
        img.save(buf, "BMP")
    else:
        raise AppError("unsupported_format", 400)
    return buf.getvalue()


def convert(src: Path, out: Path, target: str, quality: int = 92) -> dict:
    img = prepare(load(src), target)
    out.write_bytes(encode(img, target, quality))
    return {"width": img.width, "height": img.height, "quality": quality if target in ("jpg", "webp") else None}


def compress(src: Path, out: Path, fmt: str, level: str, quality: int | None = None,
             max_width: int | None = None, max_height: int | None = None, target_bytes: int | None = None) -> dict:
    if fmt == "bmp":
        raise AppError("compress_not_supported", 422, format="bmp")
    q_preset, scale, colors = LEVELS[level]
    img = prepare(load(src), fmt)
    ratio = 1.0
    if max_width or max_height:
        ratio = min((max_width or 10**9) / img.width, (max_height or 10**9) / img.height, 1.0)
    base = _scaled(img, ratio)
    lossy = fmt in ("jpg", "webp")

    if target_bytes:
        for shrink in (1.0, 0.85, 0.7, 0.55, 0.4, 0.3, 0.2):
            cand = _scaled(base, shrink)
            if lossy:
                if len(encode(cand, fmt, 5)) > target_bytes:
                    continue
                lo, hi, best_q = 5, 95, 5
                while lo <= hi:
                    mid = (lo + hi) // 2
                    if len(encode(cand, fmt, mid)) <= target_bytes:
                        best_q, lo = mid, mid + 1
                    else:
                        hi = mid - 1
                data = encode(cand, fmt, best_q)
                out.write_bytes(data)
                return {"quality": best_q, "scale": round(ratio * shrink, 3), "width": cand.width,
                        "height": cand.height, "target_reached": True}
            else:
                data = encode(cand, fmt, colors=256 if fmt == "png" else None)
                if len(data) <= target_bytes:
                    out.write_bytes(data)
                    return {"scale": round(ratio * shrink, 3), "width": cand.width, "height": cand.height,
                            "target_reached": True}
        cand = _scaled(base, 0.2)
        out.write_bytes(encode(cand, fmt, 5, colors=64 if fmt == "png" else None))
        return {"quality": 5 if lossy else None, "scale": round(ratio * 0.2, 3), "width": cand.width,
                "height": cand.height, "target_reached": False}

    final = _scaled(base, scale)
    q = quality or q_preset
    out.write_bytes(encode(final, fmt, q, colors=colors if fmt == "png" else None))
    return {"quality": q if lossy else None, "scale": round(ratio * scale, 3), "width": final.width,
            "height": final.height, "colors": colors if fmt == "png" else None}


def edit(src: Path, out: Path, fmt: str, crop: dict | None, rotate: float, flip_h: bool, flip_v: bool,
         resize: dict | None, quality: int) -> dict:
    """Order of operations: flip -> rotate (clockwise, canvas expanded) -> crop -> resize."""
    img = load(src)
    if flip_h:
        img = ImageOps.mirror(img)
    if flip_v:
        img = ImageOps.flip(img)
    angle = rotate % 360
    if angle:
        if angle in (90, 180, 270):
            img = img.transpose({90: Image.ROTATE_270, 180: Image.ROTATE_180, 270: Image.ROTATE_90}[int(angle)])
        else:
            img = img.convert("RGBA").rotate(-angle, expand=True, resample=Image.BICUBIC)
    if crop:
        x = max(0, min(int(round(crop["x"])), img.width - 1))
        y = max(0, min(int(round(crop["y"])), img.height - 1))
        w = max(1, min(int(round(crop["width"])), img.width - x))
        h = max(1, min(int(round(crop["height"])), img.height - y))
        img = img.crop((x, y, x + w, y + h))
    if resize:
        rw, rh = resize.get("width"), resize.get("height")
        if rw and not rh:
            rh = max(1, round(img.height * rw / img.width))
        elif rh and not rw:
            rw = max(1, round(img.width * rh / img.height))
        if rw and rh:
            if rw * rh > get_settings().max_image_pixels:
                raise AppError("image_too_large", 413)
            img = img.resize((int(rw), int(rh)), Image.LANCZOS)
    img = prepare(img, fmt)
    out.write_bytes(encode(img, fmt, quality))
    return {"width": img.width, "height": img.height, "quality": quality if fmt in ("jpg", "webp") else None}
