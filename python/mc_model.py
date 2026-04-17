import numpy as np
from typing import Any


def _maximal_rectangle(row_heights: np.ndarray) -> tuple[int, int, int, int]:
    """
    Given a 1D array of histogram bar heights, find the largest rectangle.
    Returns (x_start, x_end, height, area).
    Uses the standard O(n) monotonic stack algorithm.
    """
    n = len(row_heights)
    stack: list[int] = []
    best = (0, 0, 0, 0)

    for i in range(n + 1):
        h = row_heights[i] if i < n else 0
        while stack and row_heights[stack[-1]] > h:
            height = int(row_heights[stack.pop()])
            left = stack[-1] + 1 if stack else 0
            area = height * (i - left)
            if area > best[3]:
                best = (left, i, height, area)
        stack.append(i)

    return best


def greedy_mesh(voxel_grid: np.ndarray) -> list[tuple[tuple[int, int, int], tuple[int, int, int]]]:
    """
    Merge adjacent voxels into large cuboids using a slice-based approach:

    1. For each Z-layer, build a 2D histogram of consecutive Z-depth at each (X, Y)
    2. Use maximal-rectangle to find the biggest XY rectangle that spans Z..Z+depth
    3. Clear those voxels, repeat until the layer is empty
    4. This produces far fewer boxes than naive XYZ expansion, especially at high res

    Falls back to the simple triple-loop greedy for any remaining stragglers.
    """
    grid = voxel_grid.copy()
    sx, sy, sz = grid.shape
    boxes: list[tuple[tuple[int, int, int], tuple[int, int, int]]] = []

    # Phase 1: slice-based maximal rectangle merging along Z
    z = 0
    while z < sz:
        # Build height map: for each (x, y), how many consecutive filled Z-layers
        # starting from z?
        height_map = np.zeros((sx, sy), dtype=np.int32)
        for x in range(sx):
            for y in range(sy):
                if grid[x, y, z]:
                    d = 1
                    while z + d < sz and grid[x, y, z + d]:
                        d += 1
                    height_map[x, y] = d

        # Repeatedly extract the largest rectangle from this height map
        while True:
            # For each column x, build a histogram over y using min-depth
            # We try each possible depth d from 1..max and find best rectangle
            max_possible_depth = int(height_map.max())
            if max_possible_depth == 0:
                break

            best_box = None
            best_volume = 0

            # Try a few depth candidates: powers of 2 + the max
            depth_candidates = set()
            for d in range(1, min(max_possible_depth + 1, 33)):
                depth_candidates.add(d)
            depth_candidates.add(max_possible_depth)

            for depth in sorted(depth_candidates):
                # Binary mask: cells where height_map >= depth
                mask_d = (height_map >= depth)
                if not mask_d.any():
                    continue

                # For each X row, build histogram of consecutive Y-columns
                hist = np.zeros(sy, dtype=np.int32)
                for x in range(sx):
                    for yy in range(sy):
                        hist[yy] = hist[yy] + 1 if mask_d[x, yy] else 0

                    if not hist.any():
                        continue

                    y_start, y_end, x_run, area = _maximal_rectangle(hist)
                    volume = area * depth
                    if volume > best_volume:
                        best_volume = volume
                        x_start = x - x_run + 1
                        best_box = (x_start, x + 1, y_start, y_end, depth)

            if best_box is None or best_volume <= 0:
                break

            x0, x1, y0, y1, d = best_box
            boxes.append(((x0, y0, z), (x1, y1, z + d)))
            grid[x0:x1, y0:y1, z:z + d] = False
            height_map[x0:x1, y0:y1] = 0

        z += 1

    # Phase 2: sweep up any remaining voxels with simple greedy
    for x in range(sx):
        for y in range(sy):
            for zz in range(sz):
                if not grid[x, y, zz]:
                    continue
                ex = x + 1
                while ex < sx and grid[ex, y, zz]:
                    ex += 1
                ey = y + 1
                while ey < sy and np.all(grid[x:ex, ey, zz]):
                    ey += 1
                ez = zz + 1
                while ez < sz and np.all(grid[x:ex, y:ey, ez]):
                    ez += 1
                grid[x:ex, y:ey, zz:ez] = False
                boxes.append(((x, y, zz), (ex, ey, ez)))

    return boxes


