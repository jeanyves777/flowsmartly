"""
Flow AI — Self-hosted Stable Diffusion image generation server.
Model: Lykon/dreamshaper-8 (SD 1.5 fine-tune, great for cartoon/illustration).

Optimized for CPU inference with:
- ONNX Runtime (2-3x faster than PyTorch on CPU)
- DPM++ 2M Karras scheduler (converges in 12 steps)
- 384x384 generation with Lanczos upscale (40% fewer pixels)
- channels_last memory format
- Watchdog timer to auto-reset stuck busy flag
"""

import asyncio
import base64
import io
import os
import time
import threading

import torch

# Use all available CPU threads for PyTorch inference
_num_threads = int(os.environ.get("OMP_NUM_THREADS", os.cpu_count() or 4))
torch.set_num_threads(_num_threads)
torch.set_num_interop_threads(max(1, _num_threads // 2))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel, Field

app = FastAPI(title="Flow AI Image Server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Track whether the server is currently generating
_is_busy = False
_busy_since: float = 0  # Timestamp when generation started
_busy_lock = threading.Lock()
BUSY_TIMEOUT_S = 1200  # 20 minutes max per generation (watchdog)

MODEL_ID = os.environ.get("MODEL_ID", "Lykon/dreamshaper-8")
DEVICE = os.environ.get("DEVICE", "cpu")
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32
USE_ONNX = os.environ.get("USE_ONNX", "true").lower() in ("true", "1", "yes")

# Generation defaults (can be overridden per-request)
DEFAULT_STEPS = int(os.environ.get("DEFAULT_STEPS", "12"))
DEFAULT_WIDTH = int(os.environ.get("DEFAULT_WIDTH", "384"))
DEFAULT_HEIGHT = int(os.environ.get("DEFAULT_HEIGHT", "384"))
UPSCALE_TO = int(os.environ.get("UPSCALE_TO", "512"))  # 0 to disable upscaling

pipe = None


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, low quality, deformed, ugly, bad anatomy, watermark, text, signature, extra limbs, extra fingers, mutated hands, poorly drawn"
    width: int = Field(default=DEFAULT_WIDTH, ge=256, le=1536)
    height: int = Field(default=DEFAULT_HEIGHT, ge=256, le=1536)
    num_inference_steps: int = Field(default=DEFAULT_STEPS, ge=1, le=50)
    guidance_scale: float = Field(default=7.5, ge=1.0, le=20.0)


class GenerateResponse(BaseModel):
    image: str  # base64 PNG
    generation_time: float  # seconds


def _set_busy(busy: bool):
    """Thread-safe busy flag management."""
    global _is_busy, _busy_since
    with _busy_lock:
        _is_busy = busy
        _busy_since = time.time() if busy else 0


def _check_busy_timeout():
    """Check if the busy flag has been stuck for too long and auto-reset."""
    global _is_busy, _busy_since
    with _busy_lock:
        if _is_busy and _busy_since > 0:
            elapsed = time.time() - _busy_since
            if elapsed > BUSY_TIMEOUT_S:
                print(f"WARNING: Busy flag stuck for {elapsed:.0f}s, auto-resetting")
                _is_busy = False
                _busy_since = 0
                return True
    return False


@app.on_event("startup")
async def load_model():
    global pipe
    print(f"Loading model {MODEL_ID} on {DEVICE} ({DTYPE})...")
    print(f"ONNX Runtime: {'enabled' if USE_ONNX else 'disabled'}")
    print(f"Default generation: {DEFAULT_WIDTH}x{DEFAULT_HEIGHT}, {DEFAULT_STEPS} steps, upscale to {UPSCALE_TO}")
    start = time.time()

    if USE_ONNX and DEVICE == "cpu":
        try:
            from optimum.onnxruntime import ORTStableDiffusionPipeline
            from diffusers import DPMSolverMultistepScheduler

            # Check for pre-converted ONNX model
            onnx_model_path = os.environ.get("ONNX_MODEL_PATH", "/models/dreamshaper-8-onnx")
            if os.path.exists(onnx_model_path) and os.listdir(onnx_model_path):
                print(f"Loading pre-converted ONNX model from {onnx_model_path}...")
                pipe = ORTStableDiffusionPipeline.from_pretrained(
                    onnx_model_path,
                    provider="CPUExecutionProvider",
                )
            else:
                print(f"Converting {MODEL_ID} to ONNX (first run, may take a few minutes)...")
                pipe = ORTStableDiffusionPipeline.from_pretrained(
                    MODEL_ID,
                    export=True,
                    provider="CPUExecutionProvider",
                )
                # Save converted model for faster subsequent loads
                os.makedirs(onnx_model_path, exist_ok=True)
                pipe.save_pretrained(onnx_model_path)
                print(f"ONNX model saved to {onnx_model_path}")
            # Disable safety checker (not needed for cartoon generation)
            pipe.safety_checker = None

            # Use DPM++ 2M Karras scheduler (converges faster than Euler)
            pipe.scheduler = DPMSolverMultistepScheduler.from_config(
                pipe.scheduler.config,
                algorithm_type="dpmsolver++",
                use_karras_sigmas=True,
            )

            elapsed_load = time.time() - start
            print(f"ONNX model loaded in {elapsed_load:.1f}s")
            return  # Success with ONNX
        except Exception as e:
            print(f"ONNX loading failed, falling back to PyTorch: {e}")

    # Fallback: Standard PyTorch pipeline
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

    pipe = StableDiffusionPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=DTYPE,
        safety_checker=None,
        requires_safety_checker=False,
    )

    # DPM++ 2M Karras: converges in 12 steps vs 20+ for Euler
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config,
        algorithm_type="dpmsolver++",
        use_karras_sigmas=True,
    )
    pipe = pipe.to(DEVICE)

    # CPU optimizations
    if DEVICE == "cpu":
        pipe.enable_attention_slicing()
        # channels_last memory format: 5-15% faster on CPU
        pipe.unet = pipe.unet.to(memory_format=torch.channels_last)
        pipe.vae = pipe.vae.to(memory_format=torch.channels_last)

    elapsed_load = time.time() - start
    print(f"PyTorch model loaded in {elapsed_load:.1f}s")


@app.get("/health")
async def health():
    _check_busy_timeout()
    return {
        "status": "ok" if pipe is not None else "loading",
        "model": MODEL_ID,
        "device": DEVICE,
        "busy": _is_busy,
        "onnx": USE_ONNX,
        "default_size": f"{DEFAULT_WIDTH}x{DEFAULT_HEIGHT}",
        "default_steps": DEFAULT_STEPS,
    }


@app.post("/reset-busy")
async def reset_busy():
    """Admin endpoint to manually reset the busy flag if it gets stuck."""
    was_busy = _is_busy
    _set_busy(False)
    return {"reset": True, "was_busy": was_busy}


@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    if pipe is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    # Auto-reset stuck busy flag
    _check_busy_timeout()

    if _is_busy:
        raise HTTPException(
            status_code=503,
            detail="Server is busy generating another image. Please retry later.",
        )

    _set_busy(True)
    start = time.time()

    try:
        # Run the blocking pipeline in a thread so the event loop stays responsive
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: pipe(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt,
                width=req.width,
                height=req.height,
                num_inference_steps=req.num_inference_steps,
                guidance_scale=req.guidance_scale,
            ),
        )

        image: Image.Image = result.images[0]

        # Upscale if generated at lower resolution
        if UPSCALE_TO > 0 and (image.width < UPSCALE_TO or image.height < UPSCALE_TO):
            orig_size = f"{image.width}x{image.height}"
            image = image.resize((UPSCALE_TO, UPSCALE_TO), Image.LANCZOS)
            print(f"Upscaled from {orig_size} to {image.width}x{image.height}")

        # Convert to base64 PNG
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        elapsed = time.time() - start
        print(f"Generated {req.width}x{req.height} -> {image.width}x{image.height} in {elapsed:.1f}s ({req.num_inference_steps} steps)")

        return GenerateResponse(image=b64, generation_time=elapsed)
    except Exception as e:
        elapsed = time.time() - start
        print(f"Generation failed after {elapsed:.1f}s: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _set_busy(False)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
