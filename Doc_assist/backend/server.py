# Backend API for Code Documentation Assistant
# Requires: pip install -r backend/requirements.txt

import os
import re
from pathlib import Path

import torch
from flask import Flask, jsonify, request
from flask_cors import CORS
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
DEFAULT_FINETUNED_PATH = MODELS_DIR / "finetuned_codet5" / "checkpoint-123"
FINETUNED_PATH = Path(os.getenv("FINETUNED_MODEL_PATH", str(DEFAULT_FINETUNED_PATH))).resolve()
TOKENIZER_SOURCE = os.getenv("TOKENIZER_SOURCE", "Salesforce/codet5-base")

tokenizer = None
model = None
MODEL_LOAD_ERROR = None
MODEL_READY = False


def _load_model() -> None:
    global tokenizer
    global model
    global MODEL_LOAD_ERROR
    global MODEL_READY

    try:
        tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_SOURCE, use_fast=False)
        model = AutoModelForSeq2SeqLM.from_pretrained(str(FINETUNED_PATH))
        MODEL_READY = True
    except Exception as exc:
        MODEL_READY = False
        MODEL_LOAD_ERROR = str(exc)


_load_model()

if MODEL_READY:
    MODEL_DISPLAY_NAME = f"{TOKENIZER_SOURCE} + local fine-tune ({FINETUNED_PATH})"
else:
    MODEL_DISPLAY_NAME = f"Fallback mode (model unavailable at {FINETUNED_PATH})"


def _extract_signature(code: str):
    """Return (name, params_list) for a simple function signature in python/js."""
    m = re.search(r"def\s+(\w+)\s*\(([^)]*)\)", code)
    if m:
        name = m.group(1)
        params = [p.strip().split("=")[0].strip() for p in m.group(2).split(",") if p.strip()]
        return name, params

    m = re.search(r"function\s+(\w+)\s*\(([^)]*)\)|const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>", code)
    if m:
        name = m.group(1) or m.group(3)
        params = (m.group(2) or m.group(4) or "").split(",")
        params = [p.strip() for p in params if p.strip()]
        return name, params

    return None, []


def _fallback_docstring(code: str, language: str) -> str:
    name, params = _extract_signature(code)
    params = params or []

    if language == "python":
        lines = ['"""', f"{name or 'Function'}: Auto-generated documentation."]
        if params:
            lines.append("")
            lines.append("Args:")
            for p in params:
                lines.append(f"    {p}: Description of {p}.")
        lines.append("")
        lines.append("Returns:")
        lines.append("    Description of return value.")
        lines.append('"""')
        return "\n".join(lines)

    if language in ["javascript", "typescript"]:
        lines = ["/**", f" * {name or 'Function'}: Auto-generated documentation."]
        for p in params:
            lines.append(f" * @param {p} Description of {p}.")
        lines.append(" * @returns Description of return value.")
        lines.append(" */")
        return "\n".join(lines)

    return f"Auto-generated documentation for {name or 'function'}."


def _looks_like_code(text: str) -> bool:
    if not text:
        return True
    code_tokens = ["def ", "return ", "for ", "if ", "while ", "class ", "function ", "=>"]
    return any(tok in text for tok in code_tokens)


def _estimate_complexity(code: str) -> int:
    keyword_hits = re.findall(r"\b(if|elif|for|while|case|catch|except)\b", code)
    symbol_hits = code.count("&&") + code.count("||")
    return 1 + len(keyword_hits) + symbol_hits


def _validate_syntax(code: str, language: str):
    language = (language or "").lower()
    errors = []

    if language == "python":
        try:
            compile(code, "<input>", "exec")
        except SyntaxError as exc:
            errors.append(
                {
                    "line": exc.lineno,
                    "offset": exc.offset,
                    "message": exc.msg,
                }
            )
        return len(errors) == 0, errors

    brackets = [("(", ")"), ("{", "}"), ("[", "]")]
    for left, right in brackets:
        if code.count(left) != code.count(right):
            errors.append({"message": f"Unbalanced brackets: '{left}' and '{right}'"})

    return len(errors) == 0, errors


