"""
Malaria smear classifier API (FastAPI + TensorFlow).

Loads the EfficientNetV2S model trained in Colab (mal_model_epoch75.h5)
and serves predictions to the web app.

Run locally:
    pip install -r requirements.txt
    MODEL_PATH=mal_model_epoch75.h5 uvicorn main:app --host 0.0.0.0 --port 8000
"""
import io
import os
from typing import List

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from tensorflow.keras.models import load_model

MODEL_PATH = os.environ.get("MODEL_PATH", "mal_model_epoch75.h5")
THRESHOLD = float(os.environ.get("THRESHOLD", "0.70"))  # same cutoff as the notebook
IMG_SIZE = (150, 150)  # same input_shape used in training
MAX_FILES = 10
ALLOWED = {"image/jpeg", "image/png", "image/jpg"}

app = FastAPI(title="Malaria Smear Classifier")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

model = load_model(MODEL_PATH, compile=False)


def preprocess(data: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(data)).convert("RGB").resize(IMG_SIZE)
    arr = np.asarray(img, dtype=np.float32) / 255.0  # rescale=1/255 as in training
    return arr


@app.get("/health")
def health():
    return {"status": "ok", "threshold": THRESHOLD}


@app.post("/predict")
async def predict(
    files: List[UploadFile] = File(...),
    patient_id: str = Form(""),
    age: str = Form(""),
    sex: str = Form(""),
):
    if not files:
        raise HTTPException(400, "No images uploaded")
    if len(files) > MAX_FILES:
        raise HTTPException(400, f"Maximum {MAX_FILES} images per request")

    batch, names = [], []
    for f in files:
        if f.content_type not in ALLOWED:
            raise HTTPException(400, f"{f.filename}: only JPG/PNG allowed")
        batch.append(preprocess(await f.read()))
        names.append(f.filename)

    scores = model.predict(np.stack(batch), verbose=0).reshape(-1)

    # NOTE: flow_from_directory sorts classes alphabetically:
    # 'non-parasitized' = 0, 'parasitized' = 1, so the sigmoid output is P(parasitized).
    results = [
        {
            "filename": n,
            "score": float(s),
            "label": "Positive" if s >= THRESHOLD else "Negative",
        }
        for n, s in zip(names, scores)
    ]
    positives = sum(r["label"] == "Positive" for r in results)
    return {
        "patient": {"patient_id": patient_id, "age": age, "sex": sex},
        "threshold": THRESHOLD,
        "results": results,
        "summary": {"total": len(results), "positive": positives},
    }
