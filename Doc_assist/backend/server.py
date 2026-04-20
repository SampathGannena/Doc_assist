# Backend API for Code Documentation Assistant
# Requires: pip install -r backend/requirements.txt

import atexit
import hashlib
import json
import logging
import os
import queue
import re
import secrets
import signal
import sqlite3
import threading
import time
import traceback
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib import error as urllib_error
from urllib import request as urllib_request

from flask import Flask, g, jsonify, make_response, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException


def _load_backend_env_file() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return

    try:
        with env_path.open("r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue

                key, value = line.split("=", 1)
                key = key.strip()
                if not key:
                    continue

                cleaned_value = value.strip().strip('"').strip("'")
                current_value = os.environ.get(key)
                if current_value is None or not str(current_value).strip():
                    os.environ[key] = cleaned_value
    except Exception:
        # Do not block server startup if env parsing fails.
        return


_load_backend_env_file()

try:
    import torch
except Exception:
    torch = None

try:
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
except Exception as exc:
    AutoModelForSeq2SeqLM = None
    AutoTokenizer = None
    TRANSFORMERS_IMPORT_ERROR = str(exc)
else:
    TRANSFORMERS_IMPORT_ERROR = None

APP_VERSION = "2.0.0"
SUPPORTED_LANGUAGES = {
    "python",
    "javascript",
    "java",
    "cpp",
    "csharp",
    "typescript",
}
SUPPORTED_DOC_STYLES = {"google", "numpy", "sphinx"}
AUTH_SCOPES = {"read", "generate", "manage", "admin"}
AUTH_ROLE_SCOPES = {
    "auditor": {"read"},
    "developer": {"read", "generate"},
    "manager": {"read", "generate", "manage"},
    "admin": {"read", "generate", "manage", "admin"},
}
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "y", "on"}


def _env_csv(name: str, default: str = "") -> List[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in str(raw).split(",") if item.strip()]


def _value_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return default


def _hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _normalize_email(value: Any) -> str:
    return str(value or "").strip().lower()


def _derive_scopes_for_role(role: Any) -> Set[str]:
    role_key = str(role or "manager").strip().lower()
    return set(AUTH_ROLE_SCOPES.get(role_key, AUTH_ROLE_SCOPES["manager"]))


def _hash_password(password: str, salt_hex: Optional[str] = None) -> str:
    if salt_hex is None:
        salt_hex = secrets.token_hex(16)

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        str(password).encode("utf-8"),
        bytes.fromhex(salt_hex),
        120000,
    ).hex()
    return f"{salt_hex}${digest}"


def _verify_password(password: str, encoded: str) -> bool:
    try:
        salt_hex, expected_digest = str(encoded).split("$", 1)
    except ValueError:
        return False

    candidate = _hash_password(password, salt_hex=salt_hex)
    candidate_digest = candidate.split("$", 1)[1]
    return secrets.compare_digest(candidate_digest, expected_digest)


def _validate_password(password: Any) -> Tuple[bool, str]:
    value = str(password or "")
    if len(value) < 8:
        return False, "Password must contain at least 8 characters"
    if len(value) > 200:
        return False, "Password is too long"
    return True, ""


def _clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def _safe_filename_fragment(value: str) -> str:
    text = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "").strip())
    text = text.strip("-._")
    return text or "project"


def _build_project_snapshot_markdown(project: Dict[str, Any], records: List[Dict[str, Any]]) -> str:
    project_name = str(project.get("name") or "Untitled Project")
    project_id = str(project.get("id") or "unknown")
    default_language = str(project.get("language") or "unknown")

    lines: List[str] = [
        "# Project Documentation Snapshot",
        "",
        f"- Project Name: {project_name}",
        f"- Project ID: {project_id}",
        f"- Default Language: {default_language}",
        f"- Snapshot Generated At: {_iso_now()}",
        f"- Total Entries: {len(records)}",
        "",
    ]

    if not records:
        lines.extend(
            [
                "No generation entries found for this project.",
                "",
            ]
        )
        return "\n".join(lines)

    for index, record in enumerate(records, 1):
        created_at = str(record.get("created_at") or record.get("createdAt") or "unknown")
        language = str(record.get("language") or default_language)
        model_name = str(record.get("model") or "unknown")
        complexity = record.get("complexity")
        source_code = str(record.get("source_code") or record.get("sourceCode") or "")
        documentation = str(record.get("documentation") or "")

        if not source_code.strip():
            source_code = "# Source code not available for this entry"
        if not documentation.strip():
            documentation = "Generated documentation is not available for this entry."

        lines.extend(
            [
                f"## Entry {index}",
                "",
                f"- Entry ID: {record.get('id')}",
                f"- Created At: {created_at}",
                f"- Language: {language}",
                f"- Model: {model_name}",
                f"- Complexity: {complexity if complexity is not None else '-'}",
                "",
                "### Source Code",
                "",
                f"```{language}",
                source_code,
                "```",
                "",
                "### Generated Documentation",
                "",
                documentation,
                "",
                "---",
                "",
            ]
        )

    return "\n".join(lines).strip() + "\n"


def _parse_api_tokens(raw: str) -> Dict[str, Set[str]]:
    parsed: Dict[str, Set[str]] = {}
    for item in str(raw or "").split(","):
        chunk = item.strip()
        if not chunk:
            continue

        if ":" in chunk:
            token, scope_part = chunk.split(":", 1)
            scopes = _normalize_scopes(scope_part.split("|"), include_admin_if_empty=False)
        else:
            token = chunk
            scopes = set(AUTH_SCOPES)

        token = token.strip()
        if token:
            parsed[token] = scopes
    return parsed


def _normalize_scopes(
    scopes: Any,
    include_admin_if_empty: bool = True,
) -> Set[str]:
    if isinstance(scopes, str):
        candidates = re.split(r"[|,\s]+", scopes)
    elif isinstance(scopes, (list, tuple, set)):
        candidates = [str(scope) for scope in scopes]
    else:
        candidates = []

    normalized = {
        str(scope).strip().lower()
        for scope in candidates
        if str(scope).strip().lower() in AUTH_SCOPES
    }

    if normalized:
        return normalized

    if include_admin_if_empty:
        return set(AUTH_SCOPES)

    return {"read"}


def _build_logger() -> logging.Logger:
    logger = logging.getLogger("docassist.backend")
    if logger.handlers:
        return logger

    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


def _log_event(logger: logging.Logger, level: int, event: str, **fields: Any) -> None:
    payload = {
        "timestamp": _iso_now(),
        "event": event,
        **fields,
    }
    logger.log(level, json.dumps(payload, default=str))


