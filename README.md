# AgentFault Lab

**Reproduce the failure. Find the broken invariant. Prove the recovery.**

AgentFault Lab is an open-source, local-first laboratory for controlled fault injection and recovery experiments in multi-step agent workflows. It records structured execution events, checks explicit invariants, compares recovery policies, and saves experiment results for inspection and regression testing.

> **Status:** Initial working implementation / research prototype. The benchmark uses a small deterministic simulator. Results are not evidence of production-wide reliability or universal LLM behavior.

<img width="1350" height="596" alt="image" src="https://github.com/user-attachments/assets/a2f3ec69-ebcf-4bde-8c8e-80f81d64e2c3" />
<img width="1304" height="356" alt="image" src="https://github.com/user-attachments/assets/7aaf50b2-d9c0-4d91-8e12-6057ab72ac91" />
<img width="1312" height="594" alt="image" src="https://github.com/user-attachments/assets/2b426118-f718-46c7-9d4d-ad0c58e2f270" />
<img width="1054" height="478" alt="image" src="https://github.com/user-attachments/assets/25e686fd-a8d5-43ac-9a51-08401e9fc588" />
<img width="1046" height="388" alt="image" src="https://github.com/user-attachments/assets/32439716-7011-4143-a1a8-af5bc67b7ec3" />


## Why this exists

Tracing and LLM evaluation platforms already cover substantial parts of debugging and evaluation. AgentFault Lab focuses on a narrower workflow:

1. Define a workflow and its invariants.
2. Inject a known failure at a controlled point.
3. Record tool calls, results, state transitions, and recovery decisions.
4. Compare no-recovery, retry, and state-aware recovery policies.
5. Export and rerun the scenario as a regression test.

The initial implementation deliberately uses simulated tools and does not require an LLM or a paid API. This makes it possible to validate the test harness before introducing model nondeterminism.

## Features

- Deterministic tool simulator for example workflows.
- Fault injection: timeout, exception, malformed response, and repeated-response marker.
- Structured event traces with sequence numbers and timestamps.
- Explicit invariant checking.
- Three policies: `none`, `retry`, and `state_aware`.
- Experiment runner with repeated trials.
- JSON summary, JSONL run records, per-run trace files, and SQLite persistence.
- FastAPI endpoints and command-line interface.
- Unit, API, integration, regression, and execution-bound tests.
- Dockerfile, Docker Compose, GitHub Actions, and contributor/security documentation.

## Quick start

Requirements: Python 3.10+.

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

python -m pip install -e ".[dev]"
pytest
```

List scenarios:

```bash
agentfault list --scenarios-dir scenarios
```

Run one scenario:

```bash
agentfault run \
  --scenario order_malformed_response \
  --policy state_aware \
  --scenarios-dir scenarios \
  --output results/one-run.json
```

On Windows Command Prompt, put the command on one line or use `^` for line continuation.

Run the benchmark:

```bash
agentfault benchmark \
  --scenarios order_malformed_response notification_timeout malformed_transform \
  --policies none retry state_aware \
  --trials 5 \
  --scenarios-dir scenarios \
  --output-dir results \
  --experiment-id baseline-v1
```

Or run the supplied configuration from the repository root:

```bash
python benchmarks/run_benchmark.py
```

Outputs include:
- `results/<experiment-id>_summary.json`
- `results/<experiment-id>_runs.jsonl`
- `results/traces/<run-id>.jsonl`
- `results/agentfault.db`

A sample 45-run baseline report and its run records are included in [`results/`](results/README.md).
The observed policy comparison and its interpretation are documented in
[`docs/benchmark-methodology.md`](docs/benchmark-methodology.md).

The SQLite database stores run metadata and event rows. Do not commit generated traces or databases if they contain sensitive data.

## Example scenario

`scenarios/order_processing/order_malformed_response.json` models a state-changing order update that succeeds internally but returns a malformed response. A blind retry can perform the operation twice. The state-aware policy checks the simulated state before retrying.

Run the example:

```bash
python examples/run_one_scenario.py
```

Expected qualitative behavior:
- `none`: stops after the malformed response.
- `retry`: retries the update; the simulated update count becomes 2 and the duplicate-operation invariant is violated.
- `state_aware`: detects the already-applied status update and resumes without applying the update again.

This is a designed simulator scenario, not an empirical claim about arbitrary agent frameworks.

## API

Start the local API from the repository root:

```bash
uvicorn agentfault.api.app:app --host 127.0.0.1 --port 8000
```

Open the interactive API docs at `http://127.0.0.1:8000/docs`.

