import numpy as np
import cv2
from PIL import Image
from rembg import remove


def remove_background(image: Image.Image) -> Image.Image:
    """Remove background from image using rembg, returning RGBA with transparent bg."""
    return remove(image)


def extract_mask(fg_image: Image.Image, resolution: int) -> np.ndarray:
    """
    Extract a binary mask from the foreground image's alpha channel,
    resized to the target resolution while preserving aspect ratio.
    """
    alpha = np.array(fg_image.split()[-1])

    h, w = alpha.shape
    if h >= w:
        new_h = resolution
        new_w = max(1, int(w * resolution / h))
    else:
        new_w = resolution
        new_h = max(1, int(h * resolution / w))

    resized = cv2.resize(alpha, (new_w, new_h), interpolation=cv2.INTER_AREA)

    _, binary = cv2.threshold(resized, 127, 255, cv2.THRESH_BINARY)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(binary)
    cv2.drawContours(filled, contours, -1, 255, -1)

    padded = np.zeros((resolution, resolution), dtype=np.uint8)
    y_offset = (resolution - new_h) // 2
    x_offset = (resolution - new_w) // 2
    padded[y_offset:y_offset + new_h, x_offset:x_offset + new_w] = filled

    return (padded > 0).astype(np.bool_)
