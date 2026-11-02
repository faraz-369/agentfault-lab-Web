# Deployment guide

This guide deploys the current AgentFault Lab **simulator MVP**. It is not a claim that the project is already a fully production-hardened multi-tenant SaaS.

## Before deploying

- Push the code to GitHub.
- The backend uses a shared API key for protected endpoints. The Next.js server-side proxy attaches that key; browser code never receives it.
- Do not expose `/scenarios`, `/runs`, or `/experiments` publicly without setting `APP_ENV=production` and a strong `AGENTFAULT_API_KEY`.
- The included simulator only runs the repository's shipped scenarios. It does not execute arbitrary user code.

## 1. Deploy the API on Render

1. Sign in to [Render](https://render.com/).
2. Choose **New → Blueprint** and connect `faraz-369/agentfault-lab`, or create a Web Service from that repository.
3. Choose branch `feat/production-platform` while testing this branch.
4. If using the Blueprint, review `render.yaml` and create the service named `agentfault-lab-api`.
5. Confirm the environment variables:
   - `APP_ENV=production`
   - `AGENTFAULT_API_KEY`: a strong random secret. The Blueprint generates one.
   - `AGENTFAULT_RESULTS_DIR=/tmp/agentfault-results`
6. Wait for deployment to complete. Copy the service URL, such as `https://agentfault-lab-api.onrender.com`.
7. Open `<API_URL>/health`. It should return JSON with `"status":"ok"`.

The API intentionally returns `503` for protected endpoints if `APP_ENV=production` but `AGENTFAULT_API_KEY` is missing. A `401` from `/scenarios` without the key is expected after the key is configured.

## 2. Deploy the frontend on Vercel

1. Sign in to [Vercel](https://vercel.com/).
2. Choose **Add New → Project**, then import `faraz-369/agentfault-lab`.
3. Set **Root Directory** to `frontend`.
4. Let Vercel detect Next.js. The build command should be `npm run build` (or the detected equivalent).
5. Add these environment variables for Preview and Production as appropriate:
   - `AGENTFAULT_API_URL`: the Render API URL, without a trailing slash.
   - `AGENTFAULT_API_KEY`: the exact same secret as the Render service.
6. Deploy and open the generated Vercel URL.
7. Check that the scenario list loads, run a scenario, inspect the trace, and export a trace JSON file.

Never prefix `AGENTFAULT_API_KEY` with `NEXT_PUBLIC_`. `NEXT_PUBLIC_` variables are embedded in client-side JavaScript.

## 3. Git workflow

Use `feat/production-platform` for development. Verify tests and frontend build, push the branch, then open a pull request into `main`. Merge only after reviewing the changes. For the final public production deployment, configure Render and Vercel to deploy from `main`.

## Current limitations before calling this production SaaS

- The current run store is SQLite-based and the included Render configuration writes outputs to `/tmp`, which is ephemeral. Run history can be lost when the service restarts or redeploys. Use a managed persistent database before promising durable history.
- There is no user identity, workspace isolation, billing, or per-user quota system.
- The API key is a single shared service secret, not end-user authentication.
- The included simulator is deterministic and narrow; benchmark results only describe included scenarios.
- Free hosting plans can sleep or have resource limits. Review current provider pricing and limits before relying on this for important workloads.

For a public demo, this deployment pattern protects the API secret and demonstrates the current features. Before production customer use, add managed PostgreSQL persistence, user authentication/authorization, per-user quotas, monitoring, backups, and security review.
