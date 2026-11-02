from fastapi.testclient import TestClient

from agentfault.api.app import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_scenarios_endpoint_lists_shipped_scenarios():
    response = client.get("/scenarios")
    assert response.status_code == 200
    scenario_ids = {item["scenario_id"] for item in response.json()}
    assert {
        "order_malformed_response",
        "notification_timeout",
        "malformed_transform",
    }.issubset(scenario_ids)


def test_run_endpoint_executes_retry_policy():
    response = client.post(
        "/runs", json={"scenario_id": "notification_timeout", "policy": "retry"}
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["retries"] == 1
    assert payload["events"]


def test_run_endpoint_returns_404_for_unknown_scenario():
    response = client.post("/runs", json={"scenario_id": "missing"})
    assert response.status_code == 404


def test_run_endpoint_returns_400_for_unknown_policy():
    response = client.post(
        "/runs", json={"scenario_id": "notification_timeout", "policy": "magic"}
    )
    assert response.status_code == 400


def test_experiment_endpoint_writes_report(tmp_path, monkeypatch):
    from agentfault.api import app as api_module
    monkeypatch.setattr(api_module, "RESULTS_DIR", tmp_path)
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("AGENTFAULT_API_KEY", raising=False)
    response = client.post(
        "/experiments",
        json={
            "scenario_ids": ["notification_timeout"],
            "policies": ["retry"],
            "trials": 1,
        },
    )
    assert response.status_code == 200
    assert response.json()["run_count"] == 1
    assert len(response.json()["runs"]) == 1
    summaries = list(tmp_path.glob("*_summary.json"))
    assert len(summaries) == 1


def test_production_api_fails_closed_without_api_key(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("AGENTFAULT_API_KEY", raising=False)
    response = client.get("/scenarios")
    assert response.status_code == 503


def test_api_key_is_required_when_configured(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AGENTFAULT_API_KEY", "test-secret")
    assert client.get("/scenarios").status_code == 401
    assert client.get("/scenarios", headers={"X-API-Key": "wrong"}).status_code == 401
    response = client.get("/scenarios", headers={"X-API-Key": "test-secret"})
    assert response.status_code == 200
