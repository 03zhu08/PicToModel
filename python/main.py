import asyncio
import base64
import io
import logging
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

from segmentation import remove_background, extract_mask
from voxelizer import voxelize_mask
from mc_model import generate_mc_model, generate_mc_model_colored, greedy_mesh
from colorizer import sample_voxel_colors, build_texture_atlas, atlas_to_base64, get_voxel_color_hex

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

executor = ThreadPoolExecutor(max_workers=2)
model_ready = False


def _warmup_model():
    global model_ready
    try:
        logger.info("Warming up rembg model (downloading if needed)...")
        from rembg import new_session
        new_session("u2net")
        model_ready = True
        logger.info("Model ready!")
    except Exception:
        logger.exception("Model warmup failed")
        model_ready = True


@asynccontextmanager
async def lifespan(_app: FastAPI):
    loop = asyncio.get_event_loop()
    loop.run_in_executor(executor, _warmup_model)
    yield


app = FastAPI(title="PicToModel Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessRequest(BaseModel):
    image_data: str
    resolution: int = 16
    extrusion_mode: str = "rounded"
    depth_ratio: float = 0.4
    enable_color: bool = False
    texture_resolution: int = 8


class ProcessResponse(BaseModel):
    voxels: list[dict]
    model_json: dict
    stats: dict
    texture_png: str | None = None


@app.get("/health")
async def health():
    return {"status": "ok", "model_ready": model_ready}


def _do_process(
    image_data: str,
    resolution: int,
    extrusion_mode: str,
    depth_ratio: float,
    enable_color: bool,
    texture_resolution: int,
):
    if "," in image_data:
        image_b64 = image_data.split(",", 1)[1]
    else:
        image_b64 = image_data

    image_bytes = base64.b64decode(image_b64)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")

    max_dim = 1024
    if max(image.size) > max_dim:
        ratio = max_dim / max(image.size)
        image = image.resize(
            (int(image.width * ratio), int(image.height * ratio)),
            Image.LANCZOS,
        )

    logger.info(f"Processing image {image.size}, resolution={resolution}, color={enable_color}")

    fg_image = remove_background(image)
    mask = extract_mask(fg_image, resolution)
    voxel_grid = voxelize_mask(mask, extrusion_mode, depth_ratio)
    merged_boxes = greedy_mesh(voxel_grid)

    texture_png = None

    if enable_color:
        color_grid = sample_voxel_colors(fg_image, mask, resolution)
        tile_size = texture_resolution
        atlas, color_to_index, atlas_size = build_texture_atlas(color_grid, mask, tile_size)
        texture_png = atlas_to_base64(atlas)
        color_hex_map = get_voxel_color_hex(color_grid, mask)
        model_json = generate_mc_model_colored(
            merged_boxes, voxel_grid.shape, color_grid, mask,
            color_to_index, atlas_size, tile_size,
        )
    else:
        color_hex_map = None
        model_json = generate_mc_model(merged_boxes, voxel_grid.shape)

    h = mask.shape[0]
    voxels = []
    colored_voxels = 0
    for x in range(voxel_grid.shape[0]):
        for y in range(voxel_grid.shape[1]):
            for z in range(voxel_grid.shape[2]):
                if voxel_grid[x, y, z]:
                    v: dict = {"x": int(x), "y": int(y), "z": int(z)}
                    if color_hex_map and (x, y) in color_hex_map:
                        v["color"] = color_hex_map[(x, y)]
                        colored_voxels += 1
                    voxels.append(v)

    if enable_color:
        logger.info(f"Color map size: {len(color_hex_map) if color_hex_map else 0}, Colored voxels: {colored_voxels}/{len(voxels)}")
        if color_hex_map:
            sample_colors = list(color_hex_map.values())[:5]
            logger.info(f"Sample colors: {sample_colors}")

    stats = {
        "elementCount": len(model_json["elements"]),
        "dimensions": list(voxel_grid.shape),
    }

    logger.info(f"Generated {stats['elementCount']} elements, {len(voxels)} voxels")
    return voxels, model_json, stats, texture_png


@app.post("/process", response_model=ProcessResponse)
async def process_image(req: ProcessRequest):
    if not model_ready:
        raise HTTPException(status_code=503, detail="Model is still loading, please wait...")

    try:
        loop = asyncio.get_event_loop()
        voxels, model_json, stats, texture_png = await loop.run_in_executor(
            executor,
            _do_process,
            req.image_data,
            req.resolution,
            req.extrusion_mode,
            req.depth_ratio,
            req.enable_color,
            req.texture_resolution,
        )

        return ProcessResponse(
            voxels=voxels,
            model_json=model_json,
            stats=stats,
            texture_png=texture_png,
        )

    except Exception as e:
        logger.exception("Processing failed")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8787, timeout_keep_alive=120)
