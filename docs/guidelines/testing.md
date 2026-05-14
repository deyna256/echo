# Testing Guideline

## Philosophy

- Tests verify behaviour, not implementation details.
- Every module must be independently testable without real external services.
- No mocks for external infrastructure (HTTP servers, databases) — use real in-process replacements (`httptest`, SQLite in-memory, `httpx` ASGI transport). A mock tests how you *think* a dependency behaves; if the contract is misunderstood or the dependency changes, the mock keeps passing while production breaks.
- Test doubles for *your own* interfaces are fine — if a module defines a `Storage` protocol on the consumer side, a test implementation satisfying it is not a mock of an external service; it is a real implementation of your own contract.
- Test only observable outcomes: return values, HTTP responses, side effects visible through the public API.

---

## Package Layout

Mirror the source structure in the test tree.

**Backend (Python)**

```
source/api/mentor/service.py
tests/unit/test_mentor_service.py
tests/integration/test_mentor.py
```

Use `tests/unit/` for tests that require no external services.  
Use `tests/integration/` for tests that hit a real database (in-memory SQLite via `pytest` fixtures).

**Frontend** (ui)

E2E specs live in `ui/e2e/` and are run with Playwright. There are no unit test files for the frontend — component logic is covered by E2E.

---

## Test Function Naming

```
test_<subject>_<scenario>
```

`subject` is the function or class under test. `scenario` describes the input condition or system state, not the expected result.

```python
# good
def test_mentor_service_when_llm_unavailable_raises_service_error(): ...
def test_auth_service_given_wrong_password_returns_401(): ...
def test_slugify_given_cyrillic_input_returns_transliterated_slug(): ...

# bad
def test_mentor_service(): ...          # no scenario
def test_auth_returns_token(): ...      # describes result, not condition
def test_slugify_success(): ...         # "success" is not a scenario
```

---

## Structure

Each test follows Arrange → Act → Assert without section comments:

```python
async def test_mentor_service_given_valid_request_returns_llm_text():
    stub = StubLLMClient(response="hello")
    svc = MentorService(client=stub)

    result = await svc.chat(ChatRequest(text="hi"))

    assert result.text == "hello"
```

Rules:
- One logical scenario per test function.
- No conditional logic (`if` / `for`) inside a test body.
- If setup is long, extract a factory or fixture — keep the test body focused on the scenario.

---

## Assertions

Assert specific, known values — not just that the result is not `None`.

```python
# good
assert response.status_code == 200
assert result.total == 3
assert result.items[0].title == "Introduction"

# bad
assert result is not None
assert response.status_code in [200, 201]
assert isinstance(result, list)
```

Use `pytest.raises` to assert exceptions, and check the message when it matters:

```python
with pytest.raises(ServiceError, match="llm unavailable"):
    await svc.chat(req)
```

---

## HTTP Testing (Backend)

Use `httpx.AsyncClient` with FastAPI's `ASGITransport` — no real ports, no network:

```python
@pytest.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

async def test_chat_endpoint_returns_200(client, auth_headers):
    response = await client.post("/api/mentor/chat", json={"text": "hi"}, headers=auth_headers)
    assert response.status_code == 200
```

---

## Test Doubles

Implement test doubles as plain classes satisfying the consumer-defined interface:

```python
class StubLLMClient:
    def __init__(self, response: str = "", error: Exception | None = None) -> None:
        self._response = response
        self._error = error

    async def complete(self, messages: list[dict]) -> str:
        if self._error:
            raise self._error
        return self._response
```

Rules:
- Never use `unittest.mock.patch` to replace the module under test itself.
- Prefer stubs over mocks — verify return values, not that a specific method was called.
- If a test needs to assert that an outgoing call happened, inspect side effects (e.g. what was written to the database) rather than asserting call counts on a mock.

---

## Fixtures

Place shared fixtures in `conftest.py` at the appropriate directory scope:

- `tests/conftest.py` — database engine, app instance, auth helpers used everywhere.
- `tests/unit/conftest.py` — stubs and factories only relevant to unit tests.
- `tests/integration/conftest.py` — fixtures that require a real database.

Do not put fixtures in individual test files unless they are used only by that file.

---

## What Not to Test

- Internal implementation details (private methods, internal state).
- Framework or library behaviour (e.g. that FastAPI correctly parses a JSON body).
- Error paths that cannot happen given valid inputs from internal callers.
- Enum values or constants — they cannot change without modifying the source code.
