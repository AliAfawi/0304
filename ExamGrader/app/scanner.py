"""Turn a phone photo of an exam page into a clean "scan" (סריקה).

1. Rotate by the EXIF orientation.
2. Find the sheet of paper (largest 4-corner shape) and straighten it
   (perspective correction), so the background and table disappear.
3. Remove shadows and uneven lighting: divide by a blurred copy of the page,
   then stretch the contrast. Handwriting stays grey-scale (not pure black
   and white) so faint pencil is not lost.

Needs OpenCV (opencv-python-headless). Without it, photos are only rotated
and converted to grey-scale.
"""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageOps

MAX_SIDE = 2400        # output resolution: enough for handwriting, small enough to send
DETECT_SIDE = 900      # working size for finding the page
MIN_PAGE_AREA = 0.25   # the page must cover at least a quarter of the photo


@dataclass
class ScanResult:
    data: bytes            # JPEG bytes
    cropped: bool          # the page outline was found and straightened
    width: int
    height: int


def _order_corners(pts):
    import numpy as np

    pts = pts.reshape(4, 2).astype("float32")
    s, d = pts.sum(axis=1), np.diff(pts, axis=1).ravel()
    return np.array([pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]], dtype="float32")


def _find_page(gray):
    """Corners of the sheet in `gray` (small copy), or None."""
    import cv2
    import numpy as np

    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)
    edges = cv2.dilate(edges, np.ones((5, 5), np.uint8), iterations=2)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    area_min = MIN_PAGE_AREA * gray.shape[0] * gray.shape[1]
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        if cv2.contourArea(c) < area_min:
            break
        approx = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
        if len(approx) == 4 and cv2.isContourConvex(approx):
            return _order_corners(approx)
    return None


def _warp(img, corners):
    import cv2
    import numpy as np

    tl, tr, br, bl = corners
    w = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    h = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
    dst = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype="float32")
    m = cv2.getPerspectiveTransform(corners, dst)
    out = cv2.warpPerspective(img, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    # the detected outline sits on the paper's edge: trim it so no table shows
    t = max(4, int(0.012 * min(w, h)))
    return out[t:h - t, t:w - t] if h > 4 * t and w > 4 * t else out


def _clean(gray):
    """Flatten the lighting and whiten the paper."""
    import cv2
    import numpy as np

    k = max(15, (min(gray.shape) // 25) | 1)
    background = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (k, k)))
    background = cv2.GaussianBlur(background, (k, k), 0)
    flat = cv2.divide(gray, background, scale=255)
    lo, hi = np.percentile(flat, (1, 99))
    if hi - lo < 10:
        return flat
    stretched = np.clip((flat.astype("float32") - lo) * 255.0 / (hi - lo), 0, 255).astype("uint8")
    return stretched


def scan_image(data: bytes) -> ScanResult:
    img = ImageOps.exif_transpose(Image.open(BytesIO(data))).convert("RGB")
    cropped = False
    try:
        import cv2
        import numpy as np
    except ImportError:
        out = ImageOps.autocontrast(img.convert("L"), cutoff=1)
    else:
        rgb = np.array(img)
        gray_full = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        scale = DETECT_SIDE / max(gray_full.shape)
        small = cv2.resize(gray_full, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) \
            if scale < 1 else gray_full
        corners = _find_page(small)
        if corners is not None:
            gray_full = _warp(gray_full, corners / min(scale, 1.0))
            cropped = True
        out = Image.fromarray(_clean(gray_full))
    out.thumbnail((MAX_SIDE, MAX_SIDE))
    buf = BytesIO()
    out.save(buf, "JPEG", quality=82, optimize=True)
    return ScanResult(buf.getvalue(), cropped, out.width, out.height)
