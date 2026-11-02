# Limitations

1. The current runner is a deterministic simulator, not a universal adapter for agent frameworks.
2. Failure localization is limited to observable invariant violations.
3. The included scenarios are hand-authored and small.
4. Local duration measurements are not production performance measurements.
5. The included benchmark is deterministic; stochastic LLM evaluation is not included.
6. Recovery policies are intentionally simple.
7. The backend uses a shared API key for the hosted demo, not end-user authentication or workspace isolation.
8. The frontend's in-memory rate limiter is best-effort only and is not a distributed rate-limiting system.
9. The default hosted results directory is ephemeral. Experiment history may be lost on restart/redeploy until managed persistent storage is added.
10. The system does not execute arbitrary user code.
11. The project does not claim superiority over Phoenix, Langfuse, AgentOps, or other existing tools.
12. A successful test suite demonstrates behavior on the included scenarios only.
13. The Next.js frontend build must be verified in an environment with npm registry access; the authoring environment used for this artifact could not resolve `registry.npmjs.org`.
