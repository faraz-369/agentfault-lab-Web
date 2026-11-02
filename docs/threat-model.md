# Threat model

## Current trust boundary

The current implementation runs a fixed simulator and allowlisted tool functions. It does not execute arbitrary Python code supplied through the API.

## Assets

- Local scenario files.
- Run traces and state snapshots.
- Experiment metadata.
- The shared backend API key used by the frontend server-side proxy.
- Any future tool credentials or user-provided data.

## Risks

- Traces may contain secrets if users put them in scenario arguments or state.
- The backend uses a single shared API key, not end-user identity or workspace authorization.
- The frontend includes a best-effort in-memory request limiter; serverless instances do not share its state, so it is not a distributed abuse-control system.
- Scenario files are loaded from the local filesystem.
- The default hosted output directory is ephemeral; results can be lost after restart or redeploy.
- A future plugin/adapter system could accidentally grant real state-changing capabilities to an experiment.

## Mitigations currently included

- In production mode, protected API endpoints fail closed if `AGENTFAULT_API_KEY` is not configured.
- Protected API routes require a constant-time-checked `X-API-Key` comparison.
- Request bodies and experiment request sizes are bounded.
- The Next.js server-side proxy holds the API key; it is not exposed through a `NEXT_PUBLIC_*` variable.
- The public proxy allowlists the API paths it forwards and has a best-effort per-process rate limit.
- The health endpoint is public for provider health checks and exposes only minimal status.
- Avoid secrets and personal data in test scenarios.
- Use synthetic state and mock tools.

## Required before production customer use

- Replace the shared key with user authentication and workspace-level authorization.
- Add a shared, distributed rate limiter and per-user quotas.
- Use managed durable storage and backups for experiment data.
- Add monitoring, alerting, abuse controls, and a security review.
- If arbitrary code execution is ever added, use a dedicated sandbox with resource limits, filesystem isolation, network restrictions, and no inherited credentials.
- Use allowlists for real tool integrations and require explicit opt-in for state-changing operations.

## Non-goals

This prototype is not a secure multi-tenant service and has not undergone a formal security audit.