def generate_docstring(code: str, language: str = "python") -> str:
    if MODEL_READY and tokenizer is not None and model is not None:
        try:
            prompt = f"summarize: {code}"
            inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_length=128,
                    num_beams=4,
                    early_stopping=True,
                    do_sample=False,
                )
            docstring = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
            if docstring and not _looks_like_code(docstring):
                return format_documentation(code, docstring, language)
        except Exception:
            pass

    return format_documentation(code, _fallback_docstring(code, language), language)


def format_documentation(code: str, docstring: str, language: str) -> str:
    """Combine generated docstring with original code."""
    lines = code.split("\n")

    if language == "python":
        if "def " in code:
            for index, line in enumerate(lines):
                if "def " in line:
                    indent = len(line) - len(line.lstrip())
                    if docstring.strip().startswith('"""'):
                        ds_block = docstring.strip().split("\n")
                        doc_lines = [
                            " " * (indent + 4) + content if line_index > 0 else " " * (indent + 4) + ds_block[0]
                            for line_index, content in enumerate(ds_block)
                        ]
                    else:
                        doc_lines = [
                            " " * (indent + 4) + '"""',
                            " " * (indent + 4) + docstring,
                            " " * (indent + 4) + '"""',
                        ]
                    lines.insert(index + 1, "\n".join(doc_lines))
                    break
        return "\n".join(lines)

    if language in ["javascript", "typescript"]:
        if "function " in code or "=>" in code:
            doc_lines = ["/**", f" * {docstring}", " */"]
            return "\n".join(doc_lines) + "\n" + code
        return code

    if language == "java":
        if "public " in code or "private " in code:
            doc_lines = ["/**", f" * {docstring}", " */"]
            return "\n".join(doc_lines) + "\n" + code
        return code

    return f"// {docstring}\n{code}"


@app.route("/api/generate-documentation", methods=["POST"])
def generate_documentation():
    data = request.get_json(silent=True) or {}
    code = data.get("code", "")
    language = data.get("language", "python")

    if not code:
        return jsonify({"success": False, "error": "No code provided"}), 400

    docstring = generate_docstring(code, language)
    return jsonify(
        {
            "success": True,
            "data": {
                "documentation": docstring,
                "metadata": {
                    "model": MODEL_DISPLAY_NAME,
                    "language": language,
                },
            },
        }
    )


@app.route("/api/analyze-code", methods=["POST"])
def analyze_code():
    data = request.get_json(silent=True) or {}
    code = data.get("code", "")
    language = data.get("language", "python")

    if not code:
        return jsonify({"success": False, "error": "No code provided"}), 400

    function_name, parameters = _extract_signature(code)
    response = {
        "functionName": function_name,
        "parameters": parameters,
        "returnType": "unknown",
        "complexity": _estimate_complexity(code),
        "linesOfCode": len([line for line in code.split("\n") if line.strip()]),
        "isAsync": "async " in code,
        "language": language,
    }

    return jsonify({"success": True, "data": response})


@app.route("/api/validate-syntax", methods=["POST"])
def validate_syntax():
    data = request.get_json(silent=True) or {}
    code = data.get("code", "")
    language = data.get("language", "python")

    if not code:
        return jsonify({"success": False, "error": "No code provided"}), 400

    is_valid, errors = _validate_syntax(code, language)
    return jsonify(
        {
            "success": True,
            "data": {
                "isValid": is_valid,
                "errors": errors,
            },
        }
    )


@app.route("/api/health", methods=["GET"])
def health():
    status = "healthy" if MODEL_READY else "degraded"
    return jsonify(
        {
            "success": True,
            "data": {
                "status": status,
                "model": MODEL_DISPLAY_NAME,
                "modelLoaded": MODEL_READY,
                "finetunedPath": str(FINETUNED_PATH),
                "loadError": MODEL_LOAD_ERROR,
            },
        }
    )


if __name__ == "__main__":
    app.run(port=5000, debug=True)