Endpoints:
- `GET /health`
- `GET /scenarios`
- `POST /runs`
- `POST /experiments`

Example run request:

```json
{
  "scenario_id": "notification_timeout",
  "policy": "retry",
  "seed": 7
}
```

The API resolves the shipped `scenarios/` directory from the working repository by default; set `AGENTFAULT_SCENARIOS_DIR` explicitly when deploying from a different working directory or an installed package. For a public deployment, set `APP_ENV=production` and configure a strong `AGENTFAULT_API_KEY`. Protected routes require the `X-API-Key` header; `/health` remains public for hosting health checks. The web frontend attaches the key server-side. This MVP still needs shared rate limiting, durable managed database storage, user-level authorization, and a security review before production customer use.

## Docker

```bash
docker compose up --build
```

The API is exposed on port 8000. Results are written to the mounted `results/` directory. This container does not execute arbitrary user-provided agent code; do not add that capability without a dedicated sandbox design.

## Architecture

```mermaid
flowchart TD
    A[Experiment Configuration] --> B[Scenario Loader]
    B --> C[Agent Runner]
    C --> D[Simulated Tools]
    E[Fault Injector] --> D
    D --> C
    C --> F[Execution Recorder]
    F --> G[JSONL Event Trace]
    F --> H[SQLite Run Store]
    G --> I[Invariant Checker]
    G --> J[Failure Analyzer]
    I --> K[Experiment Evaluator]
    J --> K
    K --> L[Policy Comparison and Metrics]
    L --> M[JSON Report]
    L --> N[Regression Scenario Workflow]
```

### Main modules

- `models.py`: validated scenario, event, and result schemas.
- `runner/engine.py`: deterministic workflow runner.
- `faults/injector.py`: call-count-based deterministic faults.
- `invariants/checker.py`: invariant checks.
- `recovery/policies.py`: bounded recovery policy definitions.
- `recorder/recorder.py`: append-only structured event recorder.
- `evaluation/metrics.py`: aggregate metrics and Wilson confidence interval utility.
- `store.py`: SQLite persistence.
- `experiment.py`: repeated experiment orchestration.
- `analysis/report.py`: JSON, JSONL, trace, and database outputs.
- `api/app.py`: FastAPI interface.
- `cli.py`: command-line interface.

## Benchmark methodology

Included scenarios cover:
- A malformed response after a state-changing order update.
- A transient notification timeout.
- A malformed transformation response.

Policies:
- `none`: no retry.
- `retry`: bounded blind retry.
- `state_aware`: inspect known simulated state before retrying an order update.

Metrics currently reported:
- Task success rate.
- Fault injection rate.
- Invariant violation rate.
- Mean tool calls.
- Mean retries.
- Median duration.
- Total invariant violations.

Run the benchmark with multiple trials and retain the configuration with the results. The current scenarios are deterministic, so repeated trials primarily validate repeatability and output handling; they are not independent stochastic samples. Do not interpret a confidence interval from repeated identical deterministic runs as evidence of generalization.

### What is and is not measured

Measured by the current implementation:
- Whether a configured fault was triggered.
- Whether the workflow reached its configured expected final state.
- Whether explicit supported invariants were violated.
- Tool-call and retry counts.
- Runtime of the local simulation.
- Whether a known duplicate-operation scenario is caught.

Not yet established:
- General root-cause diagnosis for arbitrary LLM behavior.
- Reliability across external agent frameworks.
- Production latency or throughput.
- Security of executing arbitrary user code.
- Generalization to real production workloads.
- Superiority over existing observability platforms.

## Scenario format

