import time
from pathlib import Path

from backend.server import create_app


def _make_app(tmp_path: Path, overrides=None):
    config = {
        "DISABLE_MODEL_LOAD": True,
        "REQUIRE_API_KEY": False,
        "API_TOKEN_SCOPES": {},
        "DB_PATH": tmp_path / "test_docassist.db",
        "RATE_LIMIT_PER_MINUTE": 1000,
        "CORS_ALLOWED_ORIGINS": ["http://localhost:3000"],
    }
    if overrides:
        config.update(overrides)

    app = create_app(config)
    app.config["TESTING"] = True
    return app


def test_health_endpoint_contains_hardening_data(tmp_path):
    app = _make_app(tmp_path)
    try:
        with app.test_client() as client:
            response = client.get("/api/health")
            assert response.status_code == 200
            payload = response.get_json()

            assert payload["success"] is True
            assert "preflight" in payload["data"]
            assert "security" in payload["data"]
            assert "jobs" in payload["data"]
    finally:
        app.extensions["docassist_jobs"].stop()


def test_generate_supports_options_and_server_cache(tmp_path):
    app = _make_app(tmp_path)
    code = "def add(a, b):\n    return a + b"
    payload = {
        "code": code,
        "language": "python",
        "options": {
            "style": "numpy",
            "includeExamples": True,
            "includeComplexity": True,
        },
    }

    try:
        with app.test_client() as client:
            first = client.post("/api/generate-documentation", json=payload)
            assert first.status_code == 200
            first_json = first.get_json()
            assert first_json["success"] is True
            assert first_json["data"]["metadata"]["style"] == "numpy"
            assert first_json["data"]["metadata"]["includeExamples"] is True
            assert first_json["data"]["metadata"]["includeComplexity"] is True
            assert first_json["data"]["metadata"]["fromCache"] is False

            second = client.post("/api/generate-documentation", json=payload)
            assert second.status_code == 200
            second_json = second.get_json()
            assert second_json["data"]["metadata"]["fromCache"] is True
    finally:
        app.extensions["docassist_jobs"].stop()


def test_async_generation_job_pipeline(tmp_path):
    app = _make_app(tmp_path)
    payload = {
        "code": "def fib(n):\n    if n <= 1:\n        return n\n    return fib(n-1) + fib(n-2)",
        "language": "python",
        "options": {
            "style": "google",
            "includeExamples": False,
            "includeComplexity": True,
        },
    }

    try:
        with app.test_client() as client:
            enqueue = client.post("/api/generate-documentation-async", json=payload)
            assert enqueue.status_code == 202
            job_id = enqueue.get_json()["data"]["jobId"]

            for _ in range(80):
                status = client.get(f"/api/jobs/{job_id}")
                assert status.status_code == 200
                data = status.get_json()["data"]
                if data["status"] in {"completed", "failed"}:
                    break
                time.sleep(0.05)

            final_status = client.get(f"/api/jobs/{job_id}")
            final_data = final_status.get_json()["data"]
            assert final_data["status"] == "completed"
            assert "documentation" in final_data["result"]
    finally:
        app.extensions["docassist_jobs"].stop()


def test_history_and_quality_summary_are_persisted(tmp_path):
    app = _make_app(tmp_path)
    payload = {
        "code": "def square(x):\n    return x * x",
        "language": "python",
        "options": {
            "style": "google",
            "includeExamples": True,
            "includeComplexity": True,
        },
    }

    try:
        with app.test_client() as client:
            generate = client.post("/api/generate-documentation", json=payload)
            assert generate.status_code == 200

            history = client.get("/api/history?limit=10")
            assert history.status_code == 200
            history_items = history.get_json()["data"]
            assert len(history_items) >= 1

            summary = client.get("/api/evaluation/summary")
            assert summary.status_code == 200
            summary_data = summary.get_json()["data"]
            assert summary_data["totalRuns"] >= 1
            assert "regressionDetected" in summary_data
    finally:
        app.extensions["docassist_jobs"].stop()


def test_history_detail_includes_source_and_documentation(tmp_path):
    app = _make_app(tmp_path)
    payload = {
        "code": "def square(x):\n    return x * x",
        "language": "python",
        "projectId": "project-alpha",
        "options": {
            "style": "google",
            "includeExamples": True,
            "includeComplexity": True,
        },
    }

    try:
        with app.test_client() as client:
            generate = client.post("/api/generate-documentation", json=payload)
            assert generate.status_code == 200

            history = client.get("/api/history?limit=1")
            assert history.status_code == 200
            history_items = history.get_json()["data"]
            assert len(history_items) == 1

            record_id = history_items[0]["id"]
            detail = client.get(f"/api/history/{record_id}")
            assert detail.status_code == 200

            detail_data = detail.get_json()["data"]
            assert detail_data["projectId"] == "project-alpha"
            assert "def square" in str(detail_data.get("sourceCode") or "")
            assert len(str(detail_data.get("documentation") or "")) > 0
    finally:
        app.extensions["docassist_jobs"].stop()


