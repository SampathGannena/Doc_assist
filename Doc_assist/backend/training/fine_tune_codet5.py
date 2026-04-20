"""
Fine-tune CodeT5-base for code-to-docstring generation
=====================================================

Features
- Train from: CodeXGLUE code-to-text (Python) via Hugging Face Datasets, or local CSV/JSONL
- Flexible column mapping (input: code, target: docstring)
- Optional train subset limiting, max sequence lengths
- Saves final model and tokenizer at output_dir root so backend can load from that path

Requirements
- pip install --user transformers datasets torch pandas accelerate sentencepiece

Examples (Windows PowerShell)
1) Train on CodeXGLUE (Python):
    python backend/training/fine_tune_codet5.py --dataset codexglue --language python --output_dir ./backend/models/finetuned_codet5 --epochs 3 --batch_size 4

2) Train on local CSV with columns `code` and `docstring`:
    python backend/training/fine_tune_codet5.py --train_path train.csv --input_col code --target_col docstring --output_dir ./backend/models/finetuned_codet5

3) JSONL with keys `code` and `doc`:
    python backend/training/fine_tune_codet5.py --train_path data.jsonl --input_col code --target_col doc --output_dir ./backend/models/finetuned_codet5
"""
import argparse
import os
import random
from pathlib import Path
from typing import Optional

import pandas as pd
import torch
from datasets import Dataset, load_dataset
from transformers import (
    AutoModelForSeq2SeqLM,
    AutoTokenizer,
    DataCollatorForSeq2Seq,
    Trainer,
    TrainingArguments,
)


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT_DIR = SCRIPT_DIR.parent / "models" / "finetuned_codet5"


def set_seed(seed: int = 42):
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def extract_docstring(code: str) -> str:
    """Extract the first triple-quoted docstring from code (best-effort)."""
    import re
    if not isinstance(code, str):
        return ""
    # Normalize over-escaped quotes like """""" -> """
    normalized = re.sub(r'(["\']){4,}', lambda m: m.group(0)[0] * 3, code)
    m = re.search(r'(?:"""|\'\'\')([\s\S]*?)(?:"""|\'\'\')', normalized)
    return m.group(1).strip() if m else ""


def load_codexglue_python() -> pd.DataFrame:
    """Load CodeXGLUE code-to-text (Python) from Hugging Face Datasets.
    Dataset ID: code_x_glue_ct_code_to_text, config: python
    Returns a DataFrame with columns: code, docstring
    """
    print("Loading CodeXGLUE code-to-text (Python) from Hugging Face datasets...")
    try:
        ds = load_dataset("code_x_glue_ct_code_to_text", "python")
    except Exception as e:
        raise SystemExit(
            "Failed to load 'code_x_glue_ct_code_to_text' (python).\n"
            "- Ensure internet access and an up-to-date 'datasets' package.\n"
            "- If the Hub is unavailable, download JSONL from the CodeXGLUE repo and convert to CSV.\n"
            f"Original error: {e}"
        )
    train_ds = ds["train"]
    # The split exposes 'code' and 'docstring'
    return pd.DataFrame({"code": train_ds["code"], "docstring": train_ds["docstring"]})


def load_dataframe(path: str) -> pd.DataFrame:
    ext = os.path.splitext(path)[1].lower()
    if ext in [".csv", ".tsv"]:
        sep = "," if ext == ".csv" else "\t"
        return pd.read_csv(path, sep=sep)
    # Assume JSONL
    return pd.read_json(path, lines=True)


