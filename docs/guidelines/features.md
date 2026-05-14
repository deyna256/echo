# Feature Implementation Guideline

## Principles

- **Testability** — every module must be testable in isolation. Dependencies are hidden behind minimal interfaces defined on the consumer side.
- **Observability** — every meaningful operation is logged. The correlation ID flows from the entry point to the deepest call.
- **Simplicity** — implement exactly what is required. No speculative generality, no over-engineering.
- **Fail fast** — validate required configuration at startup. Never silently fall back to a wrong default.

---

## Configuration

Load all configuration from environment variables at startup. Fail fast if a required value is absent.

**Backend (Python)**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_port: int = 8002
    db_url: str          # required — pydantic raises on startup if absent
    mentor_url: str      # required

settings = Settings()
```

Never call `os.environ` outside of the settings module. Pass the settings object to everything that needs it.

---

## Module Structure

Each domain area is a self-contained package. The typical layout for a FastAPI domain:

```
api/
└── mentor/
    ├── __init__.py
    ├── api.py          # FastAPI router — HTTP only, no business logic
    ├── service.py      # business logic
    └── api_settings.py # pydantic settings for this domain
```

Rules:
- `api.py` contains only HTTP translation — decode request → call service → encode response.
- Each module has a single clear responsibility.
- Do not create a module for a single function.

---

## Dependency Injection

Define dependencies on the **consumer side**. Use constructor injection, not global imports of concrete implementations.

**Backend (Python)**

```python
# service.py — consumer defines what it needs via protocol/ABC
from typing import Protocol

class MentorClient(Protocol):
    async def complete(self, messages: list[dict]) -> str: ...

class MentorService:
    def __init__(self, client: MentorClient) -> None:
        self._client = client
```

```python
# api.py — wiring happens at the router level via FastAPI Depends
def get_service() -> MentorService:
    return MentorService(client=HttpMentorClient(settings.mentor_url))

@router.post("/chat")
async def chat(req: ChatRequest, svc: MentorService = Depends(get_service)):
    return await svc.chat(req)
```

Rules:
- Interfaces contain only the methods the consumer actually calls.
- Inject dependencies through constructors, not global state.
- Test implementations satisfy the same interface without knowing about it.

---

## HTTP Handlers

Handlers translate HTTP to domain calls and back. No business logic in handlers.

```python
@router.post("/chat")
async def chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    svc: MentorService = Depends(get_service),
) -> ChatResponse:
    result = await svc.chat(req, user_id=current_user.id)
    return ChatResponse.from_domain(result)
```

Rules:
- Decode input → call service → encode output.
- Log errors at the handler level — pass request context so `request_id` is attached.
- Return appropriate HTTP status codes. Do not swallow errors silently.

---

## Error Handling

Wrap errors with context at every layer boundary.

**Backend (Python)**

```python
# storage layer
async def save_message(self, msg: Message) -> None:
    try:
        await self._db.execute(INSERT_SQL, msg.id, msg.text)
    except SQLAlchemyError as e:
        raise StorageError(f"save message: {e}") from e

# service layer
async def chat(self, req: ChatRequest) -> ChatResponse:
    try:
        await self._storage.save_message(msg)
    except StorageError as e:
        raise ServiceError(f"chat: {e}") from e
```

Rules:
- Each layer wraps with its own context: `"save message: ..."`, `"chat: ..."`.
- Do not discard errors silently.
- Use typed exceptions for conditions callers need to branch on.

---

## Observability

Log at the entry point and at significant domain events. Pass context to every log call. See [logging guideline](logging.md).

---

## Testability

Structure code so dependencies can be replaced with test implementations:

```python
class StubMentorClient:
    def __init__(self, response: str) -> None:
        self._response = response

    async def complete(self, messages: list[dict]) -> str:
        return self._response

async def test_mentor_service_returns_llm_response():
    svc = MentorService(client=StubMentorClient("hello"))
    result = await svc.chat(ChatRequest(text="hi"))
    assert result.text == "hello"
```

See [testing guideline](testing.md) for full conventions.