Scenarios are JSON documents validated with Pydantic. They include a task, initial state, ordered action list, optional fault, invariants, and execution bounds. The simulator currently supports these tools:

- `validate_order`
- `update_order_status`
- `send_notification`
- `read_file`
- `transform_data`
- `mark_complete`

Supported fault kinds:
- `timeout`
- `exception`
- `malformed`
- `repeat_response`

Supported invariant kinds:
- `required_final_state`
- `unique_operation`
- `no_false_completion`
- `no_malformed_result_used`

Add a new tool or invariant only with tests and an updated scenario example.

## Security and privacy

- The project runs simulated tools and does not require credentials.
- The API supports a shared `AGENTFAULT_API_KEY` and fails closed in production if it is not configured. This is not end-user authentication or tenant isolation.
- Traces may include tool arguments and state snapshots. Avoid secrets and personal data in scenarios.
- Do not execute arbitrary submitted Python code in the API process.
- If you add real tools, use explicit allowlists and safe test environments.

See [`docs/threat-model.md`](docs/threat-model.md).

## Development

```bash
python -m pip install -e ".[dev]"
pytest
```

Optional style check:

```bash
ruff check src tests
```

The project targets Python 3.10+. CI tests Python 3.10, 3.11, and 3.12.

## Roadmap

1. Harden event semantics and scenario schema.
2. Add scenario-level expected-result validation.
3. Add scenario minimization for failing runs.
4. Add optional local LLM adapter, with prompts/model metadata captured.
5. Add bootstrap comparisons for stochastic runs.
6. Add one framework adapter after verifying the core interface.
7. Add a lightweight trace viewer only if users need it.

## Prior art and related work

This project is not a replacement for general tracing or evaluation products. Useful comparison points include:
- [Arize Phoenix](https://github.com/Arize-ai/phoenix)
- [Langfuse](https://github.com/langfuse/langfuse)
- [AgentOps](https://github.com/AgentOps-AI/agentops)
- [DeepEval](https://github.com/confident-ai/deepeval)
- [SWE-bench](https://github.com/SWE-bench/SWE-bench)

The proposed distinction is a small, reproducible workflow connecting injected failures, observable invariant violations, recovery-policy comparison, and regression scenarios. That distinction should be validated against current releases before making originality claims.

## License

MIT. Check third-party dependency and model licenses before redistributing optional components.

## Web dashboard

A Next.js dashboard lives in [`frontend/`](frontend/README.md). It includes an experiment configuration UI, scenario library, policy comparison, and event trace explorer. The frontend uses a server-side API proxy so the backend API key is not exposed to browser JavaScript.

### Local frontend development

Requirements: Node.js 20.9 or newer.

1. Start the Python API from the repository root in one terminal:

   ```powershell
   $env:APP_ENV = "development"
   python -m uvicorn agentfault.api.app:app --reload --port 8000
   ```

2. In a second terminal:

   ```powershell
   cd frontend
   npm install
   Copy-Item .env.example .env.local
   ```

3. Set `AGENTFAULT_API_URL=http://127.0.0.1:8000` in `frontend/.env.local`. In local development, the API does not require a key unless `AGENTFAULT_API_KEY` is configured.
4. Run `npm run dev` and open `http://localhost:3000`.

### Deployment overview

- **API:** use the included [`render.yaml`](render.yaml) Blueprint, or create a Render Web Service from this repository. The API starts with `uvicorn agentfault.api.app:app --host 0.0.0.0 --port $PORT` and uses `/health` as its health check.
- **Frontend:** import this GitHub repository into Vercel and set the **Root Directory** to `frontend`.
- **Frontend environment variables:** set `AGENTFAULT_API_URL` to the deployed API URL and `AGENTFAULT_API_KEY` to the exact backend secret. Do not name it `NEXT_PUBLIC_*`; it must remain server-side.
- **Backend environment:** set `APP_ENV=production` and configure a strong `AGENTFAULT_API_KEY`. Protected API routes fail closed if the key is missing. `/health` stays public for hosting health checks.

See [`docs/deployment.md`](docs/deployment.md) for step-by-step hosting setup and the current MVP limitations.
