from __future__ import annotations

import os
import secrets
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from agentfault.experiment import run_experiment
from agentfault.models import ExperimentConfig
from agentfault.runner.engine import run_scenario
from agentfault.scenarios import load_scenarios

PROJECT_ROOT = Path(__file__).resolve().parents[3]

def _default_project_dir(name: str) -> Path:
    """Prefer the working repository (Render/Docker), then the source checkout."""
    working_path = Path.cwd() / name
    source_path = PROJECT_ROOT / name
    if working_path.exists():
        return working_path.resolve()
    return source_path.resolve()


SCENARIOS_DIR = Path(os.getenv("AGENTFAULT_SCENARIOS_DIR") or _default_project_dir("scenarios")).resolve()
RESULTS_DIR = Path(os.getenv("AGENTFAULT_RESULTS_DIR") or _default_project_dir("results")).resolve()

app = FastAPI(
    title="AgentFault Lab API",
    version="0.1.0",
    description=(
        "Reproducible fault-injection and recovery experiments for AI-agent workflows. "
        "This API runs the included deterministic simulator; it does not execute arbitrary user code."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)


class RunRequest(BaseModel):
    scenario_id: str = Field(min_length=1, max_length=100)
    policy: str = Field(default="none", min_length=1, max_length=32)
    seed: int = Field(default=7, ge=0, le=2_147_483_647)


class ExperimentRequest(BaseModel):
    scenario_ids: list[str] = Field(min_length=1, max_length=3)
    policies: list[str] = Field(
        default_factory=lambda: ["none", "retry", "state_aware"], min_length=1, max_length=3
    )
    trials: int = Field(default=1, ge=1, le=10)
    seed: int = Field(default=7, ge=0, le=2_147_483_647)


def require_api_key(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> None:
    """Require a shared secret when configured, and fail closed in production."""
    expected = os.getenv("AGENTFAULT_API_KEY")
    environment = os.getenv("APP_ENV", "development").lower()

    if not expected:
        if environment in {"production", "prod"}:
            raise HTTPException(
                status_code=503,
                detail="API authentication is not configured. Set AGENTFAULT_API_KEY on the server.",
            )
        return

    if not x_api_key or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Missing or invalid API key")


@app.get("/health")
def health():
    # Keep health checks unauthenticated so the hosting provider can probe service health.
    return {"status": "ok", "service": "agentfault-lab", "version": "0.1.0"}


@app.get("/scenarios", dependencies=[Depends(require_api_key)])
def list_scenarios():
    scenarios = load_scenarios(SCENARIOS_DIR)
    return [
        {
            "scenario_id": scenario.scenario_id,
            "name": scenario.name,
            "description": scenario.description,
            "tags": scenario.tags,
        }
        for scenario in scenarios.values()
    ]


@app.post("/runs", dependencies=[Depends(require_api_key)])
def create_run(request: RunRequest):
    scenarios = load_scenarios(SCENARIOS_DIR)
    scenario = scenarios.get(request.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    try:
        result = run_scenario(scenario, request.policy, seed=request.seed)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result.model_dump(mode="json")


@app.post("/experiments", dependencies=[Depends(require_api_key)])
def create_experiment(request: ExperimentRequest):
    config = ExperimentConfig(
        scenario_ids=request.scenario_ids,
        policies=request.policies,
        trials=request.trials,
        seed=request.seed,
        output_dir=str(RESULTS_DIR),
    )
    try:
        results, report = run_experiment(config, SCENARIOS_DIR, RESULTS_DIR)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "report": report,
        "run_count": len(results),
        "runs": [result.model_dump(mode="json", exclude={"events"}) for result in results],
    }