def test_project_snapshot_preview_and_download(tmp_path):
    app = _make_app(tmp_path)

    try:
        with app.test_client() as client:
            create_project = client.post(
                "/api/projects",
                json={"name": "Snapshot Project", "language": "python"},
            )
            assert create_project.status_code == 200
            project_id = create_project.get_json()["data"]["id"]

            first_generate = client.post(
                "/api/generate-documentation",
                json={
                    "code": "def alpha(x):\n    return x + 1",
                    "language": "python",
                    "projectId": project_id,
                    "options": {
                        "style": "google",
                        "includeExamples": True,
                        "includeComplexity": True,
                    },
                },
            )
            assert first_generate.status_code == 200

            second_generate = client.post(
                "/api/generate-documentation",
                json={
                    "code": "def beta(y):\n    return y * 2",
                    "language": "python",
                    "projectId": project_id,
                    "options": {
                        "style": "numpy",
                        "includeExamples": False,
                        "includeComplexity": True,
                    },
                },
            )
            assert second_generate.status_code == 200

            preview = client.get(f"/api/projects/{project_id}/snapshot")
            assert preview.status_code == 200
            preview_data = preview.get_json()["data"]
            assert preview_data["recordCount"] == 2
            assert "Project Documentation Snapshot" in preview_data["snapshotMarkdown"]
            assert "Snapshot Project" in preview_data["snapshotMarkdown"]
            assert "def alpha" in preview_data["snapshotMarkdown"]
            assert "def beta" in preview_data["snapshotMarkdown"]

            download = client.get(f"/api/projects/{project_id}/snapshot?download=true")
            assert download.status_code == 200
            assert "text/markdown" in str(download.content_type)
            disposition = download.headers.get("Content-Disposition", "")
            assert "attachment" in disposition
            assert "snapshot-project-snapshot.md" in disposition.lower()
            body = download.get_data(as_text=True)
            assert "Project Documentation Snapshot" in body
    finally:
        app.extensions["docassist_jobs"].stop()


def test_auth_and_rate_limit_controls(tmp_path):
    app = _make_app(
        tmp_path,
        {
            "REQUIRE_API_KEY": True,
            "API_TOKEN_SCOPES": {
                "test-token": {"read", "generate", "manage", "admin"},
            },
            "RATE_LIMIT_PER_MINUTE": 1,
        },
    )

    payload = {
        "code": "def hello(name):\n    return f'Hello {name}'",
        "language": "python",
        "options": {
            "style": "google",
            "includeExamples": False,
            "includeComplexity": False,
        },
    }

    try:
        with app.test_client() as client:
            unauthorized = client.post("/api/generate-documentation", json=payload)
            assert unauthorized.status_code == 401

            headers = {"Authorization": "Bearer test-token"}
            first = client.post("/api/generate-documentation", json=payload, headers=headers)
            assert first.status_code == 200

            second = client.post("/api/generate-documentation", json=payload, headers=headers)
            assert second.status_code == 429
    finally:
        app.extensions["docassist_jobs"].stop()


def test_auth_profile_and_managed_api_key_lifecycle(tmp_path):
    app = _make_app(tmp_path)

    try:
        with app.test_client() as client:
            register = client.post(
                "/api/auth/register",
                json={
                    "name": "Alice",
                    "email": "alice@example.com",
                    "password": "veryStrongPass123",
                },
            )
            assert register.status_code == 201
            register_data = register.get_json()["data"]
            session_token = register_data["token"]

            headers = {"Authorization": f"Bearer {session_token}"}

            profile = client.get("/api/auth/me", headers=headers)
            assert profile.status_code == 200
            profile_data = profile.get_json()["data"]
            assert profile_data["authenticated"] is True
            assert profile_data["permissions"]["canManage"] is True
            assert profile_data["user"]["email"] == "alice@example.com"

            create_key = client.post(
                "/api/access/keys",
                json={
                    "label": "Frontend Managed Key",
                    "scopes": ["read", "generate", "manage"],
                },
                headers=headers,
            )
            assert create_key.status_code == 201
            create_payload = create_key.get_json()["data"]

            key_id = create_payload["key"]["id"]
            token = create_payload["token"]
            assert token.startswith("dka_")

            key_headers = {"Authorization": f"Bearer {token}"}
            managed_profile = client.get("/api/auth/me", headers=key_headers)
            assert managed_profile.status_code == 200
            managed_payload = managed_profile.get_json()["data"]
            assert managed_payload["apiKey"]["id"] == key_id
            assert "manage" in managed_payload["scopes"]

            key_list = client.get("/api/access/keys", headers=key_headers)
            assert key_list.status_code == 200
            assert any(item["id"] == key_id for item in key_list.get_json()["data"])

            revoke = client.delete(f"/api/access/keys/{key_id}", headers=headers)
            assert revoke.status_code == 200

            invalid_after_revoke = client.get("/api/auth/me", headers=key_headers)
            assert invalid_after_revoke.status_code == 401
    finally:
        app.extensions["docassist_jobs"].stop()


def test_user_scoped_projects_are_isolated(tmp_path):
    app = _make_app(tmp_path)

    try:
        with app.test_client() as client:
            first_user = client.post(
                "/api/auth/register",
                json={
                    "name": "One",
                    "email": "one@example.com",
                    "password": "veryStrongPass123",
                },
            )
            assert first_user.status_code == 201
            first_token = first_user.get_json()["data"]["token"]

            second_user = client.post(
                "/api/auth/register",
                json={
                    "name": "Two",
                    "email": "two@example.com",
                    "password": "veryStrongPass123",
                },
            )
            assert second_user.status_code == 201
            second_token = second_user.get_json()["data"]["token"]

            first_headers = {"Authorization": f"Bearer {first_token}"}
            second_headers = {"Authorization": f"Bearer {second_token}"}

            create_project = client.post(
                "/api/projects",
                json={"name": "User One Project", "language": "python"},
                headers=first_headers,
            )
            assert create_project.status_code == 200

            first_projects = client.get("/api/projects", headers=first_headers)
            assert first_projects.status_code == 200
            assert any(item["name"] == "User One Project" for item in first_projects.get_json()["data"])

            second_projects = client.get("/api/projects", headers=second_headers)
            assert second_projects.status_code == 200
            assert all(item["name"] != "User One Project" for item in second_projects.get_json()["data"])
    finally:
        app.extensions["docassist_jobs"].stop()
