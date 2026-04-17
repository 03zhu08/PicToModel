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
                    # Symmetrical mode: both halves meet at center with no gap
                    center_z = max_depth / 2.0
                    half_d = d / 2.0

                    # Front half: from (center - half_d) to center
                    front_start = int(max(0, center_z - half_d))
                    front_end = int(center_z)

                    # Back half: from center to (center + half_d)
                    back_start = int(center_z)
                    back_end = int(min(max_depth, center_z + half_d))

                    # Fill both halves (they meet at center)
                    if front_start < front_end:
                        voxel_grid[col, mc_y, front_start:front_end] = True
                    if back_start < back_end:
                        voxel_grid[col, mc_y, back_start:back_end] = True
                else:
                    # Original centered mode
                    z_start = (max_depth - d) // 2
                    z_end = z_start + d
                    voxel_grid[col, mc_y, z_start:z_end] = True

    return voxel_grid
