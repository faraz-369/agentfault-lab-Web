# AgentFault Lab Web

Next.js dashboard for the AgentFault Lab FastAPI simulator. The browser calls a same-origin Next.js route (`/api/backend/*`); that server route adds the backend API key so the secret is never shipped to client-side JavaScript.

## Requirements

- Node.js 20.9 or newer
- A running AgentFault Lab API

## Local development

From this `frontend` directory:

```powershell
npm install
Copy-Item .env.example .env.local
```

Edit `.env.local` and set `AGENTFAULT_API_URL` to the API origin and `AGENTFAULT_API_KEY` to the same secret configured on the API. For local API development, you can run the API from the repository root in another terminal:

```powershell
$env:APP_ENV = "development"
python -m uvicorn agentfault.api.app:app --reload --port 8000
```

Set `AGENTFAULT_API_URL=http://127.0.0.1:8000` in `frontend/.env.local`. In development, if no API key is configured, the API accepts local requests. Start the frontend:

```powershell
npm run dev
```

Open <http://localhost:3000>.

## Production environment variables

Configure these in the frontend hosting dashboard (for example, Vercel):

- `AGENTFAULT_API_URL`: deployed API base URL, without a trailing slash.
- `AGENTFAULT_API_KEY`: the exact secret configured on the backend. Do not prefix it with `NEXT_PUBLIC_`.

The API key is only read in the Next.js server route and is never exposed as a browser environment variable.

## Checks

```powershell
npm run lint
npm run build
```
