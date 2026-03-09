# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import io
from PIL import Image, ImageOps


def to_png_bytes(img: Image.Image) -> bytes:
    """
    Encode a Pillow image to PNG bytes.
    - Keeps output format consistent for HTTP responses
    - Uses Pillow's PNG encoder with optimize enabled
    """
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

def greyscale_bytes_from_upstream(content: bytes) -> bytes:
    """
    Convert upstream image bytes to greyscale PNG bytes.
    - Converts to luminance (L) then RGB for browser compatibility
    - Returns PNG bytes regardless of input format
    """
    with Image.open(io.BytesIO(content)) as im:
        # Convert with luminance
        gray = ImageOps.grayscale(im)
        # Convert back to RGB for browser compatibility
        rgb = gray.convert("RGB")
        return to_png_bytes(rgb)
