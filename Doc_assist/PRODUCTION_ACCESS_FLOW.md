# Production Access Flow

This document defines the recommended production workflow for API key management and scoped access in DOCAssist.

## 1) Scope Model

The backend enforces four scopes:

- `read`: view history, metrics, status, preferences, and profile
- `generate`: generate documentation and run analysis/validation
- `manage`: manage API keys, projects, preferences, and history deletion
- `admin`: full permissions including admin-only operations (for example cache clear)

## 2) Role Templates

Use these default role templates when creating keys:

- **Auditor**: `read`
- **Developer**: `read|generate`
- **Manager**: `read|generate|manage`
- **Admin**: `read|generate|manage|admin`

## 3) Bootstrap Admin Access

In production, bootstrap one admin token through environment variables.

Example (`PowerShell`):

```powershell
$env:DOCASSIST_ENV = "production"
$env:DOCASSIST_REQUIRE_API_KEY = "true"
$env:DOCASSIST_API_TOKENS = "prod-admin-token:read|generate|manage|admin"
python backend/server.py
```

Notes:

- Environment tokens are synced into the backend key store as `source = environment`.
- Environment keys cannot be revoked from API endpoints.

## 4) Verify Admin Token

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer prod-admin-token"
```

Expected result:

- `authenticated: true`
- `permissions.isAdmin: true`

## 5) Create Scoped Keys via API

### Create Developer Key

```bash
curl -X POST http://localhost:5000/api/access/keys \
  -H "Authorization: Bearer prod-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "dev-team-key",
    "scopes": ["read", "generate"]
  }'
```

Response contains:

- `data.key`: key metadata
- `data.token`: secret token string (shown once)

### Create Manager Key

```bash
curl -X POST http://localhost:5000/api/access/keys \
  -H "Authorization: Bearer prod-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "ops-manager-key",
    "scopes": ["read", "generate", "manage"]
  }'
```

### Create Auditor Key

```bash
curl -X POST http://localhost:5000/api/access/keys \
  -H "Authorization: Bearer prod-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "audit-key",
    "scopes": ["read"]
  }'
```

## 6) Use Keys for API Access

Pass the token in `Authorization` header:

```bash
Authorization: Bearer <token>
```

Examples:

- Developer key can call:
  - `POST /api/generate-documentation`
  - `POST /api/generate-documentation-async`
  - `POST /api/analyze-code`
- Auditor key can call:
  - `GET /api/history`
  - `GET /api/metrics`
  - `GET /api/health`
- Manager key can call:
  - `POST /api/access/keys`
  - `DELETE /api/access/keys/<key_id>`
  - `POST /api/projects`

## 7) Revoke Keys

```bash
curl -X DELETE http://localhost:5000/api/access/keys/<key_id> \
  -H "Authorization: Bearer prod-admin-token"
```

Revocation behavior:

- Database keys are deactivated (`is_active = 0`).
- Environment keys are not revocable through API.

## 8) Frontend Operations Flow

For UI users:

1. Open `/app/access`.
2. Set an existing key and validate against backend.
3. If key has `manage`, create scoped team keys.
4. Distribute created tokens through secure secret management channels.
5. Rotate keys periodically and revoke unused keys.

## 9) Recommended Rotation Policy

- Rotate manager/admin keys every 30 days.
- Rotate developer keys every 60-90 days.
- Revoke keys immediately on role change or incident.
- Keep only one bootstrap environment admin token.

## 10) Endpoint Permission Matrix

- `GET /api/auth/me`: any authenticated key
- `GET /api/history`: `read`
- `POST /api/generate-documentation`: `generate`
- `POST /api/generate-documentation-async`: `generate`
- `POST /api/access/keys`: `manage`
- `DELETE /api/access/keys/<key_id>`: `manage`
- `POST /api/cache/clear`: `admin`

For implementation details, see backend routes in `backend/server.py`.
