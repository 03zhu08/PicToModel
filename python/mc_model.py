from __future__ import annotations

import numpy as np
from typing import Any


def greedy_mesh(
    voxel_grid: np.ndarray,
    color_map: dict[tuple[int, int], str] | None = None
) -> list[tuple[tuple[int, int, int], tuple[int, int, int]]]:
    """
    Optimized greedy meshing. In color mode, doesn't restrict merging.
    Per-face UV mapping will handle color differences.
    """
    grid = voxel_grid.copy()
    sx, sy, sz = grid.shape
    boxes: list[tuple[tuple[int, int, int], tuple[int, int, int]]] = []

    for x in range(sx):
        for y in range(sy):
            for z in range(sz):
                if not grid[x, y, z]:
                    continue

                # Expand along all axes without color restrictions
                ex = x + 1
                while ex < sx and grid[ex, y, z]:
                    ex += 1

                ey = y + 1
                while ey < sy and np.all(grid[x:ex, ey, z]):
                    ey += 1

                ez = z + 1
                while ez < sz and np.all(grid[x:ex, y:ey, ez]):
                    ez += 1

                boxes.append(((x, y, z), (ex, ey, ez)))
                grid[x:ex, y:ey, z:ez] = False

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
    # Scale to fit within Blockbench's Y limits (-16 to 31.25 = ~47 total)
    scale = 46.0 / max_dim if max_dim > 46 else 1.0

    # Center on Y=0, but shift up slightly to fit within -16 to 31.25 range
    offset_x = (16 - sx * scale / 2)
    offset_y = -(sy * scale / 2) + 7.5  # Shift up so range is roughly -16 to 31
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