def generate_mc_model(
    boxes: list[tuple[tuple[int, int, int], tuple[int, int, int]]],
    grid_shape: tuple[int, ...],
) -> dict[str, Any]:
    """
    Generate a Minecraft 1.12.2 model JSON from merged boxes.
    Scales the model to fit within the [-16, 32] coordinate space,
    centered on (8, 8, 8).
    """
    sx, sy, sz = grid_shape

    max_dim = max(sx, sy, sz)
    scale = 48.0 / max_dim if max_dim > 48 else 1.0

    offset_x = (16 - sx * scale / 2)
    offset_y = (16 - sy * scale / 2)
    offset_z = (16 - sz * scale / 2)

    elements = []
    for (fx, fy, fz), (tx, ty, tz) in boxes:
        f = [
            round(fx * scale + offset_x, 2),
            round(fy * scale + offset_y, 2),
            round(fz * scale + offset_z, 2),
        ]
        t = [
            round(tx * scale + offset_x, 2),
            round(ty * scale + offset_y, 2),
            round(tz * scale + offset_z, 2),
        ]
        if all(abs(t[i] - f[i]) < 0.01 for i in range(3)):
            continue
        elements.append({
            "from": f,
            "to": t,
            "faces": {
                "north": {"texture": "#all"},
                "south": {"texture": "#all"},
                "east":  {"texture": "#all"},
                "west":  {"texture": "#all"},
                "up":    {"texture": "#all"},
                "down":  {"texture": "#all"},
            }
        })

    model: dict[str, Any] = {
        "textures": {
            "all": "blocks/stone",
            "particle": "blocks/stone"
        },
        "elements": elements,
        "display": {
            "thirdperson_righthand": {
                "rotation": [75, 45, 0],
                "translation": [0, 2.5, 0],
                "scale": [0.375, 0.375, 0.375]
            },
            "firstperson_righthand": {
                "rotation": [0, 45, 0],
                "translation": [0, 0, 0],
                "scale": [0.4, 0.4, 0.4]
            },
            "gui": {
                "rotation": [30, 225, 0],
                "translation": [0, 0, 0],
                "scale": [0.625, 0.625, 0.625]
            },
            "ground": {
                "rotation": [0, 0, 0],
                "translation": [0, 3, 0],
                "scale": [0.25, 0.25, 0.25]
            },
            "fixed": {
                "rotation": [0, 0, 0],
                "translation": [0, 0, 0],
                "scale": [0.5, 0.5, 0.5]
            }
        }
    }

    return model


def generate_mc_model_colored(
    boxes: list[tuple[tuple[int, int, int], tuple[int, int, int]]],
    grid_shape: tuple[int, ...],
    color_grid,
    mask,
    color_to_index: dict[tuple[int, int, int], int] | None = None,
    atlas_size: int = 1,
    tile_size: int = 8,
) -> dict[str, Any]:
    """
    Generate a colored Minecraft 1.12.2 model JSON with UV-mapped texture atlas.

    Each merged box samples the average color from the source image,
    looks up that color's position in the atlas, and sets UV coordinates
    on all faces to point to that pixel.
    """
    from colorizer import get_uv_for_color

    sx, sy, sz = grid_shape
    h_mask = mask.shape[0]

    max_dim = max(sx, sy, sz)
    scale = 48.0 / max_dim if max_dim > 48 else 1.0

    offset_x = (16 - sx * scale / 2)
    offset_y = (16 - sy * scale / 2)
    offset_z = (16 - sz * scale / 2)

    elements = []

    for (fx, fy, fz), (tx, ty, tz) in boxes:
        f = [
            round(fx * scale + offset_x, 2),
            round(fy * scale + offset_y, 2),
            round(fz * scale + offset_z, 2),
        ]
        t = [
            round(tx * scale + offset_x, 2),
            round(ty * scale + offset_y, 2),
            round(tz * scale + offset_z, 2),
        ]
        if all(abs(t[i] - f[i]) < 0.01 for i in range(3)):
            continue

        r_sum, g_sum, b_sum, count = 0, 0, 0, 0
        for bx in range(fx, tx):
            for by in range(fy, ty):
                row = h_mask - 1 - by
                if 0 <= row < h_mask and 0 <= bx < color_grid.shape[1]:
                    if mask[row, bx]:
                        r_sum += int(color_grid[row, bx, 0])
                        g_sum += int(color_grid[row, bx, 1])
                        b_sum += int(color_grid[row, bx, 2])
                        count += 1

        if count > 0:
            avg_color = (r_sum // count, g_sum // count, b_sum // count)
        else:
            avg_color = (128, 128, 128)

        if color_to_index and avg_color in color_to_index:
            uv = get_uv_for_color(avg_color, color_to_index, atlas_size, tile_size)
        elif color_to_index:
            min_dist = float("inf")
            closest = list(color_to_index.keys())[0]
            for c in color_to_index:
                d = sum((a - b) ** 2 for a, b in zip(avg_color, c))
                if d < min_dist:
                    min_dist = d
                    closest = c
            uv = get_uv_for_color(closest, color_to_index, atlas_size, tile_size)
        else:
            uv = [0, 0, 16, 16]

        face_data = {"texture": "#tex", "uv": uv}
        elements.append({
            "from": f,
            "to": t,
            "faces": {
                "north": {**face_data},
                "south": {**face_data},
                "east":  {**face_data},
                "west":  {**face_data},
                "up":    {**face_data},
                "down":  {**face_data},
            }
        })

    display = {
        "thirdperson_righthand": {
            "rotation": [75, 45, 0],
            "translation": [0, 2.5, 0],
            "scale": [0.375, 0.375, 0.375]
        },
        "firstperson_righthand": {
            "rotation": [0, 45, 0],
            "translation": [0, 0, 0],
            "scale": [0.4, 0.4, 0.4]
        },
        "gui": {
            "rotation": [30, 225, 0],
            "translation": [0, 0, 0],
            "scale": [0.625, 0.625, 0.625]
        },
        "ground": {
            "rotation": [0, 0, 0],
            "translation": [0, 3, 0],
            "scale": [0.25, 0.25, 0.25]
        },
        "fixed": {
            "rotation": [0, 0, 0],
            "translation": [0, 0, 0],
            "scale": [0.5, 0.5, 0.5]
        }
    }

    return {
        "textures": {
            "tex": "item/model_tex",
            "particle": "item/model_tex",
        },
        "elements": elements,
        "display": display,
    }
