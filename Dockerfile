FROM python:3.12-slim
WORKDIR /app
ENV AGENTFAULT_SCENARIOS_DIR=/app/scenarios
ENV AGENTFAULT_RESULTS_DIR=/app/results
COPY pyproject.toml README.md ./
COPY src ./src
COPY scenarios ./scenarios
RUN pip install --no-cache-dir .
EXPOSE 8000
CMD ["uvicorn", "agentfault.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