def prepare_datasets(
    train_path: Optional[str],
    val_path: Optional[str],
    dataset_name: Optional[str],
    language: str,
    input_col: Optional[str],
    target_col: Optional[str],
    max_train_samples: Optional[int] = None,
    max_val_samples: Optional[int] = None,
) -> tuple:
    if dataset_name and dataset_name.lower() == "codexglue":
        if language.lower() != "python":
            raise SystemExit("Only language=python is supported for CodeXGLUE in this script.")
        print("Loading CodeXGLUE train/validation splits...")
        ds = load_dataset("code_x_glue_ct_code_to_text", "python")
        train_df = pd.DataFrame({"code": ds["train"]["code"], "docstring": ds["train"]["docstring"]})
        val_df = pd.DataFrame({"code": ds["validation"]["code"], "docstring": ds["validation"]["docstring"]})
        input_col = "code"
        target_col = "docstring"
    else:
        if not train_path:
            raise SystemExit("Provide --dataset codexglue or --train_path to a CSV/JSONL file.")
        train_df = load_dataframe(train_path)
        val_df = load_dataframe(val_path) if val_path else None

    # Infer columns if not provided
    if not input_col:
        for cand in ["code", "prompt", "source", "input", "canonical_solution"]:
            if cand in train_df.columns:
                input_col = cand
                break
    if not target_col:
        for cand in ["docstring", "doc", "target", "summary", "description"]:
            if cand in train_df.columns:
                target_col = cand
                break

    if not input_col:
        raise SystemExit("Could not infer input column. Pass --input_col explicitly.")

    if not target_col or target_col not in train_df.columns:
        # Attempt to extract docstrings from code
        target_col = "__docstring__"
        train_df[target_col] = train_df[input_col].astype(str).apply(extract_docstring)
        if val_df is not None:
            val_df[target_col] = val_df[input_col].astype(str).apply(extract_docstring)

    # Drop empty targets
    train_df[target_col] = train_df[target_col].astype(str)
    train_df = train_df[train_df[target_col].str.strip() != ""]
    if val_df is not None:
        val_df[target_col] = val_df[target_col].astype(str)
        val_df = val_df[val_df[target_col].str.strip() != ""]

    if train_df.empty:
        raise SystemExit("No training rows with non-empty docstrings.")

    if max_train_samples and max_train_samples > 0:
        train_df = train_df.sample(n=min(max_train_samples, len(train_df)), random_state=42).reset_index(drop=True)
    if val_df is not None and max_val_samples and max_val_samples > 0:
        val_df = val_df.sample(n=min(max_val_samples, len(val_df)), random_state=42).reset_index(drop=True)

    train_ds = Dataset.from_pandas(
        train_df[[input_col, target_col]].rename(columns={input_col: "input_text", target_col: "target_text"})
    )
    val_ds = None
    if val_df is not None:
        val_ds = Dataset.from_pandas(
            val_df[[input_col, target_col]].rename(columns={input_col: "input_text", target_col: "target_text"})
        )
    return train_ds, val_ds


def preprocess_function(examples, tokenizer, max_input_length=256, max_target_length=96):
    model_inputs = tokenizer(examples["input_text"], max_length=max_input_length, truncation=True)
    with tokenizer.as_target_tokenizer():
        labels = tokenizer(examples["target_text"], max_length=max_target_length, truncation=True)
    model_inputs["labels"] = labels["input_ids"]
    return model_inputs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=str, default=None, help="Preset dataset name: codexglue")
    parser.add_argument("--language", type=str, default="python", help="Language for preset dataset")
    parser.add_argument("--train_path", type=str, default=None, help="Local training file (.csv/.tsv/.jsonl)")
    parser.add_argument("--input_col", type=str, default=None, help="Column/key for code input")
    parser.add_argument("--target_col", type=str, default=None, help="Column/key for docstring target")
    parser.add_argument("--output_dir", type=str, default=str(DEFAULT_OUTPUT_DIR), help="Save dir")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch_size", type=int, default=4)
    parser.add_argument("--model_name", type=str, default="Salesforce/codet5-base")
    parser.add_argument("--max_input_len", type=int, default=256)
    parser.add_argument("--max_target_len", type=int, default=96)
    parser.add_argument("--max_train_samples", type=int, default=0, help="Optional cap on training samples (0 = all)")
    parser.add_argument("--max_val_samples", type=int, default=0, help="Optional cap on validation samples (0 = all)")
    parser.add_argument("--val_path", type=str, default=None, help="Optional validation file (.csv/.jsonl)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    set_seed(args.seed)

    print("Loading dataset...")
    train_ds, val_ds = prepare_datasets(
        train_path=args.train_path,
        val_path=args.val_path,
        dataset_name=args.dataset,
        language=args.language,
        input_col=args.input_col,
        target_col=args.target_col,
        max_train_samples=args.max_train_samples,
        max_val_samples=args.max_val_samples,
    )
    print(f"Prepared {len(train_ds)} training rows" + (f", {len(val_ds)} validation rows" if val_ds is not None else ""))

    print("Loading tokenizer and model...")
    tokenizer = AutoTokenizer.from_pretrained(args.model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(args.model_name)

    print("Tokenizing dataset...")
    tokenized_train = train_ds.map(
        lambda x: preprocess_function(x, tokenizer, args.max_input_len, args.max_target_len), batched=True
    )
    tokenized_val = None
    if val_ds is not None:
        tokenized_val = val_ds.map(
            lambda x: preprocess_function(x, tokenizer, args.max_input_len, args.max_target_len), batched=True
        )

    data_collator = DataCollatorForSeq2Seq(tokenizer, model=model)

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        learning_rate=5e-5,
        per_device_train_batch_size=args.batch_size,
        num_train_epochs=args.epochs,
        weight_decay=0.01,
        save_total_limit=2,
        fp16=torch.cuda.is_available(),
        logging_steps=25,
        save_steps=200,
        report_to="none",
    )

    print("Starting training...")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_train,
        eval_dataset=tokenized_val,
        tokenizer=tokenizer,
        data_collator=data_collator,
    )
    trainer.train()

    # Save final model + tokenizer to output_dir root (backend loads from here)
    model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    print(f"Model saved to {args.output_dir}")


if __name__ == "__main__":
    main()