def generate_mc_model_with_cube_faces(
    boxes: list[tuple[tuple[int, int, int], tuple[int, int, int]]],
    grid_shape: tuple[int, ...],
    voxel_grid,
    faces: dict[str, Any],
    resolution: int = 256,
) -> dict[str, Any]:
    """
    Generate a colored Minecraft model using 6 cube face textures.
    Each box face is mapped to the appropriate cube face texture.
    """
    from cube_face_mapper import create_cube_texture_atlas, determine_box_face_mapping, calculate_face_uv

    sx, sy, sz = grid_shape

    max_dim = max(sx, sy, sz)
    scale = 46.0 / max_dim if max_dim > 46 else 1.0

    offset_x = (16 - sx * scale / 2)
    offset_y = -(sy * scale / 2) + 7.5
    offset_z = (16 - sz * scale / 2)

    # Create texture atlas from 6 cube faces
    atlas, uv_map = create_cube_texture_atlas(faces, resolution)
    atlas_width, atlas_height = atlas.size

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

        # Determine which cube face each minecraft face should use
        face_mapping = determine_box_face_mapping((fx, fy, fz), (tx, ty, tz), voxel_grid)

        # Calculate UV for each face
        faces_dict = {}
        for mc_face, cube_face in face_mapping.items():
            if cube_face in uv_map:
                uv = calculate_face_uv(
                    mc_face, (fx, fy, fz), (tx, ty, tz),
                    grid_shape, uv_map, (atlas_width, atlas_height), cube_face
                )
                faces_dict[mc_face] = {"texture": "#tex", "uv": uv}

        elements.append({
            "from": f,
            "to": t,
            "faces": faces_dict
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
        },
        "head": {
            "rotation": [0, 0, 0],
            "translation": [0, 0, 0],
            "scale": [1, 1, 1]
        }
    }

    import io
    import base64
    buf = io.BytesIO()
    atlas.save(buf, format="PNG")
    texture_b64 = base64.b64encode(buf.getvalue()).decode()

    model = {
        "textures": {
            "tex": f"data:image/png;base64,{texture_b64}",
            "particle": "#tex"
        },
        "elements": elements,
        "display": display
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
    Generate a colored Minecraft model (legacy method using 2D color_grid).
    Each face's UV maps to a region in the texture atlas containing all colors for that face.
    """
    sx, sy, sz = grid_shape
    h_mask = mask.shape[0]

    max_dim = max(sx, sy, sz)
    # Scale to fit within Blockbench's Y limits (-16 to 31.25 = ~47 total)
    scale = 46.0 / max_dim if max_dim > 46 else 1.0

    # Center on Y=0, but shift up slightly to fit within -16 to 31.25 range
    offset_x = (16 - sx * scale / 2)
    offset_y = -(sy * scale / 2) + 7.5  # Shift up so range is roughly -16 to 31
    offset_z = (16 - sz * scale / 2)

    # Build a texture atlas that contains the entire color grid
    # Each pixel in the atlas corresponds to a voxel position
    from PIL import Image
    import io
    import base64

    # Create texture from color_grid directly
    texture_height, texture_width = color_grid.shape[:2]
    texture = Image.new("RGB", (texture_width, texture_height))

    for row in range(texture_height):
        for col in range(texture_width):
            if mask[row, col]:
                r = int(color_grid[row, col, 0])
                g = int(color_grid[row, col, 1])
                b = int(color_grid[row, col, 2])
                texture.putpixel((col, row), (r, g, b))

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

        # Calculate UV for each face based on voxel positions
        # UV coordinates are in [0, 16] space
        def voxel_to_uv(vx, vy, width, height):
            """Convert voxel grid position to UV coordinates"""
            u1 = (vx / texture_width) * 16
            v1 = ((h_mask - 1 - vy - height + 1) / texture_height) * 16
            u2 = ((vx + width) / texture_width) * 16
            v2 = ((h_mask - 1 - vy + 1) / texture_height) * 16
            return [round(u1, 4), round(v1, 4), round(u2, 4), round(v2, 4)]

        # Each face maps to its corresponding region in the texture
        width_x = tx - fx
        height_y = ty - fy

        north_uv = voxel_to_uv(fx, fy, width_x, height_y)
        south_uv = voxel_to_uv(fx, fy, width_x, height_y)
        east_uv = voxel_to_uv(fx, fy, 1, height_y)
        west_uv = voxel_to_uv(fx, fy, 1, height_y)
        up_uv = voxel_to_uv(fx, ty-1, width_x, 1)
        down_uv = voxel_to_uv(fx, fy, width_x, 1)

        elements.append({
            "from": f,
            "to": t,
            "faces": {
                "north": {"texture": "#tex", "uv": north_uv},
                "south": {"texture": "#tex", "uv": south_uv},
                "east":  {"texture": "#tex", "uv": east_uv},
                "west":  {"texture": "#tex", "uv": west_uv},
                "up":    {"texture": "#tex", "uv": up_uv},
                "down":  {"texture": "#tex", "uv": down_uv},
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


def rotate_model_elements(
    model: dict[str, Any],
    rx: float,
    ry: float,
    rz: float,
) -> dict[str, Any]:
    """
    Rotate Minecraft model elements around the model center (16, 7.5, 16)
    using Euler angles (degrees, intrinsic ZYX order).
    Returns a new model dict with rotated element coordinates.
    """
    if rx == 0.0 and ry == 0.0 and rz == 0.0:
        return model

    # Build rotation matrix (same as voxelizer._build_rotation_matrix)
    cx, sx = np.cos(np.radians(rx)), np.sin(np.radians(rx))
    cy, sy = np.cos(np.radians(ry)), np.sin(np.radians(ry))
    cz, sz = np.cos(np.radians(rz)), np.sin(np.radians(rz))
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    R = Rz @ Ry @ Rx

    center = np.array([16.0, 7.5, 16.0])

    rotated_elements = []
    for elem in model["elements"]:
        f = np.array(elem["from"], dtype=float)
        t = np.array(elem["to"], dtype=float)

        # All 8 corners of the element box
        corners = np.array([
            [f[0], f[1], f[2]],
            [f[0], f[1], t[2]],
            [f[0], t[1], f[2]],
            [f[0], t[1], t[2]],
            [t[0], f[1], f[2]],
            [t[0], f[1], t[2]],
            [t[0], t[1], f[2]],
            [t[0], t[1], t[2]],
        ])

        # Rotate around model center
        rotated = (corners - center) @ R.T + center
        new_f = np.min(rotated, axis=0)
        new_t = np.max(rotated, axis=0)

        rotated_elements.append({
            **elem,
            "from": [round(float(new_f[0]), 2), round(float(new_f[1]), 2), round(float(new_f[2]), 2)],
            "to": [round(float(new_t[0]), 2), round(float(new_t[1]), 2), round(float(new_t[2]), 2)],
        })

    return {**model, "elements": rotated_elements}
