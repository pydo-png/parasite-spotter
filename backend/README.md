# Malaria Classifier API

Serves your trained `mal_model_epoch75.h5` to the web app.

## Run locally
```bash
cd backend
pip install -r requirements.txt
cp /path/to/mal_model_epoch75.h5 .
uvicorn main:app --host 0.0.0.0 --port 8000
```
Then in the web app open **API settings** and enter `http://localhost:8000`.

## Run from Google Colab (quick)
```python
!pip install fastapi uvicorn python-multipart pyngrok nest_asyncio
from google.colab import drive; drive.mount('/content/drive')
import os; os.environ["MODEL_PATH"] = "/content/drive/MyDrive/malaria_data/mal_model_epoch75.h5"
# upload main.py to /content, then:
import nest_asyncio, uvicorn, threading
from pyngrok import ngrok
nest_asyncio.apply()
threading.Thread(target=lambda: uvicorn.run("main:app", host="0.0.0.0", port=8000), daemon=True).start()
print(ngrok.connect(8000).public_url)  # paste this URL into the web app
```

## Deploy (Hugging Face Spaces / Render)
Push this folder with the `.h5` file; start command:
`uvicorn main:app --host 0.0.0.0 --port $PORT`

## API
- `GET /health`
- `POST /predict` — multipart: `files` (1–10 JPG/PNG), `patient_id`, `age`, `sex`
  Returns `{ results: [{ filename, score, label }], summary, threshold }`.
  Preprocessing matches training: resize to 150×150, divide by 255. Cutoff 0.70.
