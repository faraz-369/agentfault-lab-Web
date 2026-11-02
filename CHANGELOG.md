# Changelog

## 0.2.0 — Web dashboard MVP

- Added a responsive Next.js dashboard with experiment configuration, scenario library, policy comparison, and execution trace inspection.
- Added a server-side frontend proxy so the shared backend API key is not sent to browser JavaScript.
- Added a production fail-closed API-key guard for protected FastAPI endpoints and bounded experiment inputs.
- Added Render Blueprint deployment configuration and Vercel deployment documentation.
- Extended CI to test the Python backend and build/lint the frontend.
- Documented remaining production work: durable database, user-level authentication, shared rate limiting, monitoring, and security review.

## 0.1.0 — Initial research prototype

- Deterministic fault-injection simulator and structured execution traces.
- Three bounded recovery policies and explicit invariant checks.
- Repeated experiment runner with JSON, JSONL, and SQLite outputs.
- FastAPI service, CLI, sample scenarios, tests, Docker packaging, and CI workflow.
