"""
Self-hosted Whisper STT for Flow-AI voice.

Auto-detects the spoken language (so the user can switch English <-> French
mid-conversation with no manual toggler) and returns the transcript. Runs the
open-source faster-whisper model on CPU — zero per-use API cost, like the
Supertonic TTS service. Bound to localhost; the Next app proxies to it.

POST /transcribe  (multipart form, field "audio")  ->  { text, language }
GET  /health      ->  { ok: true, model }

Env:
  WHISPER_MODEL    model size: tiny | base | small | medium (default "small")
  WHISPER_DEVICE   "cpu" (default) or "cuda"
  WHISPER_COMPUTE  compute type (default "int8" — small + fast on CPU)
  WHISPER_PORT     default 7789
"""
import os
import tempfile

from fastapi import FastAPI, File, UploadFile, HTTPException
from faster_whisper import WhisperModel

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "small")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")

# Loaded once at startup (downloads from HuggingFace on first run, then cached).
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE)

app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_SIZE}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty audio")
    # faster-whisper decodes via PyAV, so webm/opus from MediaRecorder works.
    suffix = os.path.splitext(audio.filename or "")[1] or ".webm"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(data)
            tmp_path = f.name
        # beam_size=1 + VAD filter = fast, and skips silence so short clips
        # transcribe in well under a second of CPU time.
        segments, info = model.transcribe(tmp_path, beam_size=1, vad_filter=True)
        text = "".join(seg.text for seg in segments).strip()
        return {"text": text, "language": info.language}
    except Exception as e:  # noqa: BLE001 — never 500 with a stack to the client
        raise HTTPException(status_code=500, detail=f"transcription failed: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
