# Logging Guideline

## Overview

All services emit structured JSON logs to stdout. The observability pipeline picks them up automatically.

**Backend** uses `structlog` configured for JSON output.  
**Frontend** does not emit structured logs — browser console only; no log shipping.

---

## Log Format

### Standard fields

Field order is fixed across all log lines:

| # | Field     | Type   | Example                    |
|---|-----------|--------|----------------------------|
| 1 | `level`   | string | `info`, `warning`, `error` |
| 2 | `service` | string | `"mentor"`                 |
| 3 | `event`   | string | `"request"`                |
| 4 | _additional fields_ | — | —                    |

`timestamp` is intentionally absent — Promtail records ingestion time automatically.

### Correlation

All log lines produced during a client request carry `request_id` — a correlation identifier that flows through the entire chain: middleware → handler → services → outgoing calls.

`request_id` is always the **first additional field** (position 4).

### Log types

**HTTP** — two lines per incoming request emitted by request logging middleware.

Arrival (`event: "request"`):

```json
{"level":"info","service":"mentor","event":"request","request_id":"550e8400-...","method":"POST","path":"/api/chat"}
```

Completion (`event: "response"`):

```json
{"level":"info","service":"mentor","event":"response","request_id":"550e8400-...","method":"POST","path":"/api/chat","status":200,"duration_ms":1240}
```

**App** — arbitrary application logs with additional fields defined per log site:

```json
{"level":"info","service":"mentor","event":"llm request","request_id":"550e8400-...","history_len":5}
{"level":"info","service":"mentor","event":"llm response","request_id":"550e8400-...","tokens":312}
```

Outside a client request (startup, background jobs) — no `request_id`:

```json
{"level":"info","service":"mentor","event":"server started","port":8002}
{"level":"info","service":"mentor","event":"cleanup done","job":"cleanup","deleted":42}
```

### Field conventions

Use `snake_case` for all field names. Keep records flat — no nested objects.

| Field        | Type   | Notes                                                         |
|--------------|--------|---------------------------------------------------------------|
| `level`      | string | Always first                                                  |
| `service`    | string | Always second                                                 |
| `event`      | string | Always third                                                  |
| `request_id` | string | First additional field; present within a client request only  |
| `method`     | string | HTTP method — from middleware                                 |
| `path`       | string | Request path — from middleware                                |
| `status`     | int    | Response status code — from middleware                        |
| `duration_ms`| int    | Response time in milliseconds — from middleware               |
| `error`      | string | Error message — `"error": str(exc)`                          |

---

## Logger Construction

**Backend (Python / structlog)**

One logger per module, named after the service:

```python
import structlog

log = structlog.get_logger().bind(service="mentor")
```

Always bind `request_id` at the request boundary (FastAPI middleware):

```python
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    with structlog.contextvars.bound_contextvars(request_id=request_id):
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
    return response
```

Always use context-bound log calls inside request scope — otherwise `request_id` will not appear.

---

## Correlation ID Propagation

**Inbound** — middleware reads `X-Request-ID` from the request header. If absent, a new UUID is generated. The ID is stored in context and echoed back in the response header.

**Outbound** — forward the ID to downstream services:

```python
headers = {"X-Request-ID": get_current_request_id()}
async with httpx.AsyncClient() as client:
    await client.post(url, json=payload, headers=headers)
```

---

## Log Levels

| Level     | When to use                                                   |
|-----------|---------------------------------------------------------------|
| `debug`   | Developer diagnostics; disabled in production                 |
| `info`    | Normal operation events (startup, request handled, job done)  |
| `warning` | Recoverable anomalies (retry, fallback, degraded path)        |
| `error`   | Failures that affect correctness and require attention        |

Do not log and raise an exception simultaneously — let the caller decide whether to log.

---

## Observability Pipeline

```
Service (stdout, JSON)
    │
    │ Docker json-file driver (max 10 MB × 3 files per container)
    ▼
Promtail
    (Docker socket autodiscovery, labels: service / compose_service)
    │
    │ HTTP push
    ▼
Loki  (retention: 72 h)
    │
    ▼
Grafana
```

Because Promtail records ingestion time, services must **not** include a timestamp in log output.
