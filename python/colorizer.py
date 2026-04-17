import io
import math
import base64
import numpy as np
import cv2
from PIL import Image


def sample_voxel_colors(
    fg_image: Image.Image,
    mask: np.ndarray,
    resolution: int,
) -> np.ndarray:
    """
    Sample the foreground image's RGB color for each pixel in the mask grid.

    Returns an (H, W, 3) uint8 array aligned with the mask.
    Pixels where mask is False get [128, 128, 128] as default.
    """
    if fg_image.mode == 'RGBA':
        bg = Image.new('RGB', fg_image.size, (255, 255, 255))
        bg.paste(fg_image, mask=fg_image.split()[3])
        rgb = np.array(bg)
    else:
        rgb = np.array(fg_image.convert("RGB"))
    h_orig, w_orig = rgb.shape[:2]
    h_mask, w_mask = mask.shape

    if h_orig >= w_orig:
        new_h = resolution
        new_w = max(1, int(w_orig * resolution / h_orig))
    else:
        new_w = resolution
        new_h = max(1, int(h_orig * resolution / w_orig))

    resized_rgb = cv2.resize(rgb, (new_w, new_h), interpolation=cv2.INTER_AREA)

    print(f"[DEBUG] Original image shape: {rgb.shape}, Resized: {resized_rgb.shape}")
    print(f"[DEBUG] Sample colors from resized image: {resized_rgb[0, 0]}, {resized_rgb[min(5, new_h-1), min(5, new_w-1)]}")

    color_grid = np.full((h_mask, w_mask, 3), 128, dtype=np.uint8)
    y_off = (resolution - new_h) // 2
    x_off = (resolution - new_w) // 2
    color_grid[y_off:y_off + new_h, x_off:x_off + new_w] = resized_rgb

    return color_grid


def build_texture_atlas(
    color_grid: np.ndarray,
    mask: np.ndarray,
    tile_size: int = 4,
) -> tuple[Image.Image, dict[tuple[int, int, int], int], int]:
    """
    Build a square texture atlas from unique colors in the masked area.
    Each unique color gets a tile_size x tile_size block in the atlas.

    Returns:
      - atlas: a PIL Image (NxN pixels)
      - color_to_index: maps (R,G,B) -> linear index in the atlas
      - atlas_size: side length of the square atlas in tiles (not pixels)
    """
    h, w = mask.shape
    unique_colors: dict[tuple[int, int, int], int] = {}

    for row in range(h):
        for col in range(w):
            if mask[row, col]:
                c = (int(color_grid[row, col, 0]),
                     int(color_grid[row, col, 1]),
                     int(color_grid[row, col, 2]))
                if c not in unique_colors:
                    unique_colors[c] = len(unique_colors)

    if not unique_colors:
        unique_colors[(128, 128, 128)] = 0

    n = len(unique_colors)
    atlas_size = max(1, math.ceil(math.sqrt(n)))

    pixel_size = atlas_size * tile_size
    atlas = Image.new("RGB", (pixel_size, pixel_size), (0, 0, 0))

    for color, idx in unique_colors.items():
        tile_x = idx % atlas_size
        tile_y = idx // atlas_size

        for dy in range(tile_size):
            for dx in range(tile_size):
                px = tile_x * tile_size + dx
                py = tile_y * tile_size + dy
                atlas.putpixel((px, py), color)

    return atlas, unique_colors, atlas_size


def atlas_to_base64(atlas: Image.Image) -> str:
    buf = io.BytesIO()
    atlas.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def get_uv_for_color(
    color: tuple[int, int, int],
    color_to_index: dict[tuple[int, int, int], int],
    atlas_size: int,
    tile_size: int = 4,
) -> list[float]:
    """
    Get the Minecraft UV coordinates [u1, v1, u2, v2] for a color in the atlas.
    MC UV space is [0, 16] mapped to [0, 1] of the texture.
    """
    idx = color_to_index.get(color, 0)
    tile_x = idx % atlas_size
    tile_y = idx // atlas_size

    tile_uv_size = 16.0 / atlas_size
    u1 = tile_x * tile_uv_size
    v1 = tile_y * tile_uv_size
    u2 = u1 + tile_uv_size
    v2 = v1 + tile_uv_size

    return [round(u1, 4), round(v1, 4), round(u2, 4), round(v2, 4)]


def get_voxel_color_hex(
    color_grid: np.ndarray,
    mask: np.ndarray,
) -> dict[tuple[int, int], str]:
    """
    For each voxel position (col, mc_y) return a hex color string.
    Key is (x, y) in voxel grid space (col, h-1-row).
    """
    h, w = mask.shape
    result: dict[tuple[int, int], str] = {}

    for row in range(h):
        for col in range(w):
            if mask[row, col]:
                r, g, b = int(color_grid[row, col, 0]), int(color_grid[row, col, 1]), int(color_grid[row, col, 2])
                mc_y = h - 1 - row
                result[(col, mc_y)] = f"#{r:02x}{g:02x}{b:02x}"

    return result