class ServerConfig:
    def __init__(self) -> None:
        self.BASE_DIR = Path(__file__).resolve().parent
        self.MODELS_DIR = self.BASE_DIR / "models"
        self.DATA_DIR = self.BASE_DIR / "data"
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)

        default_finetuned = self.MODELS_DIR / "finetuned_codet5" / "checkpoint-123"
        self.FINETUNED_PATH = Path(
            os.getenv("FINETUNED_MODEL_PATH", str(default_finetuned))
        ).resolve()
        self.TOKENIZER_SOURCE = os.getenv("TOKENIZER_SOURCE", "Salesforce/codet5-base")

        self.MODEL_PROVIDER = os.getenv("DOCASSIST_MODEL_PROVIDER", "auto").strip().lower()
        self.GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
        self.GROQ_API_BASE_URL = os.getenv(
            "GROQ_API_BASE_URL",
            "https://api.groq.com/openai/v1",
        ).strip().rstrip("/")
        self.GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
        try:
            self.GROQ_TIMEOUT_SECONDS = int(os.getenv("GROQ_TIMEOUT_SECONDS", "45"))
        except ValueError:
            self.GROQ_TIMEOUT_SECONDS = 45
        try:
            self.GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "1400"))
        except ValueError:
            self.GROQ_MAX_TOKENS = 1400
        try:
            self.GROQ_TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", "0.2"))
        except ValueError:
            self.GROQ_TEMPERATURE = 0.2

        self.HOST = os.getenv("HOST", "0.0.0.0")
        self.PORT = int(os.getenv("PORT", "5000"))
        self.ENVIRONMENT = os.getenv("DOCASSIST_ENV", "development")
        self.DEBUG = _env_bool("FLASK_DEBUG", False)
        self.MAX_CONTENT_LENGTH = int(os.getenv("DOCASSIST_MAX_REQUEST_BYTES", "1048576"))

        self.CORS_ALLOWED_ORIGINS = _env_csv(
            "DOCASSIST_CORS_ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        )

        self.CACHE_TTL_SECONDS = int(os.getenv("DOCASSIST_CACHE_TTL_SECONDS", "300"))
        self.CACHE_MAX_ENTRIES = int(os.getenv("DOCASSIST_CACHE_MAX_ENTRIES", "500"))

        self.RATE_LIMIT_PER_MINUTE = int(os.getenv("DOCASSIST_RATE_LIMIT_PER_MINUTE", "60"))
        self.DISABLE_MODEL_LOAD = _env_bool("DISABLE_MODEL_LOAD", False)

        self.DB_PATH = Path(
            os.getenv("DOCASSIST_DB_PATH", str(self.DATA_DIR / "doc_assist.db"))
        ).resolve()

        self.QUALITY_BASELINE_SCORE = float(os.getenv("DOCASSIST_QUALITY_BASELINE_SCORE", "75"))
        self.QUALITY_REGRESSION_DELTA = float(os.getenv("DOCASSIST_QUALITY_REGRESSION_DELTA", "5"))

        self.JOB_QUEUE_MAX_SIZE = int(os.getenv("DOCASSIST_JOB_QUEUE_MAX", "200"))
        self.PROCESSING_TIMEOUT_SECONDS = int(os.getenv("DOCASSIST_PROCESSING_TIMEOUT_SECONDS", "120"))

        self.ALERT_ERROR_RATE_THRESHOLD = float(
            os.getenv("DOCASSIST_ALERT_ERROR_RATE", "0.2")
        )

        token_map = _parse_api_tokens(os.getenv("DOCASSIST_API_TOKENS", ""))
        self.API_TOKEN_SCOPES = token_map

        self.AUTH_ALLOW_SIGNUP = _env_bool("DOCASSIST_AUTH_ALLOW_SIGNUP", True)
        self.AUTH_SESSION_TTL_HOURS = int(os.getenv("DOCASSIST_AUTH_SESSION_TTL_HOURS", "72"))

        default_require_key = self.ENVIRONMENT.lower() == "production"
        self.REQUIRE_API_KEY = _env_bool("DOCASSIST_REQUIRE_API_KEY", default_require_key)
        if self.API_TOKEN_SCOPES:
            self.REQUIRE_API_KEY = True

    def apply_overrides(self, overrides: Dict[str, Any]) -> None:
        for key, value in overrides.items():
            if hasattr(self, key):
                setattr(self, key, value)


class MetricsStore:
    def __init__(self, alert_error_rate_threshold: float) -> None:
        self.started_at = time.time()
        self.alert_error_rate_threshold = alert_error_rate_threshold
        self.lock = threading.Lock()

        self.request_total = 0
        self.error_total = 0
        self.auth_failures = 0
        self.rate_limited = 0
        self.cache_hits = 0
        self.cache_misses = 0
        self.generated_count = 0

        self.endpoint_counts = defaultdict(int)
        self.endpoint_latency_ms = defaultdict(lambda: deque(maxlen=200))

    def record_request(self, endpoint: str, status_code: int, latency_ms: float) -> None:
        with self.lock:
            self.request_total += 1
            if status_code >= 400:
                self.error_total += 1
            self.endpoint_counts[endpoint] += 1
            self.endpoint_latency_ms[endpoint].append(float(latency_ms))

    def increment(self, field_name: str) -> None:
        with self.lock:
            current = getattr(self, field_name, 0)
            setattr(self, field_name, current + 1)

    def snapshot(self) -> Dict[str, Any]:
        with self.lock:
            uptime = int(time.time() - self.started_at)
            error_rate = (self.error_total / self.request_total) if self.request_total else 0.0

            endpoint_latency = {}
            for endpoint, values in self.endpoint_latency_ms.items():
                endpoint_latency[endpoint] = (
                    round(sum(values) / len(values), 2) if values else 0.0
                )

            alerts: List[Dict[str, Any]] = []
            if error_rate > self.alert_error_rate_threshold:
                alerts.append(
                    {
                        "name": "high_error_rate",
                        "message": "Error rate crossed configured threshold.",
                        "threshold": self.alert_error_rate_threshold,
                        "current": round(error_rate, 4),
                    }
                )

            return {
                "uptimeSeconds": uptime,
                "requestTotal": self.request_total,
                "errorTotal": self.error_total,
                "errorRate": round(error_rate, 4),
                "authFailures": self.auth_failures,
                "rateLimited": self.rate_limited,
                "cacheHits": self.cache_hits,
                "cacheMisses": self.cache_misses,
                "generatedCount": self.generated_count,
                "endpointCounts": dict(self.endpoint_counts),
                "endpointAverageLatencyMs": endpoint_latency,
                "alerts": alerts,
            }


class ResponseCache:
    def __init__(self, ttl_seconds: int, max_entries: int) -> None:
        self.ttl_seconds = max(5, ttl_seconds)
        self.max_entries = max(10, max_entries)
        self.lock = threading.Lock()
        self.entries: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            item = self.entries.get(key)
            if not item:
                return None
            if item["expiresAt"] <= time.time():
                self.entries.pop(key, None)
                return None
            return item["value"]

    def set(self, key: str, value: Dict[str, Any]) -> None:
        with self.lock:
            if len(self.entries) >= self.max_entries:
                oldest_key = min(
                    self.entries,
                    key=lambda entry_key: self.entries[entry_key]["createdAtTs"],
                )
                self.entries.pop(oldest_key, None)

            now = time.time()
            self.entries[key] = {
                "value": value,
                "createdAt": _iso_now(),
                "createdAtTs": now,
                "expiresAt": now + self.ttl_seconds,
            }

    def clear(self) -> int:
        with self.lock:
            count = len(self.entries)
            self.entries.clear()
            return count

    def stats(self) -> Dict[str, Any]:
        now = time.time()
        with self.lock:
            valid = sum(1 for item in self.entries.values() if item["expiresAt"] > now)
            return {
                "entries": valid,
                "maxEntries": self.max_entries,
                "ttlSeconds": self.ttl_seconds,
            }


class RateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.requests_per_minute = max(1, requests_per_minute)
        self.window_seconds = 60.0
        self.lock = threading.Lock()
        self.windows: Dict[str, deque] = defaultdict(deque)

    def allow(self, identity: str) -> Tuple[bool, float]:
        now = time.time()
        with self.lock:
            bucket = self.windows[identity]
            while bucket and (now - bucket[0]) > self.window_seconds:
                bucket.popleft()

            if len(bucket) >= self.requests_per_minute:
                retry_after = self.window_seconds - (now - bucket[0])
                return False, max(0.0, retry_after)

            bucket.append(now)
            return True, 0.0


class AuthManager:
    def __init__(self, config: ServerConfig, persistence: "PersistenceStore") -> None:
        self.persistence = persistence
        self.require_api_key = config.REQUIRE_API_KEY
        self.token_scopes = config.API_TOKEN_SCOPES
        self.session_ttl_hours = max(1, int(config.AUTH_SESSION_TTL_HOURS))

        if self.token_scopes:
            self.persistence.sync_env_api_keys(self.token_scopes)

    def authenticate(self, req) -> Tuple[bool, Dict[str, Any]]:
        auth_header = req.headers.get("Authorization", "")
        token = ""
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()

        if not self.require_api_key and not self.token_scopes and not token:
            return True, {
                "identity": f"ip:{req.remote_addr or 'unknown'}",
                "scopes": set(AUTH_SCOPES),
                "apiKeyRequired": False,
                "tokenSource": "anonymous",
                "userId": None,
                "user": None,
            }

        if not token:
            return False, {
                "error": "Missing API token. Use Authorization: Bearer <token>.",
            }

        session = self.persistence.get_session_by_token(token)
        if session is not None:
            self.persistence.touch_session_usage(session["id"])
            return True, {
                "identity": f"session:{session['id']}",
                "scopes": set(session["scopes"]),
                "apiKeyRequired": True,
                "tokenSource": "session",
                "userId": session.get("userId"),
                "user": session.get("user"),
                "session": {
                    "id": session.get("id"),
                    "expiresAt": session.get("expiresAt"),
                },
            }

        scopes = self.token_scopes.get(token)
        if scopes is not None:
            return True, {
                "identity": f"token:{_hash_text(token)[:12]}",
                "scopes": set(scopes),
                "apiKeyRequired": True,
                "tokenSource": "environment",
                "userId": None,
                "apiKey": {
                    "id": f"env-{_hash_text(token)[:16]}",
                    "label": "Environment key",
                    "scopes": sorted(set(scopes)),
                    "source": "environment",
                },
            }

        persisted_key = self.persistence.get_api_key_by_token(token)
        if persisted_key is None:
            return False, {
                "error": "Invalid API token.",
            }

        self.persistence.touch_api_key_usage(persisted_key["id"])

        return True, {
            "identity": f"token:{_hash_text(token)[:12]}",
            "scopes": set(persisted_key["scopes"]),
            "apiKeyRequired": True,
            "tokenSource": persisted_key.get("source", "database"),
            "userId": persisted_key.get("userId"),
            "user": persisted_key.get("user"),
            "apiKey": {
                "id": persisted_key["id"],
                "label": persisted_key.get("label"),
                "scopes": sorted(set(persisted_key["scopes"])),
                "source": persisted_key.get("source", "database"),
                "lastUsedAt": persisted_key.get("lastUsedAt"),
            },
        }

    @staticmethod
    def authorize(context: Dict[str, Any], required_scopes: Set[str]) -> bool:
        if not required_scopes:
            return True

        scopes = set(context.get("scopes", set()))
        if "admin" in scopes:
            return True
        return required_scopes.issubset(scopes)


class PersistenceStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_column(
        self,
        conn: sqlite3.Connection,
        table: str,
        column: str,
        definition: str,
    ) -> None:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
        columns = {row["name"] for row in rows}
        if column not in columns:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    def _initialize(self) -> None:
        with self.lock:
            conn = self._connect()
            try:
                cursor = conn.cursor()
                cursor.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS generations (
                        id TEXT PRIMARY KEY,
                        trace_id TEXT,
                        user_id TEXT,
                        created_at TEXT NOT NULL,
                        language TEXT NOT NULL,
                        style TEXT NOT NULL,
                        include_examples INTEGER NOT NULL,
                        include_complexity INTEGER NOT NULL,
                        project_id TEXT,
                        code_hash TEXT NOT NULL,
                        source_code TEXT,
                        documentation TEXT NOT NULL,
                        model TEXT NOT NULL,
                        confidence REAL,
                        complexity INTEGER,
                        quality_score REAL,
                        from_cache INTEGER NOT NULL,
                        processing_ms INTEGER NOT NULL,
                        status TEXT NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_generations_created_at
                    ON generations(created_at DESC);

                    CREATE INDEX IF NOT EXISTS idx_generations_language
                    ON generations(language);

                    CREATE TABLE IF NOT EXISTS jobs (
                        id TEXT PRIMARY KEY,
                        user_id TEXT,
                        status TEXT NOT NULL,
                        trace_id TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        request_json TEXT NOT NULL,
                        result_json TEXT,
                        error TEXT
                    );

                    CREATE TABLE IF NOT EXISTS projects (
                        id TEXT PRIMARY KEY,
                        user_id TEXT,
                        name TEXT NOT NULL,
                        language TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS preferences (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        settings_json TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS user_preferences (
                        user_id TEXT PRIMARY KEY,
                        settings_json TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS api_keys (
                        id TEXT PRIMARY KEY,
                        user_id TEXT,
                        label TEXT NOT NULL,
                        token_hash TEXT NOT NULL UNIQUE,
                        scopes_json TEXT NOT NULL,
                        is_active INTEGER NOT NULL DEFAULT 1,
                        source TEXT NOT NULL DEFAULT 'api',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        last_used_at TEXT
                    );

                    CREATE INDEX IF NOT EXISTS idx_api_keys_active
                    ON api_keys(is_active, updated_at DESC);

                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'manager',
                        is_active INTEGER NOT NULL DEFAULT 1,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        last_login_at TEXT
                    );

                    CREATE TABLE IF NOT EXISTS sessions (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        token_hash TEXT NOT NULL UNIQUE,
                        scopes_json TEXT NOT NULL,
                        source TEXT NOT NULL DEFAULT 'password',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        expires_at TEXT NOT NULL,
                        last_used_at TEXT,
                        revoked_at TEXT
                    );

                    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash
                    ON sessions(token_hash);

                    CREATE INDEX IF NOT EXISTS idx_sessions_user_active
                    ON sessions(user_id, revoked_at, expires_at);
                    """
                )

                # Migration support for existing databases created before user scoping.
                self._ensure_column(conn, "generations", "user_id", "TEXT")
                self._ensure_column(conn, "generations", "source_code", "TEXT")
                self._ensure_column(conn, "jobs", "user_id", "TEXT")
                self._ensure_column(conn, "projects", "user_id", "TEXT")
                self._ensure_column(conn, "api_keys", "user_id", "TEXT")

                conn.executescript(
                    """
                    CREATE INDEX IF NOT EXISTS idx_generations_user_created_at
                    ON generations(user_id, created_at DESC);

                    CREATE INDEX IF NOT EXISTS idx_projects_user_updated
                    ON projects(user_id, updated_at DESC);

                    CREATE INDEX IF NOT EXISTS idx_api_keys_user_active
                    ON api_keys(user_id, is_active, updated_at DESC);
                    """
                )

                conn.commit()
            finally:
                conn.close()

    def record_generation(self, payload: Dict[str, Any]) -> None:
        with self.lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    INSERT INTO generations (
                        id,
                        trace_id,
                        user_id,
                        created_at,
                        language,
                        style,
                        include_examples,
                        include_complexity,
                        project_id,
                        code_hash,
                        source_code,
                        documentation,
                        model,
                        confidence,
                        complexity,
                        quality_score,
                        from_cache,
                        processing_ms,
                        status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        payload["id"],
                        payload.get("traceId"),
                        payload.get("userId"),
                        payload.get("createdAt", _iso_now()),
                        payload["language"],
                        payload["style"],
                        int(bool(payload.get("includeExamples", False))),
                        int(bool(payload.get("includeComplexity", False))),
                        payload.get("projectId"),
                        payload["codeHash"],
                        payload.get("sourceCode"),
                        payload["documentation"],
                        payload["model"],
                        payload.get("confidence"),
                        payload.get("complexity"),
                        payload.get("qualityScore"),
                        int(bool(payload.get("fromCache", False))),
                        int(payload.get("processingMs", 0)),
                        payload.get("status", "success"),
                    ),
                )
                conn.commit()
            finally:
                conn.close()

    def list_generations(
        self,
        limit: int,
        language: Optional[str] = None,
        project_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        clauses = []
        params: List[Any] = []
        if user_id:
            clauses.append("user_id = ?")
            params.append(user_id)
        else:
            clauses.append("user_id IS NULL")
        if language:
            clauses.append("language = ?")
            params.append(language)
        if project_id:
            clauses.append("project_id = ?")
            params.append(project_id)

        where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        query = (
            "SELECT id, trace_id, user_id, created_at, language, style, include_examples, "
            "include_complexity, project_id, model, confidence, complexity, quality_score, "
            "from_cache, processing_ms, SUBSTR(source_code, 1, 300) AS inputSnippet, "
            "SUBSTR(documentation, 1, 300) AS outputSnippet "
            f"FROM generations {where_clause} "
            "ORDER BY created_at DESC LIMIT ?"
        )
        params.append(limit)

        with self.lock:
            conn = self._connect()
            try:
                rows = conn.execute(query, params).fetchall()
                return [dict(row) for row in rows]
            finally:
                conn.close()

    def get_generation(
        self,
        generation_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        with self.lock:
            conn = self._connect()
            try:
                if user_id:
                    row = conn.execute(
                        """
                        SELECT id, trace_id, user_id, created_at, language, style,
                               include_examples, include_complexity, project_id, model,
                               confidence, complexity, quality_score, from_cache,
                               processing_ms, source_code, documentation
                        FROM generations
                        WHERE id = ? AND user_id = ?
                        LIMIT 1
                        """,
                        (generation_id, user_id),
                    ).fetchone()
                else:
                    row = conn.execute(
                        """
                        SELECT id, trace_id, user_id, created_at, language, style,
                               include_examples, include_complexity, project_id, model,
                               confidence, complexity, quality_score, from_cache,
                               processing_ms, source_code, documentation
                        FROM generations
                        WHERE id = ? AND user_id IS NULL
                        LIMIT 1
                        """,
                        (generation_id,),
                    ).fetchone()

                return dict(row) if row else None
            finally:
                conn.close()

    def upsert_job(self, payload: Dict[str, Any]) -> None:
        with self.lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    INSERT INTO jobs (id, user_id, status, trace_id, created_at, updated_at, request_json, result_json, error)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        user_id = excluded.user_id,
                        status = excluded.status,
                        trace_id = excluded.trace_id,
                        updated_at = excluded.updated_at,
                        request_json = excluded.request_json,
                        result_json = excluded.result_json,
                        error = excluded.error
                    """,
                    (
                        payload["id"],
                        payload.get("userId"),
                        payload["status"],
                        payload.get("traceId"),
                        payload.get("createdAt", _iso_now()),
                        payload.get("updatedAt", _iso_now()),
                        json.dumps(payload.get("request", {})),
                        json.dumps(payload.get("result")) if payload.get("result") is not None else None,
                        payload.get("error"),
                    ),
                )
                conn.commit()
            finally:
                conn.close()

    def get_job(self, job_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self.lock:
            conn = self._connect()
            try:
                if user_id:
                    row = conn.execute(
                        "SELECT * FROM jobs WHERE id = ? AND user_id = ?",
                        (job_id, user_id),
                    ).fetchone()
                else:
                    row = conn.execute(
                        "SELECT * FROM jobs WHERE id = ? AND user_id IS NULL",
                        (job_id,),
                    ).fetchone()
                if not row:
                    return None
                result = dict(row)
                if result.get("request_json"):
                    result["request"] = json.loads(result["request_json"])
                if result.get("result_json"):
                    result["result"] = json.loads(result["result_json"])
                return result
            finally:
                conn.close()

    def list_projects(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.lock:
            conn = self._connect()
            try:
                if user_id:
                    rows = conn.execute(
                        "SELECT id, user_id, name, language, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC",
                        (user_id,),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        "SELECT id, user_id, name, language, created_at, updated_at FROM projects WHERE user_id IS NULL ORDER BY updated_at DESC"
                    ).fetchall()
                return [dict(row) for row in rows]
            finally:
                conn.close()

    def get_project(self, project_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self.lock:
            conn = self._connect()
            try:
                if user_id:
                    row = conn.execute(
                        """
                        SELECT id, user_id, name, language, created_at, updated_at
                        FROM projects
                        WHERE id = ? AND user_id = ?
                        LIMIT 1
                        """,
                        (project_id, user_id),
                    ).fetchone()
                else:
                    row = conn.execute(
                        """
                        SELECT id, user_id, name, language, created_at, updated_at
                        FROM projects
                        WHERE id = ? AND user_id IS NULL
                        LIMIT 1
                        """,
                        (project_id,),
                    ).fetchone()

                return dict(row) if row else None
            finally:
                conn.close()

    def list_project_generations(
        self,
        project_id: str,
        user_id: Optional[str] = None,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        safe_limit = _clamp(int(limit), 1, 5000)
        with self.lock:
            conn = self._connect()
            try:
                if user_id:
                    rows = conn.execute(
                        """
                        SELECT id, trace_id, user_id, created_at, language, style,
                               include_examples, include_complexity, project_id, model,
                               confidence, complexity, quality_score, from_cache,
                               processing_ms, source_code, documentation
                        FROM generations
                        WHERE project_id = ? AND user_id = ?
                        ORDER BY created_at ASC
                        LIMIT ?
                        """,
                        (project_id, user_id, safe_limit),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        """
                        SELECT id, trace_id, user_id, created_at, language, style,
                               include_examples, include_complexity, project_id, model,
                               confidence, complexity, quality_score, from_cache,
                               processing_ms, source_code, documentation
                        FROM generations
                        WHERE project_id = ? AND user_id IS NULL
                        ORDER BY created_at ASC
                        LIMIT ?
                        """,
                        (project_id, safe_limit),
                    ).fetchall()

                return [dict(row) for row in rows]
            finally:
                conn.close()

    def upsert_project(self, project: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        now = _iso_now()
        project_id = project.get("id") or f"project-{uuid.uuid4().hex[:12]}"
        payload = {
            "id": project_id,
            "userId": user_id,
            "name": str(project.get("name", "")).strip(),
            "language": str(project.get("language", "python")).strip().lower() or "python",
            "createdAt": project.get("createdAt") or now,
            "updatedAt": now,
        }

        with self.lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    INSERT INTO projects (id, user_id, name, language, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        user_id = excluded.user_id,
                        name = excluded.name,
                        language = excluded.language,
                        updated_at = excluded.updated_at
                    """,
                    (
                        payload["id"],
                        payload["userId"],
                        payload["name"],
                        payload["language"],
                        payload["createdAt"],
                        payload["updatedAt"],
                    ),
                )
                conn.commit()
                return payload
            finally:
                conn.close()

    def delete_project(self, project_id: str, user_id: Optional[str] = None) -> bool:
        with self.lock:
            conn = self._connect()
            try:
                if user_id:
                    cursor = conn.execute(
                        "DELETE FROM projects WHERE id = ? AND user_id = ?",
                        (project_id, user_id),
                    )
                else:
                    cursor = conn.execute(
                        "DELETE FROM projects WHERE id = ? AND user_id IS NULL",
                        (project_id,),
                    )
                conn.commit()
                return cursor.rowcount > 0
            finally:
                conn.close()

    def get_preferences(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        with self.lock:
            conn = self._connect()
            try:
                if user_id:
                    row = conn.execute(
                        "SELECT settings_json, updated_at FROM user_preferences WHERE user_id = ?",
                        (user_id,),
                    ).fetchone()
                else:
                    row = conn.execute(
                        "SELECT settings_json, updated_at FROM preferences WHERE id = 1"
                    ).fetchone()
                if not row:
                    return {
                        "settings": {},
                        "updatedAt": None,
                    }

                return {
                    "settings": json.loads(row["settings_json"]),
                    "updatedAt": row["updated_at"],
                }
            finally:
                conn.close()

    def set_preferences(self, settings: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        payload = {
            "settings": settings,
            "updatedAt": _iso_now(),
        }

        with self.lock:
            conn = self._connect()
            try:
                if user_id:
                    conn.execute(
                        """
                        INSERT INTO user_preferences (user_id, settings_json, updated_at)
                        VALUES (?, ?, ?)
                        ON CONFLICT(user_id) DO UPDATE SET
                            settings_json = excluded.settings_json,
                            updated_at = excluded.updated_at
                        """,
                        (user_id, json.dumps(settings), payload["updatedAt"]),
                    )
                else:
                    conn.execute(
                        """
                        INSERT INTO preferences (id, settings_json, updated_at)
                        VALUES (1, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            settings_json = excluded.settings_json,
                            updated_at = excluded.updated_at
                        """,
                        (json.dumps(settings), payload["updatedAt"]),
                    )
                conn.commit()
            finally:
                conn.close()

        return payload

    def sync_env_api_keys(self, token_scopes: Dict[str, Set[str]]) -> None:
        if not token_scopes:
            return

        now = _iso_now()
        with self.lock:
            conn = self._connect()
            try:
                for token, scopes in token_scopes.items():
                    token_hash = _hash_text(token)
                    key_id = f"env-{token_hash[:16]}"
                    label = f"Environment key {token_hash[:6]}"
                    scope_set = _normalize_scopes(scopes)

                    conn.execute(
                        """
                        INSERT INTO api_keys (
                            id, user_id, label, token_hash, scopes_json, is_active, source, created_at, updated_at, last_used_at
                        ) VALUES (?, NULL, ?, ?, ?, 1, 'environment', ?, ?, NULL)
                        ON CONFLICT(id) DO UPDATE SET
                            user_id = NULL,
                            label = excluded.label,
                            scopes_json = excluded.scopes_json,
                            is_active = 1,
                            updated_at = excluded.updated_at
                        """,
                        (
                            key_id,
                            label,
                            token_hash,
                            json.dumps(sorted(scope_set)),
                            now,
                            now,
                        ),
                    )

                conn.commit()
            finally:
                conn.close()

    def get_api_key_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        token_hash = _hash_text(token)
        with self.lock:
            conn = self._connect()
            try:
                row = conn.execute(
                    """
                    SELECT id, user_id, label, scopes_json, source, last_used_at
                    FROM api_keys
                    WHERE token_hash = ? AND is_active = 1
                    LIMIT 1
                    """,
                    (token_hash,),
                ).fetchone()
                if not row:
                    return None

                user_row = None
                if row["user_id"]:
                    user_row = conn.execute(
                        "SELECT id, name, email, role, is_active FROM users WHERE id = ?",
                        (row["user_id"],),
                    ).fetchone()
                    if user_row and int(user_row["is_active"]) != 1:
                        return None

                return {
                    "id": row["id"],
                    "userId": row["user_id"],
                    "label": row["label"],
                    "scopes": _normalize_scopes(json.loads(row["scopes_json"]), include_admin_if_empty=False),
                    "source": row["source"],
                    "lastUsedAt": row["last_used_at"],
                    "user": dict(user_row) if user_row else None,
                }
            finally:
                conn.close()

    def touch_api_key_usage(self, key_id: str) -> None:
        now = _iso_now()
        with self.lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    UPDATE api_keys
                    SET last_used_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (now, now, key_id),
                )
                conn.commit()
            finally:
                conn.close()

    def list_api_keys(
        self,
        include_inactive: bool = False,
        user_id: Optional[str] = None,
        include_all: bool = False,
    ) -> List[Dict[str, Any]]:
        query = (
            "SELECT id, user_id, label, scopes_json, is_active, source, created_at, updated_at, last_used_at "
            "FROM api_keys "
        )
        params: List[Any] = []

        clauses: List[str] = []
        if user_id and not include_all:
            clauses.append("user_id = ?")
            params.append(user_id)

        if not include_inactive:
            clauses.append("is_active = 1")

        if clauses:
            query += f"WHERE {' AND '.join(clauses)} "

        query += "ORDER BY updated_at DESC"

        with self.lock:
            conn = self._connect()
            try:
                rows = conn.execute(query, params).fetchall()
                result = []
                for row in rows:
                    scopes = _normalize_scopes(
                        json.loads(row["scopes_json"]),
                        include_admin_if_empty=False,
                    )
                    result.append(
                        {
                            "id": row["id"],
                            "userId": row["user_id"],
                            "label": row["label"],
                            "scopes": sorted(scopes),
                            "isActive": bool(row["is_active"]),
                            "source": row["source"],
                            "createdAt": row["created_at"],
                            "updatedAt": row["updated_at"],
                            "lastUsedAt": row["last_used_at"],
                        }
                    )
                return result
            finally:
                conn.close()

    def create_api_key(
        self,
        label: str,
        scopes: Any,
        source: str = "api",
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = _iso_now()
        scope_set = _normalize_scopes(scopes)
        key_id = f"key-{uuid.uuid4().hex[:16]}"
        raw_token = f"dka_{secrets.token_urlsafe(28)}"
        token_hash = _hash_text(raw_token)
        safe_label = str(label or "").strip()[:120] or f"Key {key_id[-6:]}"

        with self.lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    INSERT INTO api_keys (
                        id,
                        user_id,
                        label,
                        token_hash,
                        scopes_json,
                        is_active,
                        source,
                        created_at,
                        updated_at,
                        last_used_at
                    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, NULL)
                    """,
                    (
                        key_id,
                        user_id,
                        safe_label,
                        token_hash,
                        json.dumps(sorted(scope_set)),
                        source,
                        now,
                        now,
                    ),
                )
                conn.commit()
            finally:
                conn.close()

        return {
            "key": {
                "id": key_id,
                "userId": user_id,
                "label": safe_label,
                "scopes": sorted(scope_set),
                "isActive": True,
                "source": source,
                "createdAt": now,
                "updatedAt": now,
                "lastUsedAt": None,
            },
            "token": raw_token,
        }

    def revoke_api_key(self, key_id: str, user_id: Optional[str] = None) -> bool:
        now = _iso_now()
        with self.lock:
            conn = self._connect()
            try:
                if user_id:
                    cursor = conn.execute(
                        """
                        UPDATE api_keys
                        SET is_active = 0, updated_at = ?
                        WHERE id = ? AND user_id = ? AND is_active = 1 AND source != 'environment'
                        """,
                        (now, key_id, user_id),
                    )
                else:
                    cursor = conn.execute(
                        """
                        UPDATE api_keys
                        SET is_active = 0, updated_at = ?
                        WHERE id = ? AND is_active = 1 AND source != 'environment'
                        """,
                        (now, key_id),
                    )
                conn.commit()
                return cursor.rowcount > 0
            finally:
                conn.close()

    def clear_generations(self, project_id: Optional[str] = None, user_id: Optional[str] = None) -> int:
        query = "DELETE FROM generations"
        params: List[Any] = []
        clauses: List[str] = []
        if user_id:
            clauses.append("user_id = ?")
            params.append(user_id)
        else:
            clauses.append("user_id IS NULL")
        if project_id:
            clauses.append("project_id = ?")
            params.append(project_id)

        if clauses:
            query += f" WHERE {' AND '.join(clauses)}"

        with self.lock:
            conn = self._connect()
            try:
                cursor = conn.execute(query, params)
                conn.commit()
                return cursor.rowcount
            finally:
                conn.close()

    def count_users(self) -> int:
        with self.lock:
            conn = self._connect()
            try:
                row = conn.execute("SELECT COUNT(1) AS total FROM users").fetchone()
                return int(row["total"] if row else 0)
            finally:
                conn.close()

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        normalized_email = _normalize_email(email)
        if not normalized_email:
            return None

        with self.lock:
            conn = self._connect()
            try:
                row = conn.execute(
                    """
                    SELECT id, name, email, password_hash, role, is_active, created_at, updated_at, last_login_at
                    FROM users
                    WHERE email = ?
                    LIMIT 1
                    """,
                    (normalized_email,),
                ).fetchone()
                return dict(row) if row else None
            finally:
                conn.close()

    def get_user_by_id(self, user_id: Optional[str]) -> Optional[Dict[str, Any]]:
        if not user_id:
            return None

        with self.lock:
            conn = self._connect()
            try:
                row = conn.execute(
                    """
                    SELECT id, name, email, role, is_active, created_at, updated_at, last_login_at
                    FROM users
                    WHERE id = ?
                    LIMIT 1
                    """,
                    (user_id,),
                ).fetchone()
                return dict(row) if row else None
            finally:
                conn.close()

    def create_user(
        self,
        *,
        name: str,
        email: str,
        password_hash: str,
        role: str = "manager",
    ) -> Optional[Dict[str, Any]]:
        user_id = f"usr-{uuid.uuid4().hex[:16]}"
        now = _iso_now()
        safe_name = str(name or "").strip()[:120]
        safe_email = _normalize_email(email)
        safe_role = str(role or "manager").strip().lower() or "manager"

        if not safe_name or not safe_email:
            return None

        with self.lock:
            conn = self._connect()
            try:
                try:
                    conn.execute(
                        """
                        INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at, last_login_at)
                        VALUES (?, ?, ?, ?, ?, 1, ?, ?, NULL)
                        """,
                        (user_id, safe_name, safe_email, password_hash, safe_role, now, now),
                    )
                    conn.commit()
                except sqlite3.IntegrityError:
                    return None

                return {
                    "id": user_id,
                    "name": safe_name,
                    "email": safe_email,
                    "role": safe_role,
                    "is_active": 1,
                    "created_at": now,
                    "updated_at": now,
                    "last_login_at": None,
                }
            finally:
                conn.close()

    def touch_user_login(self, user_id: str) -> None:
        now = _iso_now()
        with self.lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    UPDATE users
                    SET last_login_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (now, now, user_id),
                )
                conn.commit()
            finally:
                conn.close()

    def create_user_session(
        self,
        *,
        user_id: str,
        scopes: Set[str],
        ttl_hours: int,
        source: str = "password",
    ) -> Dict[str, Any]:
        session_id = f"ses-{uuid.uuid4().hex[:16]}"
        token = f"dsu_{secrets.token_urlsafe(28)}"
        token_hash = _hash_text(token)
        now_dt = datetime.now(timezone.utc)
        now = now_dt.isoformat()
        expires_at = (now_dt + timedelta(hours=max(1, int(ttl_hours)))).isoformat()

        with self.lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    INSERT INTO sessions (
                        id,
                        user_id,
                        token_hash,
                        scopes_json,
                        source,
                        created_at,
                        updated_at,
                        expires_at,
                        last_used_at,
                        revoked_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
                    """,
                    (
                        session_id,
                        user_id,
                        token_hash,
                        json.dumps(sorted(set(scopes))),
                        source,
                        now,
                        now,
                        expires_at,
                    ),
                )
                conn.commit()
            finally:
                conn.close()

        return {
            "id": session_id,
            "token": token,
            "expiresAt": expires_at,
        }

    def get_session_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        token_hash = _hash_text(token)
        now_dt = datetime.now(timezone.utc)

        with self.lock:
            conn = self._connect()
            try:
                row = conn.execute(
                    """
                    SELECT
                        s.id,
                        s.user_id,
                        s.scopes_json,
                        s.expires_at,
                        s.revoked_at,
                        u.name,
                        u.email,
                        u.role,
                        u.is_active
                    FROM sessions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.token_hash = ?
                    LIMIT 1
                    """,
                    (token_hash,),
                ).fetchone()
                if not row:
                    return None

                if row["revoked_at"] is not None:
                    return None

                if row["is_active"] != 1:
                    return None

                expires_at_raw = str(row["expires_at"] or "")
                try:
                    expires_at_dt = datetime.fromisoformat(expires_at_raw)
                except Exception:
                    return None

                if expires_at_dt.tzinfo is None:
                    expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)

                if expires_at_dt <= now_dt:
                    return None

                scopes = _normalize_scopes(json.loads(row["scopes_json"]), include_admin_if_empty=False)
                return {
                    "id": row["id"],
                    "userId": row["user_id"],
                    "scopes": scopes,
                    "expiresAt": row["expires_at"],
                    "user": {
                        "id": row["user_id"],
                        "name": row["name"],
                        "email": row["email"],
                        "role": row["role"],
                    },
                }
            finally:
                conn.close()

    def touch_session_usage(self, session_id: str) -> None:
        now = _iso_now()
        with self.lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    UPDATE sessions
                    SET last_used_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (now, now, session_id),
                )
                conn.commit()
            finally:
                conn.close()

    def revoke_session_by_token(self, token: str) -> bool:
        token_hash = _hash_text(token)
        now = _iso_now()
        with self.lock:
            conn = self._connect()
            try:
                cursor = conn.execute(
                    """
                    UPDATE sessions
                    SET revoked_at = ?, updated_at = ?
                    WHERE token_hash = ? AND revoked_at IS NULL
                    """,
                    (now, now, token_hash),
                )
                conn.commit()
                return cursor.rowcount > 0
            finally:
                conn.close()

    def get_user_progress_summary(self, user_id: Optional[str]) -> Dict[str, Any]:
        with self.lock:
            conn = self._connect()
            try:
                if user_id:
                    row = conn.execute(
                        """
                        SELECT
                            (SELECT COUNT(1) FROM projects WHERE user_id = ?) AS project_count,
                            (SELECT COUNT(1) FROM generations WHERE user_id = ?) AS generation_count,
                            (SELECT COUNT(1) FROM api_keys WHERE user_id = ? AND is_active = 1) AS active_key_count
                        """,
                        (user_id, user_id, user_id),
                    ).fetchone()
                else:
                    row = conn.execute(
                        """
                        SELECT
                            (SELECT COUNT(1) FROM projects WHERE user_id IS NULL) AS project_count,
                            (SELECT COUNT(1) FROM generations WHERE user_id IS NULL) AS generation_count,
                            (SELECT COUNT(1) FROM api_keys WHERE user_id IS NULL AND is_active = 1) AS active_key_count
                        """
                    ).fetchone()

                return {
                    "projectCount": int(row["project_count"] if row else 0),
                    "generationCount": int(row["generation_count"] if row else 0),
                    "activeKeyCount": int(row["active_key_count"] if row else 0),
                }
            finally:
                conn.close()


class QualityEvaluator:
    def __init__(self, baseline: float, regression_delta: float) -> None:
        self.baseline = baseline
        self.regression_delta = regression_delta
        self.history: deque = deque(maxlen=1000)
        self.lock = threading.Lock()

    def evaluate(
        self,
        code: str,
        documentation: str,
        language: str,
        options: Dict[str, Any],
        complexity: int,
    ) -> Dict[str, Any]:
        function_name, parameters = _extract_signature(code)
        documentation_lower = documentation.lower()

        checks = []
        score = 100.0

        if len(documentation.strip()) < 40:
            score -= 20
            checks.append("documentation_too_short")

        if parameters:
            covered = 0
            for parameter in parameters:
                if parameter.lower() in documentation_lower:
                    covered += 1
            coverage = covered / len(parameters)
            if coverage < 0.6:
                score -= 20
                checks.append("low_parameter_coverage")

        if "return" not in documentation_lower:
            score -= 10
            checks.append("missing_return_notes")

        style = options["style"]
        if style == "google" and "args:" not in documentation_lower:
            score -= 10
            checks.append("google_style_missing_args")
        if style == "numpy" and "parameters" not in documentation_lower:
            score -= 10
            checks.append("numpy_style_missing_parameters")
        if style == "sphinx" and ":param" not in documentation_lower:
            score -= 10
            checks.append("sphinx_style_missing_param_tags")

        if options["includeExamples"] and "example" not in documentation_lower:
            score -= 8
            checks.append("missing_examples")

        if options["includeComplexity"]:
            has_complexity_marker = "complexity" in documentation_lower or "o(" in documentation_lower
            if not has_complexity_marker:
                score -= 8
                checks.append("missing_complexity")

        quality_score = max(0.0, round(score, 2))

        report = {
            "score": quality_score,
            "checks": checks,
            "functionName": function_name,
            "parameterCount": len(parameters),
            "estimatedComplexity": complexity,
        }
        return report

    def record(self, score: float, used_fallback: bool) -> None:
        with self.lock:
            self.history.append(
                {
                    "createdAt": _iso_now(),
                    "score": float(score),
                    "usedFallback": bool(used_fallback),
                }
            )

    def summary(self) -> Dict[str, Any]:
        with self.lock:
            total = len(self.history)
            if total == 0:
                return {
                    "totalRuns": 0,
                    "averageQualityScore": 0.0,
                    "baselineScore": self.baseline,
                    "regressionDetected": False,
                    "fallbackRate": 0.0,
                }

            scores = [entry["score"] for entry in self.history]
            avg = sum(scores) / total
            recent = list(self.history)[-20:]
            recent_avg = sum(entry["score"] for entry in recent) / len(recent)
            fallback_rate = (
                sum(1 for entry in self.history if entry["usedFallback"]) / total
            ) * 100

            regression_detected = recent_avg < (self.baseline - self.regression_delta)

            return {
                "totalRuns": total,
                "averageQualityScore": round(avg, 2),
                "recentAverageQualityScore": round(recent_avg, 2),
                "baselineScore": self.baseline,
                "regressionDelta": self.regression_delta,
                "regressionDetected": regression_detected,
                "fallbackRate": round(fallback_rate, 2),
            }


def _extract_signature(code: str) -> Tuple[Optional[str], List[str]]:
    match = re.search(r"def\s+(\w+)\s*\(([^)]*)\)", code)
    if match:
        name = match.group(1)
        params = [
            part.strip().split("=")[0].strip()
            for part in match.group(2).split(",")
            if part.strip()
        ]
        return name, params

    match = re.search(
        r"function\s+(\w+)\s*\(([^)]*)\)|const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>",
        code,
    )
    if match:
        name = match.group(1) or match.group(3)
        raw_params = (match.group(2) or match.group(4) or "").split(",")
        params = [part.strip() for part in raw_params if part.strip()]
        return name, params

    return None, []


def _estimate_complexity(code: str) -> int:
    keyword_hits = re.findall(r"\b(if|elif|for|while|case|catch|except|switch)\b", code)
    symbol_hits = code.count("&&") + code.count("||") + code.count("?")
    return 1 + len(keyword_hits) + symbol_hits


def _validate_syntax(code: str, language: str) -> Tuple[bool, List[Dict[str, Any]]]:
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

    bracket_pairs = [("(", ")"), ("{", "}"), ("[", "]")]
    for left, right in bracket_pairs:
        if code.count(left) != code.count(right):
            errors.append({"message": f"Unbalanced brackets: '{left}' and '{right}'"})

    return len(errors) == 0, errors


class ModelService:
    def __init__(self, config: ServerConfig, logger: logging.Logger) -> None:
        self.config = config
        self.logger = logger
        self.provider = str(config.MODEL_PROVIDER or "auto").strip().lower()
        if self.provider not in {"auto", "groq", "local"}:
            self.provider = "auto"

        self.groq_ready = bool(
            config.GROQ_API_KEY
            and config.GROQ_MODEL
            and config.GROQ_API_BASE_URL
        )
        self.tokenizer = None
        self.model = None
        self.model_ready = False
        self.model_load_error: Optional[str] = None
        self.model_display_name = "Fallback mode"
        self.model_signature = "fallback"
        self.preflight_checks: List[Dict[str, Any]] = []

        self._run_preflight_checks()
        self._load_model()

    def _add_check(self, name: str, passed: bool, message: str, severity: str = "error") -> None:
        self.preflight_checks.append(
            {
                "name": name,
                "status": "pass" if passed else "fail",
                "severity": "info" if passed else severity,
                "message": message,
            }
        )

    def _run_preflight_checks(self) -> None:
        self._add_check(
            "request_size_limit",
            self.config.MAX_CONTENT_LENGTH > 0,
            f"MAX_CONTENT_LENGTH={self.config.MAX_CONTENT_LENGTH}",
        )

        self._add_check(
            "model_provider",
            self.provider in {"auto", "groq", "local"},
            f"Model provider: {self.provider}",
            severity="warning",
        )

        self._add_check(
            "groq_model",
            bool(self.config.GROQ_MODEL),
            f"Groq model: {self.config.GROQ_MODEL or '(missing)'}",
            severity="warning",
        )

        self._add_check(
            "groq_api_key",
            bool(self.config.GROQ_API_KEY),
            "GROQ_API_KEY detected." if self.config.GROQ_API_KEY else "GROQ_API_KEY is not set.",
            severity="warning",
        )

        finetuned_path_exists = self.config.FINETUNED_PATH.exists()
        self._add_check(
            "finetuned_path_exists",
            finetuned_path_exists,
            f"Fine-tuned model path: {self.config.FINETUNED_PATH}",
        )

        model_files_present = any(
            (self.config.FINETUNED_PATH / filename).exists()
            for filename in ["model.safetensors", "pytorch_model.bin"]
        )
        self._add_check(
            "finetuned_weights_present",
            model_files_present,
            "Model weight file detected." if model_files_present else "No model weight file found.",
            severity="warning",
        )

        transformers_ok = TRANSFORMERS_IMPORT_ERROR is None and AutoTokenizer is not None
        self._add_check(
            "transformers_available",
            transformers_ok,
            "transformers import ready." if transformers_ok else f"transformers import failed: {TRANSFORMERS_IMPORT_ERROR}",
        )

        torch_ok = torch is not None
        self._add_check(
            "torch_available",
            torch_ok,
            "torch import ready." if torch_ok else "torch is unavailable.",
        )

        tokenizer_source_ok = bool(str(self.config.TOKENIZER_SOURCE).strip())
        self._add_check(
            "tokenizer_source",
            tokenizer_source_ok,
            f"Tokenizer source: {self.config.TOKENIZER_SOURCE or '(missing)'}",
        )

    def _load_model(self) -> None:
        if self.provider in {"auto", "groq"} and self.groq_ready:
            self.model_ready = True
            self.model_load_error = None
            self.model_display_name = f"Groq API ({self.config.GROQ_MODEL})"
            self.model_signature = _hash_text(
                f"groq:{self.config.GROQ_API_BASE_URL}:{self.config.GROQ_MODEL}"
            )[:16]
            return

        if self.provider == "groq" and not self.groq_ready:
            self.model_load_error = (
                "Groq provider selected but GROQ_API_KEY or GROQ_MODEL is missing. "
                "Falling back to local model/fallback templates."
            )

        if self.config.DISABLE_MODEL_LOAD:
            self.model_ready = False
            if not self.model_load_error:
                self.model_load_error = "Model loading disabled by DISABLE_MODEL_LOAD."
            self.model_display_name = "Fallback mode (model load disabled)"
            self.model_signature = "fallback-disabled"
            return

        if TRANSFORMERS_IMPORT_ERROR is not None or AutoTokenizer is None or AutoModelForSeq2SeqLM is None:
            self.model_ready = False
            self.model_load_error = f"transformers unavailable: {TRANSFORMERS_IMPORT_ERROR}"
            self.model_display_name = "Fallback mode (transformers unavailable)"
            self.model_signature = "fallback-transformers"
            return

        if torch is None:
            self.model_ready = False
            self.model_load_error = "torch unavailable"
            self.model_display_name = "Fallback mode (torch unavailable)"
            self.model_signature = "fallback-torch"
            return

        if not self.config.FINETUNED_PATH.exists():
            self.model_ready = False
            self.model_load_error = f"Missing model path: {self.config.FINETUNED_PATH}"
            self.model_display_name = "Fallback mode (missing fine-tuned model path)"
            self.model_signature = "fallback-missing-model"
            return

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(self.config.TOKENIZER_SOURCE, use_fast=False)
            self.model = AutoModelForSeq2SeqLM.from_pretrained(str(self.config.FINETUNED_PATH))
            self.model_ready = True
            self.model_load_error = None
            self.model_display_name = (
                f"{self.config.TOKENIZER_SOURCE} + local fine-tune ({self.config.FINETUNED_PATH})"
            )
            signature_source = f"{self.config.TOKENIZER_SOURCE}:{self.config.FINETUNED_PATH}"
            self.model_signature = _hash_text(signature_source)[:16]
        except Exception as exc:
            self.model_ready = False
            self.model_load_error = str(exc)
            self.model_display_name = (
                f"Fallback mode (model unavailable at {self.config.FINETUNED_PATH})"
            )
            self.model_signature = "fallback-load-failure"

    @staticmethod
    def _looks_like_code(text: str) -> bool:
        if not text:
            return True
        code_tokens = [
            "def ",
            "return ",
            "for ",
            "if ",
            "while ",
            "class ",
            "function ",
            "=>",
        ]
        return any(token in text for token in code_tokens)

    def _build_groq_document_prompt(
        self,
        code: str,
        language: str,
        style: str,
        include_examples: bool,
        include_complexity: bool,
        complexity: int,
    ) -> str:
        max_chars = 9000
        trimmed_code = code
        if len(trimmed_code) > max_chars:
            trimmed_code = f"{trimmed_code[:max_chars]}\n# ... code truncated for model context"

        return (
            "Generate thorough technical documentation for this code in markdown document format.\n"
            "Focus on step-by-step code traversal and clear explanation for engineers.\n\n"
            "Required sections (use these headings):\n"
            "# Code Documentation Report\n"
            "## Summary\n"
            "## Code Traversal\n"
            "## Inputs and Outputs\n"
            "## Return Behavior\n"
            "## Edge Cases and Error Handling\n"
            "## Complexity Analysis\n"
            "## Example Usage\n"
            "## Maintenance Notes\n\n"
            "Rules:\n"
            "- Explain traversal in a numbered sequence following real control flow.\n"
            "- Mention variable/data transformations where relevant.\n"
            "- Use concise technical language, no placeholders, no markdown code fences around the whole response.\n"
            f"- Language: {language}\n"
            f"- Documentation style preference: {style}\n"
            f"- Include examples: {include_examples}\n"
            f"- Include complexity details: {include_complexity}\n"
            f"- Estimated complexity signal from server: {complexity}\n\n"
            "Code:\n"
            "```\n"
            f"{trimmed_code}\n"
            "```"
        )

    @staticmethod
    def _normalize_groq_document(raw_content: str) -> str:
        content = str(raw_content or "").strip()
        if not content:
            return ""

        if content.startswith("```"):
            content = re.sub(r"^```[a-zA-Z0-9_-]*\n?", "", content)
            content = re.sub(r"\n?```$", "", content).strip()

        if not content.lstrip().startswith("#"):
            content = f"# Code Documentation Report\n\n{content}"

        return content

    def _generate_with_groq(
        self,
        code: str,
        language: str,
        style: str,
        include_examples: bool,
        include_complexity: bool,
        complexity: int,
    ) -> Optional[str]:
        if not self.groq_ready:
            return None

        prompt = self._build_groq_document_prompt(
            code=code,
            language=language,
            style=style,
            include_examples=include_examples,
            include_complexity=include_complexity,
            complexity=complexity,
        )

        endpoint = f"{self.config.GROQ_API_BASE_URL}/chat/completions"
        payload = {
            "model": self.config.GROQ_MODEL,
            "temperature": float(self.config.GROQ_TEMPERATURE),
            "max_tokens": int(self.config.GROQ_MAX_TOKENS),
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a senior software architect writing implementation-grade "
                        "technical documentation."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        }

        request_obj = urllib_request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.config.GROQ_API_KEY}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "DocAssist/2.0 (+https://github.com/SampathGannena/Doc_assist)",
            },
            method="POST",
        )

        try:
            with urllib_request.urlopen(
                request_obj,
                timeout=max(5, int(self.config.GROQ_TIMEOUT_SECONDS)),
            ) as response:
                response_body = response.read().decode("utf-8", errors="replace")
            response_json = json.loads(response_body)

            choices = response_json.get("choices") or []
            if not choices:
                return None

            message = choices[0].get("message") or {}
            content = message.get("content", "")
            if isinstance(content, list):
                chunks = []
                for item in content:
                    if isinstance(item, str):
                        chunks.append(item)
                    elif isinstance(item, dict):
                        if item.get("type") == "text":
                            chunks.append(str(item.get("text", "")))
                content = "\n".join(chunks)

            normalized = self._normalize_groq_document(str(content or ""))
            return normalized or None

        except urllib_error.HTTPError as exc:
            response_text = ""
            try:
                response_text = exc.read().decode("utf-8", errors="replace")
            except Exception:
                response_text = ""

            _log_event(
                self.logger,
                logging.WARNING,
                "groq_generation_failed",
                statusCode=exc.code,
                reason=str(exc),
                response=response_text[:800],
            )
            return None
        except Exception as exc:
            _log_event(
                self.logger,
                logging.WARNING,
                "groq_generation_failed",
                error=str(exc),
            )
            return None

    def _fallback_docstring(
        self,
        code: str,
        language: str,
        style: str,
        include_examples: bool,
        include_complexity: bool,
        complexity: int,
    ) -> str:
        function_name, params = _extract_signature(code)
        function_name = function_name or "Function"

        if language == "python":
            if style == "numpy":
                lines = [
                    '"""',
                    f"{function_name} documentation.",
                    "",
                    "Parameters",
                    "----------",
                ]
                if params:
                    for param in params:
                        lines.append(f"{param} : Any")
                        lines.append(f"    Description for {param}.")
                else:
                    lines.append("None")

                lines += ["", "Returns", "-------", "Any", "    Return value description."]

                if include_examples:
                    lines += ["", "Examples", "--------", f">>> {function_name}(...)"]

                if include_complexity:
                    lines += ["", "Notes", "-----", f"Estimated complexity: O({complexity})"]

                lines.append('"""')
                return "\n".join(lines)

            if style == "sphinx":
                lines = ['"""', f"{function_name} documentation."]
                for param in params:
                    lines.append(f":param {param}: Description for {param}.")
                lines.append(":return: Return value description.")

                if include_examples:
                    lines.append(":example: Example usage of the function.")

                if include_complexity:
                    lines.append(f":complexity: O({complexity})")

                lines.append('"""')
                return "\n".join(lines)

            lines = ['"""', f"{function_name} documentation."]
            if params:
                lines.append("")
                lines.append("Args:")
                for param in params:
                    lines.append(f"    {param}: Description for {param}.")

            lines += ["", "Returns:", "    Description of return value."]

            if include_examples:
                lines += ["", "Example:", f"    >>> {function_name}(...)"]

            if include_complexity:
                lines += ["", "Complexity:", f"    Estimated complexity: O({complexity})"]

            lines.append('"""')
            return "\n".join(lines)

        if language in {"javascript", "typescript", "java", "cpp", "csharp"}:
            lines = ["/**", f" * {function_name} documentation."]
            for param in params:
                if style == "sphinx":
                    lines.append(f" * :param {param}: Description for {param}.")
                else:
                    lines.append(f" * @param {param} Description for {param}.")
            lines.append(" * @returns Return value description.")

            if include_examples:
                lines.append(" * @example example usage")

            if include_complexity:
                lines.append(f" * @complexity O({complexity})")

            lines.append(" */")
            return "\n".join(lines)

        return f"Auto-generated documentation for {function_name}."

    @staticmethod
    def _format_documentation(code: str, documentation: str, language: str) -> str:
        lines = code.split("\n")

        if language == "python":
            if "def " in code:
                for index, line in enumerate(lines):
                    if "def " in line:
                        indent = len(line) - len(line.lstrip())
                        block = documentation.strip().split("\n")
                        if not block[0].startswith('"""'):
                            block = ['"""'] + block + ['"""']
                        doc_lines = [" " * (indent + 4) + part for part in block]
                        lines.insert(index + 1, "\n".join(doc_lines))
                        break
            return "\n".join(lines)

        if language in {"javascript", "typescript", "java", "cpp", "csharp"}:
            if documentation.strip().startswith("/**"):
                return f"{documentation}\n{code}"
            return f"/**\n * {documentation}\n */\n{code}"

        return f"// {documentation}\n{code}"

    def generate(
        self,
        code: str,
        language: str,
        options: Dict[str, Any],
    ) -> Tuple[str, Dict[str, Any]]:
        style = options["style"]
        include_examples = options["includeExamples"]
        include_complexity = options["includeComplexity"]
        complexity = _estimate_complexity(code)

        fallback_used = True
        raw_docstring = ""

        if self.provider in {"auto", "groq"} and self.groq_ready:
            groq_document = self._generate_with_groq(
                code=code,
                language=language,
                style=style,
                include_examples=include_examples,
                include_complexity=include_complexity,
                complexity=complexity,
            )
            if groq_document:
                metadata = {
                    "model": self.model_display_name,
                    "modelReady": True,
                    "fallbackUsed": False,
                    "confidence": 0.97,
                    "complexity": complexity,
                    "style": style,
                    "includeExamples": include_examples,
                    "includeComplexity": include_complexity,
                    "provider": "groq",
                }
                return groq_document, metadata

        if self.model_ready and self.tokenizer is not None and self.model is not None and torch is not None:
            try:
                prompt = f"summarize: {code}"
                inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
                with torch.no_grad():
                    outputs = self.model.generate(
                        **inputs,
                        max_length=196,
                        num_beams=4,
                        early_stopping=True,
                        do_sample=False,
                    )
                candidate = self.tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
                if candidate and not self._looks_like_code(candidate):
                    raw_docstring = candidate
                    fallback_used = False
            except Exception as exc:
                _log_event(
                    self.logger,
                    logging.WARNING,
                    "model_generation_failed",
                    error=str(exc),
                )

        if not raw_docstring:
            raw_docstring = self._fallback_docstring(
                code,
                language,
                style,
                include_examples,
                include_complexity,
                complexity,
            )

        documentation = self._format_documentation(code, raw_docstring, language)
        confidence = 0.93 if not fallback_used else 0.78

        metadata = {
            "model": self.model_display_name,
            "modelReady": self.model_ready,
            "fallbackUsed": fallback_used,
            "confidence": round(confidence, 2),
            "complexity": complexity,
            "style": style,
            "includeExamples": include_examples,
            "includeComplexity": include_complexity,
            "provider": "local",
        }
        return documentation, metadata


class JobManager:
    def __init__(
        self,
        process_callback,
        persistence: PersistenceStore,
        logger: logging.Logger,
        max_queue_size: int,
    ) -> None:
        self.process_callback = process_callback
        self.persistence = persistence
        self.logger = logger
        self.max_queue_size = max(10, max_queue_size)

        self.queue: "queue.Queue[str]" = queue.Queue(maxsize=self.max_queue_size)
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()
        self.stop_event = threading.Event()

        self.worker = threading.Thread(
            target=self._worker_loop,
            name="docassist-generation-worker",
            daemon=True,
        )
        self.worker.start()

    def create_job(self, payload: Dict[str, Any], trace_id: str) -> Dict[str, Any]:
        job_id = f"job-{uuid.uuid4().hex}"
        now = _iso_now()
        job = {
            "id": job_id,
            "userId": payload.get("requestUserId"),
            "status": "queued",
            "traceId": trace_id,
            "createdAt": now,
            "updatedAt": now,
            "request": payload,
            "result": None,
            "error": None,
        }

        with self.lock:
            self.jobs[job_id] = job

        self.persistence.upsert_job(job)

        try:
            self.queue.put_nowait(job_id)
        except queue.Full:
            job["status"] = "failed"
            job["error"] = "Job queue is full. Try again later."
            job["updatedAt"] = _iso_now()
            self.persistence.upsert_job(job)

        return job

    def get_job(self, job_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self.lock:
            job = self.jobs.get(job_id)
            if job and (job.get("userId") == user_id):
                return dict(job)

        db_job = self.persistence.get_job(job_id, user_id=user_id)
        if not db_job:
            return None

        return {
            "id": db_job["id"],
            "status": db_job["status"],
            "traceId": db_job.get("trace_id"),
            "createdAt": db_job["created_at"],
            "updatedAt": db_job["updated_at"],
            "request": db_job.get("request"),
            "result": db_job.get("result"),
            "error": db_job.get("error"),
        }

    def stats(self) -> Dict[str, Any]:
        with self.lock:
            statuses = defaultdict(int)
            for job in self.jobs.values():
                statuses[job["status"]] += 1
            return {
                "queued": statuses.get("queued", 0),
                "running": statuses.get("running", 0),
                "completed": statuses.get("completed", 0),
                "failed": statuses.get("failed", 0),
                "queueSize": self.queue.qsize(),
                "queueMaxSize": self.max_queue_size,
            }

    def _worker_loop(self) -> None:
        while not self.stop_event.is_set():
            try:
                job_id = self.queue.get(timeout=0.5)
            except queue.Empty:
                continue

            self._process_job(job_id)
            self.queue.task_done()

    def _process_job(self, job_id: str) -> None:
        with self.lock:
            job = self.jobs.get(job_id)
            if not job:
                return
            job["status"] = "running"
            job["updatedAt"] = _iso_now()
            self.persistence.upsert_job(job)

        try:
            status_code, payload = self.process_callback(job["request"], job.get("traceId") or "")
            with self.lock:
                next_job = self.jobs.get(job_id)
                if not next_job:
                    return
                if status_code == 200 and payload.get("success"):
                    next_job["status"] = "completed"
                    next_job["result"] = payload.get("data")
                    next_job["error"] = None
                else:
                    next_job["status"] = "failed"
                    next_job["error"] = payload.get("error", "Background generation failed")
                next_job["updatedAt"] = _iso_now()
                self.persistence.upsert_job(next_job)
        except Exception as exc:
            _log_event(
                self.logger,
                logging.ERROR,
                "job_failed",
                jobId=job_id,
                error=str(exc),
            )
            with self.lock:
                next_job = self.jobs.get(job_id)
                if next_job:
                    next_job["status"] = "failed"
                    next_job["error"] = str(exc)
                    next_job["updatedAt"] = _iso_now()
                    self.persistence.upsert_job(next_job)

    def stop(self) -> None:
        self.stop_event.set()
        if self.worker.is_alive():
            self.worker.join(timeout=2)


def _normalize_generation_request(
    data: Dict[str, Any],
) -> Tuple[bool, Dict[str, Any], Optional[str]]:
    if not isinstance(data, dict):
        return False, {}, "Invalid JSON payload"

    code = data.get("code", "")
    language = str(data.get("language", "python")).strip().lower()
    options = data.get("options", {})
    project_id = data.get("projectId")

    if not isinstance(code, str) or not code.strip():
        return False, {}, "No code provided"

    if len(code) > 50000:
        return False, {}, "Code exceeds maximum length of 50000 characters"

    if language not in SUPPORTED_LANGUAGES:
        return False, {}, f"Unsupported language: {language}"

    if options is None:
        options = {}
    if not isinstance(options, dict):
        return False, {}, "options must be an object"

    style = str(options.get("style", "google")).strip().lower()
    if style not in SUPPORTED_DOC_STYLES:
        return False, {}, f"Unsupported style: {style}"

    include_examples = _value_bool(options.get("includeExamples", True), True)
    include_complexity = _value_bool(options.get("includeComplexity", True), True)

    normalized = {
        "code": code,
        "language": language,
        "projectId": str(project_id).strip()[:120] if project_id else None,
        "options": {
            "style": style,
            "includeExamples": include_examples,
            "includeComplexity": include_complexity,
        },
    }
    return True, normalized, None


def _validate_generate_response_schema(payload: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    if not isinstance(payload, dict):
        return False, "Response payload is not an object"

    if payload.get("success") is not True:
        return False, "Response success field is missing or false"

    data = payload.get("data")
    if not isinstance(data, dict):
        return False, "Response data field is missing"

    documentation = data.get("documentation")
    if not isinstance(documentation, str) or not documentation.strip():
        return False, "documentation must be a non-empty string"

    metadata = data.get("metadata")
    if not isinstance(metadata, dict):
        return False, "metadata must be an object"

    required_metadata_fields = [
        "model",
        "language",
        "style",
        "includeExamples",
        "includeComplexity",
        "processingTimeMs",
        "qualityScore",
        "fromCache",
    ]
    for field in required_metadata_fields:
        if field not in metadata:
            return False, f"metadata missing required field: {field}"

    return True, None


def create_app(config_overrides: Optional[Dict[str, Any]] = None) -> Flask:
    config = ServerConfig()
    if config_overrides:
        config.apply_overrides(config_overrides)

    logger = _build_logger()
    metrics = MetricsStore(config.ALERT_ERROR_RATE_THRESHOLD)
    response_cache = ResponseCache(config.CACHE_TTL_SECONDS, config.CACHE_MAX_ENTRIES)
    rate_limiter = RateLimiter(config.RATE_LIMIT_PER_MINUTE)
    persistence = PersistenceStore(config.DB_PATH)
    auth_manager = AuthManager(config, persistence)
    quality_evaluator = QualityEvaluator(
        baseline=config.QUALITY_BASELINE_SCORE,
        regression_delta=config.QUALITY_REGRESSION_DELTA,
    )
    model_service = ModelService(config, logger)

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH
    app.config["JSON_SORT_KEYS"] = False

    CORS(
        app,
        resources={r"/api/*": {"origins": config.CORS_ALLOWED_ORIGINS}},
        supports_credentials=False,
    )

    app.extensions["docassist_config"] = config
    app.extensions["docassist_logger"] = logger
    app.extensions["docassist_metrics"] = metrics
    app.extensions["docassist_cache"] = response_cache
    app.extensions["docassist_rate_limiter"] = rate_limiter
    app.extensions["docassist_auth"] = auth_manager
    app.extensions["docassist_persistence"] = persistence
    app.extensions["docassist_quality"] = quality_evaluator
    app.extensions["docassist_model"] = model_service
    app.extensions["docassist_started_at"] = time.time()

    def error_response(message: str, status: int, details: Optional[Any] = None):
        payload: Dict[str, Any] = {
            "success": False,
            "error": message,
            "status": status,
            "traceId": getattr(g, "trace_id", None),
        }
        if details is not None:
            payload["details"] = details
        return jsonify(payload), status

    @app.before_request
    def before_request_handler():
        g.started_at = time.perf_counter()
        requested_trace = request.headers.get("X-Trace-Id", "").strip()
        g.trace_id = requested_trace or str(uuid.uuid4())

        # Short-circuit API preflight requests so browsers never see internal errors.
        if request.method == "OPTIONS" and request.path.startswith("/api/"):
            return app.make_default_options_response()

        return None

    @app.after_request
    def after_request_handler(response):
        response.headers["X-Trace-Id"] = getattr(g, "trace_id", "")
        started_at = getattr(g, "started_at", None)
        if started_at is not None:
            latency_ms = (time.perf_counter() - started_at) * 1000
            metrics.record_request(request.path, response.status_code, latency_ms)
            _log_event(
                logger,
                logging.INFO,
                "http_request",
                traceId=getattr(g, "trace_id", None),
                method=request.method,
                path=request.path,
                status=response.status_code,
                latencyMs=round(latency_ms, 2),
                remoteAddr=request.remote_addr,
            )
        return response

    @app.errorhandler(413)
    def handle_large_payload(_error):
        return error_response(
            "Request payload too large",
            413,
            details=f"Maximum allowed bytes: {config.MAX_CONTENT_LENGTH}",
        )

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc):
        if isinstance(exc, HTTPException):
            status_code = int(exc.code or 500)
            message = str(exc.description or exc.name or "Request failed")
            return error_response(message, status_code)

        _log_event(
            logger,
            logging.ERROR,
            "unhandled_exception",
            traceId=getattr(g, "trace_id", None),
            error=str(exc),
            errorType=type(exc).__name__,
            traceback=traceback.format_exc(),
        )
        details = str(exc) if config.DEBUG else "Internal server error"
        return error_response("Internal server error", 500, details=details)

    def require_access(required_scopes: Optional[Set[str]] = None):
        required_scopes = required_scopes or set()

        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                ok, auth_context = auth_manager.authenticate(request)
                if not ok:
                    metrics.increment("auth_failures")
                    return error_response("Unauthorized", 401, details=auth_context.get("error"))

                g.auth_context = auth_context

                allowed, retry_after = rate_limiter.allow(auth_context["identity"])
                if not allowed:
                    metrics.increment("rate_limited")
                    return error_response(
                        "Rate limit exceeded",
                        429,
                        details={"retryAfterSeconds": int(retry_after) + 1},
                    )

                if not auth_manager.authorize(auth_context, set(required_scopes)):
                    return error_response(
                        "Forbidden",
                        403,
                        details={"requiredScopes": sorted(required_scopes)},
                    )

                return func(*args, **kwargs)

            return wrapper

        return decorator

    def build_cache_key(payload: Dict[str, Any]) -> str:
        key_source = {
            "modelSignature": model_service.model_signature,
            "language": payload["language"],
            "options": payload["options"],
            "codeHash": _hash_text(payload["code"]),
        }
        return _hash_text(json.dumps(key_source, sort_keys=True))

    def process_generation_payload(
        payload: Dict[str, Any],
        trace_id: str,
    ) -> Tuple[int, Dict[str, Any]]:
        code = payload["code"]
        language = payload["language"]
        options = payload["options"]
        project_id = payload.get("projectId")
        request_user_id = payload.get("requestUserId")

        started = time.perf_counter()
        cache_key = build_cache_key(payload)

        cached = response_cache.get(cache_key)
        if cached is not None:
            metrics.increment("cache_hits")
            processing_ms = int((time.perf_counter() - started) * 1000)

            result_data = {
                "documentation": cached["documentation"],
                "metadata": {
                    **cached["metadata"],
                    "processingTimeMs": processing_ms,
                    "fromCache": True,
                },
            }

            persistence.record_generation(
                {
                    "id": f"gen-{uuid.uuid4().hex}",
                    "traceId": trace_id,
                    "userId": request_user_id,
                    "createdAt": _iso_now(),
                    "language": language,
                    "style": options["style"],
                    "includeExamples": options["includeExamples"],
                    "includeComplexity": options["includeComplexity"],
                    "projectId": project_id,
                    "codeHash": _hash_text(code),
                    "sourceCode": code,
                    "documentation": cached["documentation"],
                    "model": cached["metadata"].get("model", "unknown"),
                    "confidence": cached["metadata"].get("confidence", 0.0),
                    "complexity": cached["metadata"].get("complexity"),
                    "qualityScore": cached["metadata"].get("qualityScore", 0.0),
                    "fromCache": True,
                    "processingMs": processing_ms,
                    "status": "success",
                }
            )

            payload_response = {
                "success": True,
                "data": result_data,
            }
            return 200, payload_response

        metrics.increment("cache_misses")

        try:
            documentation, generation_meta = model_service.generate(code, language, options)
            complexity = generation_meta["complexity"]
            quality_report = quality_evaluator.evaluate(
                code=code,
                documentation=documentation,
                language=language,
                options=options,
                complexity=complexity,
            )
            quality_evaluator.record(
                quality_report["score"],
                used_fallback=generation_meta["fallbackUsed"],
            )

            processing_ms = int((time.perf_counter() - started) * 1000)

            metadata = {
                "model": generation_meta["model"],
                "language": language,
                "style": options["style"],
                "includeExamples": options["includeExamples"],
                "includeComplexity": options["includeComplexity"],
                "processingTimeMs": processing_ms,
                "confidence": generation_meta["confidence"],
                "complexity": complexity,
                "qualityScore": quality_report["score"],
                "qualityChecks": quality_report["checks"],
                "fallbackUsed": generation_meta["fallbackUsed"],
                "fromCache": False,
            }

            result_data = {
                "documentation": documentation,
                "metadata": metadata,
            }

            payload_response = {
                "success": True,
                "data": result_data,
            }

            schema_valid, schema_error = _validate_generate_response_schema(payload_response)
            if not schema_valid:
                _log_event(
                    logger,
                    logging.ERROR,
                    "response_schema_violation",
                    traceId=trace_id,
                    error=schema_error,
                )
                return 500, {
                    "success": False,
                    "error": "Response schema validation failed",
                    "details": schema_error,
                }

            response_cache.set(
                cache_key,
                {
                    "documentation": documentation,
                    "metadata": metadata,
                },
            )

            persistence.record_generation(
                {
                    "id": f"gen-{uuid.uuid4().hex}",
                    "traceId": trace_id,
                    "userId": request_user_id,
                    "createdAt": _iso_now(),
                    "language": language,
                    "style": options["style"],
                    "includeExamples": options["includeExamples"],
                    "includeComplexity": options["includeComplexity"],
                    "projectId": project_id,
                    "codeHash": _hash_text(code),
                    "sourceCode": code,
                    "documentation": documentation,
                    "model": generation_meta["model"],
                    "confidence": generation_meta["confidence"],
                    "complexity": complexity,
                    "qualityScore": quality_report["score"],
                    "fromCache": False,
                    "processingMs": processing_ms,
                    "status": "success",
                }
            )

            metrics.increment("generated_count")
            return 200, payload_response
        except Exception as exc:
            _log_event(
                logger,
                logging.ERROR,
                "generation_failed",
                traceId=trace_id,
                error=str(exc),
            )
            return 500, {
                "success": False,
                "error": "Documentation generation failed",
                "details": str(exc),
            }

    job_manager = JobManager(
        process_callback=process_generation_payload,
        persistence=persistence,
        logger=logger,
        max_queue_size=config.JOB_QUEUE_MAX_SIZE,
    )
    app.extensions["docassist_jobs"] = job_manager

    def graceful_shutdown(*_args) -> None:
        job_manager.stop()

    atexit.register(graceful_shutdown)

    if threading.current_thread() is threading.main_thread():
        try:
            signal.signal(signal.SIGINT, graceful_shutdown)
            signal.signal(signal.SIGTERM, graceful_shutdown)
        except Exception:
            pass

    def serialize_generation_record(raw: Dict[str, Any]) -> Dict[str, Any]:
        source_code = raw.get("source_code") or raw.get("sourceCode")
        documentation = raw.get("documentation")
        return {
            "id": raw.get("id"),
            "traceId": raw.get("trace_id") or raw.get("traceId"),
            "userId": raw.get("user_id") or raw.get("userId"),
            "createdAt": raw.get("created_at") or raw.get("createdAt"),
            "language": raw.get("language"),
            "style": raw.get("style"),
            "includeExamples": bool(raw.get("include_examples", raw.get("includeExamples", False))),
            "includeComplexity": bool(raw.get("include_complexity", raw.get("includeComplexity", False))),
            "projectId": raw.get("project_id") or raw.get("projectId"),
            "model": raw.get("model"),
            "confidence": raw.get("confidence"),
            "complexity": raw.get("complexity"),
            "qualityScore": raw.get("quality_score", raw.get("qualityScore")),
            "fromCache": bool(raw.get("from_cache", raw.get("fromCache", False))),
            "processingMs": raw.get("processing_ms", raw.get("processingMs", 0)),
            "inputSnippet": raw.get("inputSnippet") or (str(source_code or "")[:300] or None),
            "outputSnippet": raw.get("outputSnippet") or (str(documentation or "")[:300] or None),
            "sourceCode": source_code,
            "documentation": documentation,
        }

    def get_request_user_id() -> Optional[str]:
        auth_context = getattr(g, "auth_context", {})
        return auth_context.get("userId")

    @app.route("/api/auth/register", methods=["POST"])
    def auth_register():
        if not config.AUTH_ALLOW_SIGNUP:
            return error_response("Signup is disabled", 403)

        payload = request.get_json(silent=True) or {}
        name = str(payload.get("name", "")).strip()[:120]
        email = _normalize_email(payload.get("email", ""))
        password = str(payload.get("password", ""))

        if not name:
            return error_response("Name is required", 400)
        if not email or not EMAIL_PATTERN.match(email):
            return error_response("A valid email is required", 400)

        is_valid_password, password_error = _validate_password(password)
        if not is_valid_password:
            return error_response(password_error, 400)

        # First account becomes admin, later accounts default to manager.
        role = "admin" if persistence.count_users() == 0 else "manager"

        created = persistence.create_user(
            name=name,
            email=email,
            password_hash=_hash_password(password),
            role=role,
        )
        if created is None:
            return error_response("Email is already registered", 409)

        scopes = _derive_scopes_for_role(created.get("role"))
        session = persistence.create_user_session(
            user_id=created["id"],
            scopes=scopes,
            ttl_hours=config.AUTH_SESSION_TTL_HOURS,
            source="register",
        )
        persistence.touch_user_login(created["id"])

        return (
            jsonify(
                {
                    "success": True,
                    "data": {
                        "token": session["token"],
                        "expiresAt": session["expiresAt"],
                        "user": {
                            "id": created["id"],
                            "name": created["name"],
                            "email": created["email"],
                            "role": created["role"],
                        },
                        "scopes": sorted(scopes),
                    },
                }
            ),
            201,
        )

    @app.route("/api/auth/login", methods=["POST"])
    def auth_login():
        payload = request.get_json(silent=True) or {}
        email = _normalize_email(payload.get("email", ""))
        password = str(payload.get("password", ""))

        if not email or not password:
            return error_response("Email and password are required", 400)

        user = persistence.get_user_by_email(email)
        if not user or int(user.get("is_active", 0)) != 1:
            return error_response("Invalid email or password", 401)

        if not _verify_password(password, str(user.get("password_hash", ""))):
            return error_response("Invalid email or password", 401)

        scopes = _derive_scopes_for_role(user.get("role"))
        session = persistence.create_user_session(
            user_id=user["id"],
            scopes=scopes,
            ttl_hours=config.AUTH_SESSION_TTL_HOURS,
            source="password",
        )
        persistence.touch_user_login(user["id"])

        return jsonify(
            {
                "success": True,
                "data": {
                    "token": session["token"],
                    "expiresAt": session["expiresAt"],
                    "user": {
                        "id": user["id"],
                        "name": user["name"],
                        "email": user["email"],
                        "role": user["role"],
                    },
                    "scopes": sorted(scopes),
                },
            }
        )

    @app.route("/api/auth/logout", methods=["POST"])
    @require_access(set())
    def auth_logout():
        auth_header = request.headers.get("Authorization", "")
        token = ""
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()

        if not token:
            return error_response("Missing API token. Use Authorization: Bearer <token>.", 400)

        revoked = persistence.revoke_session_by_token(token)
        if not revoked:
            return jsonify({"success": True, "data": {"loggedOut": True}})

        return jsonify({"success": True, "data": {"loggedOut": True}})

    @app.route("/api/auth/me", methods=["GET"])
    @require_access(set())
    def auth_me():
        auth_context = getattr(g, "auth_context", {})
        scopes = sorted(set(auth_context.get("scopes", set())))
        user = auth_context.get("user")
        authenticated = bool(user)
        permissions = {
            "canRead": "read" in scopes or "admin" in scopes,
            "canGenerate": "generate" in scopes or "admin" in scopes,
            "canManage": "manage" in scopes or "admin" in scopes,
            "isAdmin": "admin" in scopes,
        }

        if not authenticated and auth_context.get("tokenSource") == "anonymous":
            scopes = []
            permissions = {
                "canRead": False,
                "canGenerate": False,
                "canManage": False,
                "isAdmin": False,
            }

        progress = persistence.get_user_progress_summary(get_request_user_id())

        return jsonify(
            {
                "success": True,
                "data": {
                    "authenticated": authenticated,
                    "identity": auth_context.get("identity"),
                    "userId": auth_context.get("userId"),
                    "user": user,
                    "apiKeyRequired": bool(auth_context.get("apiKeyRequired")),
                    "tokenSource": auth_context.get("tokenSource"),
                    "apiKey": auth_context.get("apiKey"),
                    "session": auth_context.get("session"),
                    "scopes": scopes,
                    "permissions": permissions,
                    "progress": progress,
                },
            }
        )

    @app.route("/api/access/keys", methods=["GET"])
    @require_access({"manage"})
    def access_keys_list():
        include_inactive = _value_bool(request.args.get("includeInactive", False), False)
        auth_context = getattr(g, "auth_context", {})
        include_all = _value_bool(request.args.get("includeAll", False), False)
        keys = persistence.list_api_keys(
            include_inactive=include_inactive,
            user_id=auth_context.get("userId"),
            include_all=include_all and ("admin" in set(auth_context.get("scopes", set()))),
        )
        return jsonify({"success": True, "data": keys})

    @app.route("/api/access/keys", methods=["POST"])
    @require_access({"manage"})
    def access_keys_create():
        payload = request.get_json(silent=True) or {}
        label = str(payload.get("label", "")).strip()
        scopes = _normalize_scopes(payload.get("scopes"))
        auth_context = getattr(g, "auth_context", {})

        if "admin" in scopes and "admin" not in set(auth_context.get("scopes", set())):
            return error_response("Only admin keys can create admin-scoped keys", 403)

        created = persistence.create_api_key(
            label=label,
            scopes=scopes,
            user_id=auth_context.get("userId"),
        )
        return jsonify({"success": True, "data": created}), 201

    @app.route("/api/access/keys/<key_id>", methods=["DELETE"])
    @require_access({"manage"})
    def access_keys_revoke(key_id: str):
        auth_context = getattr(g, "auth_context", {})
        active_key = auth_context.get("apiKey") or {}

        if key_id == active_key.get("id"):
            return error_response("Cannot revoke the currently active key", 400)

        revoked = persistence.revoke_api_key(key_id, user_id=auth_context.get("userId"))
        if not revoked:
            return error_response("API key not found or cannot be revoked", 404)

        return jsonify({"success": True, "data": {"revoked": True, "id": key_id}})

    @app.route("/api/generate-documentation", methods=["POST"])
    @require_access({"generate"})
    def generate_documentation():
        payload = request.get_json(silent=True) or {}
        is_valid, normalized, error = _normalize_generation_request(payload)
        if not is_valid:
            return error_response(error or "Invalid request", 400)

        normalized["requestUserId"] = get_request_user_id()

        status_code, response_payload = process_generation_payload(normalized, g.trace_id)
        return jsonify(response_payload), status_code

    @app.route("/api/generate-documentation-async", methods=["POST"])
    @require_access({"generate"})
    def generate_documentation_async():
        payload = request.get_json(silent=True) or {}
        is_valid, normalized, error = _normalize_generation_request(payload)
        if not is_valid:
            return error_response(error or "Invalid request", 400)

        normalized["requestUserId"] = get_request_user_id()

        job = job_manager.create_job(normalized, g.trace_id)
        if job["status"] == "failed":
            return error_response("Unable to queue generation job", 503, details=job.get("error"))

        return (
            jsonify(
                {
                    "success": True,
                    "data": {
                        "jobId": job["id"],
                        "status": job["status"],
                        "statusUrl": f"/api/jobs/{job['id']}",
                        "createdAt": job["createdAt"],
                    },
                }
            ),
            202,
        )

    @app.route("/api/jobs/<job_id>", methods=["GET"])
    @require_access({"read"})
    def job_status(job_id: str):
        job = job_manager.get_job(job_id, user_id=get_request_user_id())
        if not job:
            return error_response("Job not found", 404)

        return jsonify(
            {
                "success": True,
                "data": {
                    "id": job["id"],
                    "status": job["status"],
                    "createdAt": job["createdAt"],
                    "updatedAt": job["updatedAt"],
                    "result": job.get("result"),
                    "error": job.get("error"),
                },
            }
        )

    @app.route("/api/analyze-code", methods=["POST"])
    @require_access({"generate"})
    def analyze_code():
        data = request.get_json(silent=True) or {}
        code = data.get("code", "")
        language = str(data.get("language", "python")).strip().lower()

        if not isinstance(code, str) or not code.strip():
            return error_response("No code provided", 400)

        if language not in SUPPORTED_LANGUAGES:
            return error_response("Unsupported language", 400, details={"language": language})

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
    @require_access({"generate"})
    def validate_syntax():
        data = request.get_json(silent=True) or {}
        code = data.get("code", "")
        language = str(data.get("language", "python")).strip().lower()

        if not isinstance(code, str) or not code.strip():
            return error_response("No code provided", 400)

        if language not in SUPPORTED_LANGUAGES:
            return error_response("Unsupported language", 400, details={"language": language})

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

    @app.route("/api/history", methods=["GET"])
    @require_access({"read"})
    def generation_history():
        limit = _clamp(int(request.args.get("limit", 50)), 1, 200)
        language = request.args.get("language")
        project_id = request.args.get("projectId")

        if language and language not in SUPPORTED_LANGUAGES:
            return error_response("Unsupported language", 400, details={"language": language})

        records = persistence.list_generations(
            limit,
            language=language,
            project_id=project_id,
            user_id=get_request_user_id(),
        )
        serialized = [serialize_generation_record(record) for record in records]
        return jsonify({"success": True, "data": serialized})

    @app.route("/api/history/<generation_id>", methods=["GET"])
    @require_access({"read"})
    def generation_history_detail(generation_id: str):
        record = persistence.get_generation(generation_id, user_id=get_request_user_id())
        if not record:
            return error_response("History record not found", 404)

        return jsonify({"success": True, "data": serialize_generation_record(record)})

    @app.route("/api/history", methods=["POST"])
    @require_access({"generate"})
    def create_history_record():
        payload = request.get_json(silent=True) or {}
        language = str(payload.get("language", "python")).strip().lower()
        if language not in SUPPORTED_LANGUAGES:
            return error_response("Unsupported language", 400, details={"language": language})

        model_name = str(payload.get("model", "Manual Snapshot")).strip()[:180] or "Manual Snapshot"
        style = str(payload.get("style", "google")).strip().lower()
        if style not in SUPPORTED_DOC_STYLES:
            style = "google"

        source_code = str(payload.get("sourceCode") or payload.get("inputCode") or "")
        input_snippet = str(payload.get("inputSnippet") or source_code[:300] or "").strip()[:300]
        documentation = str(payload.get("documentation") or "Manual snapshot entry")
        output_snippet = str(payload.get("outputSnippet") or documentation[:300] or "").strip()[:300]

        generated_id = f"gen-{uuid.uuid4().hex}"
        created_at = _iso_now()
        complexity = payload.get("complexity")
        try:
            complexity_value = int(complexity) if complexity is not None else _estimate_complexity(input_snippet)
        except Exception:
            complexity_value = _estimate_complexity(input_snippet)

        record_payload = {
            "id": generated_id,
            "traceId": g.trace_id,
            "userId": get_request_user_id(),
            "createdAt": created_at,
            "language": language,
            "style": style,
            "includeExamples": _value_bool(payload.get("includeExamples", False), False),
            "includeComplexity": _value_bool(payload.get("includeComplexity", False), False),
            "projectId": payload.get("projectId"),
            "codeHash": _hash_text(f"{source_code}:{documentation}:{generated_id}"),
            "sourceCode": source_code,
            "documentation": documentation,
            "model": model_name,
            "confidence": payload.get("confidence"),
            "complexity": complexity_value,
            "qualityScore": payload.get("qualityScore"),
            "fromCache": _value_bool(payload.get("fromCache", False), False),
            "processingMs": int(payload.get("processingMs", 0) or 0),
            "status": "snapshot",
        }

        persistence.record_generation(record_payload)

        return (
            jsonify(
                {
                    "success": True,
                    "data": serialize_generation_record(
                        {
                            "id": generated_id,
                            "trace_id": g.trace_id,
                            "user_id": get_request_user_id(),
                            "created_at": created_at,
                            "language": language,
                            "style": style,
                            "include_examples": record_payload["includeExamples"],
                            "include_complexity": record_payload["includeComplexity"],
                            "project_id": payload.get("projectId"),
                            "model": model_name,
                            "confidence": payload.get("confidence"),
                            "complexity": complexity_value,
                            "quality_score": payload.get("qualityScore"),
                            "from_cache": record_payload["fromCache"],
                            "processing_ms": record_payload["processingMs"],
                            "inputSnippet": input_snippet,
                            "outputSnippet": output_snippet,
                            "sourceCode": source_code,
                            "documentation": documentation,
                        }
                    ),
                }
            ),
            201,
        )

    @app.route("/api/history", methods=["DELETE"])
    @require_access({"manage"})
    def clear_history():
        project_id = request.args.get("projectId")
        cleared = persistence.clear_generations(project_id=project_id, user_id=get_request_user_id())
        return jsonify(
            {
                "success": True,
                "data": {
                    "cleared": cleared,
                    "projectId": project_id,
                },
            }
        )

    @app.route("/api/projects", methods=["GET"])
    @require_access({"read"})
    def list_projects():
        projects = persistence.list_projects(user_id=get_request_user_id())
        return jsonify({"success": True, "data": projects})

    @app.route("/api/projects/<project_id>/snapshot", methods=["GET"])
    @require_access({"read"})
    def project_snapshot(project_id: str):
        request_user_id = get_request_user_id()
        project = persistence.get_project(project_id, user_id=request_user_id)
        if not project:
            return error_response("Project not found", 404)

        try:
            requested_limit = int(request.args.get("limit", 1000))
        except Exception:
            requested_limit = 1000
        limit = _clamp(requested_limit, 1, 5000)

        records = persistence.list_project_generations(
            project_id,
            user_id=request_user_id,
            limit=limit,
        )
        snapshot_markdown = _build_project_snapshot_markdown(project, records)
        project_name_fragment: str = str(project.get("name") or "project")
        file_name = f"{_safe_filename_fragment(project_name_fragment)}-snapshot.md"

        if _value_bool(request.args.get("download", False), False):
            response = make_response(snapshot_markdown, 200)
            response.headers["Content-Type"] = "text/markdown; charset=utf-8"
            response.headers["Content-Disposition"] = f'attachment; filename="{file_name}"'
            return response

        return jsonify(
            {
                "success": True,
                "data": {
                    "project": project,
                    "recordCount": len(records),
                    "fileName": file_name,
                    "generatedAt": _iso_now(),
                    "snapshotMarkdown": snapshot_markdown,
                },
            }
        )

    @app.route("/api/projects", methods=["POST"])
    @require_access({"manage"})
    def upsert_project():
        payload = request.get_json(silent=True) or {}
        name = str(payload.get("name", "")).strip()
        language = str(payload.get("language", "python")).strip().lower()
        if not name:
            return error_response("Project name is required", 400)
        if language not in SUPPORTED_LANGUAGES:
            return error_response("Unsupported project language", 400)

        project = persistence.upsert_project(payload, user_id=get_request_user_id())
        return jsonify({"success": True, "data": project})

    @app.route("/api/projects/<project_id>", methods=["DELETE"])
    @require_access({"manage"})
    def delete_project(project_id: str):
        deleted = persistence.delete_project(project_id, user_id=get_request_user_id())
        if not deleted:
            return error_response("Project not found", 404)
        return jsonify({"success": True, "data": {"deleted": True, "projectId": project_id}})

    @app.route("/api/preferences", methods=["GET"])
    @require_access({"read"})
    def get_preferences():
        prefs = persistence.get_preferences(user_id=get_request_user_id())
        return jsonify({"success": True, "data": prefs})

    @app.route("/api/preferences", methods=["PUT"])
    @require_access({"manage"})
    def set_preferences():
        payload = request.get_json(silent=True) or {}
        settings = payload.get("settings")
        if not isinstance(settings, dict):
            return error_response("settings must be an object", 400)

        updated = persistence.set_preferences(settings, user_id=get_request_user_id())
        return jsonify({"success": True, "data": updated})

    @app.route("/api/evaluation/summary", methods=["GET"])
    @require_access({"read"})
    def evaluation_summary():
        summary = quality_evaluator.summary()
        return jsonify({"success": True, "data": summary})

    @app.route("/api/cache/stats", methods=["GET"])
    @require_access({"read"})
    def cache_stats():
        return jsonify({"success": True, "data": response_cache.stats()})

    @app.route("/api/cache/clear", methods=["POST"])
    @require_access({"admin"})
    def cache_clear():
        cleared = response_cache.clear()
        return jsonify(
            {
                "success": True,
                "data": {
                    "cleared": cleared,
                },
            }
        )

    @app.route("/api/metrics", methods=["GET"])
    @require_access({"read"})
    def metrics_endpoint():
        return jsonify({"success": True, "data": metrics.snapshot()})

    @app.route("/api/health", methods=["GET"])
    def health():
        uptime_seconds = int(time.time() - app.extensions["docassist_started_at"])
        status = "healthy" if model_service.model_ready else "degraded"

        return jsonify(
            {
                "success": True,
                "data": {
                    "status": status,
                    "version": APP_VERSION,
                    "uptime": uptime_seconds,
                    "model": model_service.model_display_name,
                    "modelLoaded": model_service.model_ready,
                    "finetunedPath": str(config.FINETUNED_PATH),
                    "loadError": model_service.model_load_error,
                    "preflight": model_service.preflight_checks,
                    "security": {
                        "apiKeyRequired": config.REQUIRE_API_KEY,
                        "corsAllowedOrigins": config.CORS_ALLOWED_ORIGINS,
                        "maxRequestBytes": config.MAX_CONTENT_LENGTH,
                        "rateLimitPerMinute": config.RATE_LIMIT_PER_MINUTE,
                        "managedApiKeyCount": len(persistence.list_api_keys(include_inactive=False)),
                    },
                    "cache": response_cache.stats(),
                    "jobs": job_manager.stats(),
                },
            }
        )

    return app


app = create_app()


if __name__ == "__main__":
    runtime_config: ServerConfig = app.extensions["docassist_config"]
    app.run(host=runtime_config.HOST, port=runtime_config.PORT, debug=runtime_config.DEBUG)
