#!/usr/bin/env python3
"""
reel-reframe.py — active-speaker-ish reframe hint for the Reel Studio render.

Given a video + a clip time range, samples frames, runs OpenCV Haar face
detection, and prints JSON { "cx": <0..1>, "samples": N } where cx is the
horizontal centre (fraction of width) of the DOMINANT face across the clip —
so the 9:16 crop can follow the speaker instead of always centre-cropping.

Degrades: no faces / any error -> cx 0.5 (centre). Requires opencv-python
(headless). Used by src/lib/reel/reel-pipeline.ts (spawned; never trusted to
throw — the caller falls back to centre-crop on non-zero exit).

Usage: python reel-reframe.py <video> <startSec> <endSec>
"""
import sys
import json


def main() -> None:
    try:
        video = sys.argv[1]
        start = float(sys.argv[2])
        end = float(sys.argv[3])
    except Exception:
        print(json.dumps({"cx": 0.5, "samples": 0}))
        return

    try:
        import cv2  # type: ignore
    except Exception:
        print(json.dumps({"cx": 0.5, "samples": 0}))
        return

    try:
        cap = cv2.VideoCapture(video)
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        xs = []
        span = max(0.1, end - start)
        step = max(0.4, span / 24.0)  # ~24 samples across the clip
        t = start
        while t < end:
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
            ok, frame = cap.read()
            if not ok:
                break
            h, w = frame.shape[:2]
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = cascade.detectMultiScale(gray, 1.2, 5, minSize=(60, 60))
            if len(faces) > 0:
                # Dominant speaker heuristic = the largest face in the frame.
                fx, fy, fw, fh = max(faces, key=lambda f: int(f[2]) * int(f[3]))
                xs.append((float(fx) + float(fw) / 2.0) / float(w))
            t += step
        cap.release()
        if xs:
            xs.sort()
            cx = xs[len(xs) // 2]  # median (robust to stray detections)
        else:
            cx = 0.5
        print(json.dumps({"cx": round(float(cx), 4), "samples": len(xs)}))
    except Exception:
        print(json.dumps({"cx": 0.5, "samples": 0}))


if __name__ == "__main__":
    main()
