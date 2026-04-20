# Training & Running Your NLP Backend

## 1. Install Requirements

```bash
pip install -r backend/requirements.txt
```

## 2. (Optional) Fine-tune CodeT5 on Your Dataset

- Prepare your dataset in JSONL format (see `training/sample_dataset.jsonl`).
- For advanced fine-tuning, see Hugging Face docs: https://huggingface.co/docs/transformers/training

Example command:

```bash
python backend/training/fine_tune_codet5.py --train_path backend/training/sample_dataset.jsonl --input_col code --target_col docstring --output_dir backend/models/finetuned_codet5
```

## 3. Run the Backend Server

```bash
python backend/server.py
```

- The server will start at http://localhost:5000
- Test with curl or Postman:

```bash
curl -X POST http://localhost:5000/api/generate-documentation \
  -H "Content-Type: application/json" \
  -d '{"code": "def hello():\n    print(\"Hello\")", "language": "python"}'
```

## 4. Connect Your React App

- In your React app `.env`:
  ```env
  REACT_APP_API_BASE_URL=http://localhost:5000/api
  ```
- Start your React app:
  ```bash
  npm start
  ```
- Use the demo to generate documentation!

## 5. (Optional) Deploy
- Deploy backend to a cloud service (Heroku, AWS, Railway, etc.)
- Update the frontend `.env` with your deployed API URL.

## 6. (Optional) Fine-tune the Model
- Use Hugging Face Trainer or your own script to fine-tune CodeT5 on `backend/training/sample_dataset.jsonl`.
- Save your model under `backend/models/finetuned_codet5` or set `FINETUNED_MODEL_PATH` for custom paths.

---

**You now have a working NLP backend for code documentation!**
