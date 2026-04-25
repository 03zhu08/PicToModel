from __future__ import annotations

import numpy as np
from scipy import ndimage


def voxelize_mask(
    mask: np.ndarray,
    extrusion_mode: str = "rounded",
    depth_ratio: float = 0.4,
    symmetrical: bool = False,
) -> np.ndarray:
    """
    Convert a 2D binary mask (H x W) into a 3D boolean voxel grid (X x Y x Z).

    Mask axes: row=Y (top-down), col=X (left-right)
    Output: voxel_grid[x, y, z] where Y is up in Minecraft.

    extrusion_mode:
        "flat"    - uniform depth extrusion
        "rounded" - depth varies based on distance from silhouette edge
    depth_ratio:
        fraction of the width used as max depth
    symmetrical:
        if True and extrusion_mode is "rounded", mirror the front to create symmetrical back
    """
    h, w = mask.shape
    max_depth = max(1, int(w * depth_ratio))

    if extrusion_mode == "rounded":
        dist = ndimage.distance_transform_edt(mask)
        max_dist = dist.max() if dist.max() > 0 else 1.0
        normalized_dist = dist / max_dist
        depth_map = (normalized_dist * max_depth).astype(int)
    else:
        depth_map = mask.astype(int) * max_depth

    voxel_grid = np.zeros((w, h, max_depth), dtype=bool)

    for row in range(h):
        for col in range(w):
            if mask[row, col]:
                d = depth_map[row, col]
                mc_y = h - 1 - row

                if symmetrical and extrusion_mode == "rounded":
                    center_z = max_depth / 2.0
                    half_d = d / 2.0

                    front_start = int(max(0, center_z - half_d))
                    front_end = int(center_z)

                    back_start = int(center_z)
                    back_end = int(min(max_depth, center_z + half_d))

                    if front_start < front_end:
                        voxel_grid[col, mc_y, front_start:front_end] = True
                    if back_start < back_end:
                        voxel_grid[col, mc_y, back_start:back_end] = True
                else:
                    z_start = (max_depth - d) // 2
                    z_end = z_start + d
                    voxel_grid[col, mc_y, z_start:z_end] = True

    return voxel_grid


def _build_rotation_matrix(
    rx: float, ry: float, rz: float,
) -> np.ndarray:
    cx, sx = np.cos(np.radians(rx)), np.sin(np.radians(rx))
    cy, sy = np.cos(np.radians(ry)), np.sin(np.radians(ry))
    cz, sz = np.cos(np.radians(rz)), np.sin(np.radians(rz))

    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def rotate_voxel_grid(
    voxel_grid: np.ndarray,
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
    pivot: np.ndarray | None = None,
) -> np.ndarray:
    """
    Rotate a boolean voxel grid around a pivot point using Euler angles (degrees).

    Rotation order: intrinsic ZYX (rz around Z, then ry around Y, then rx around X).
    Uses the geometric center as pivot if none is provided.
    Returns a new voxel grid of the same shape. Voxels rotated outside bounds are clipped.
    """
    if rx == 0.0 and ry == 0.0 and rz == 0.0:
        return voxel_grid

    sx, sy, sz = voxel_grid.shape

    if pivot is None:
        pivot = np.array([sx / 2.0, sy / 2.0, sz / 2.0])
    else:
        pivot = np.asarray(pivot, dtype=float)

    R = _build_rotation_matrix(rx, ry, rz)

    rotated = np.zeros_like(voxel_grid)
    coords = np.argwhere(voxel_grid)

    for coord in coords:
        relative = coord.astype(float) - pivot
        new_relative = R @ relative
        new_coord = np.round(pivot + new_relative).astype(int)

        if 0 <= new_coord[0] < sx and 0 <= new_coord[1] < sy and 0 <= new_coord[2] < sz:
            rotated[new_coord[0], new_coord[1], new_coord[2]] = True

    return rotated


def rotate_boxes(
    boxes: list[tuple[tuple[int, int, int], tuple[int, int, int]]],
    grid_shape: tuple[int, int, int],
    rx: float = 0.0,
    ry: float = 0.0,
    rz: float = 0.0,
) -> tuple[list[tuple[tuple[int, int, int], tuple[int, int, int]]], tuple[int, int, int]]:
    """
    Rotate merged boxes around the grid center. Returns (new_boxes, new_grid_shape).

    Unlike rotate_voxel_grid, this preserves every box and auto-expands the
    output bounding volume so no elements are clipped.
    """
    if rx == 0.0 and ry == 0.0 and rz == 0.0:
        return boxes, grid_shape

    sx, sy, sz = grid_shape
    pivot = np.array([sx / 2.0, sy / 2.0, sz / 2.0], dtype=float)
    R = _build_rotation_matrix(rx, ry, rz)

    rotated_boxes: list[tuple[tuple[int, int, int], tuple[int, int, int]]] = []

    for (fx, fy, fz), (tx, ty, tz) in boxes:
        corners = np.array([
            [fx, fy, fz], [fx, fy, tz], [fx, ty, fz], [fx, ty, tz],
            [tx, fy, fz], [tx, fy, tz], [tx, ty, fz], [tx, ty, tz],
        ], dtype=float)

        rotated_corners = (corners - pivot) @ R.T + pivot
        new_from = np.floor(rotated_corners.min(axis=0)).astype(int)
        new_to = np.ceil(rotated_corners.max(axis=0)).astype(int)
        new_to = np.maximum(new_to, new_from + 1)

        rotated_boxes.append((
            (int(new_from[0]), int(new_from[1]), int(new_from[2])),
            (int(new_to[0]), int(new_to[1]), int(new_to[2])),
        ))

    # Compute new grid shape from bounding box of all rotated boxes
    all_f = np.array([[b[0][0], b[0][1], b[0][2]] for b in rotated_boxes])
    all_t = np.array([[b[1][0], b[1][1], b[1][2]] for b in rotated_boxes])
    min_c = all_f.min(axis=0)
    max_c = all_t.max(axis=0)
    new_shape = (
        int(max_c[0] - min_c[0]),
        int(max_c[1] - min_c[1]),
        int(max_c[2] - min_c[2]),
    )

    # Shift boxes so min corner is at origin
    shifted: list[tuple[tuple[int, int, int], tuple[int, int, int]]] = []
    for (fx, fy, fz), (tx, ty, tz) in rotated_boxes:
        shifted.append((
            (fx - int(min_c[0]), fy - int(min_c[1]), fz - int(min_c[2])),
            (tx - int(min_c[0]), ty - int(min_c[1]), tz - int(min_c[2])),
        ))

    return shifted, new_shape
