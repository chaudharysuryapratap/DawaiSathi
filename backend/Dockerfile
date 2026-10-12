FROM python:3.11-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_DEFAULT_TIMEOUT=180
WORKDIR /app
COPY backend/requirements-docker.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip pip install --retries 5 -r requirements.txt && pip check \
    && useradd --uid 10001 --create-home app \
    && mkdir -p /app/data/medicine-images /app/data/voice-notes /app/data/prescriptions \
    && chown -R app:app /app
COPY --chown=app:app backend/*.py ./
USER app
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]

FROM runtime AS test
USER root
RUN pip install --no-cache-dir pytest==8.3.5 pytest-xdist==3.6.1 httpx==0.27.2
COPY --chown=app:app backend/tests ./tests
COPY --chown=app:app backend/pytest.ini ./pytest.ini
USER app
CMD ["python", "-m", "pytest", "tests/test_family_auth_isolated.py", "tests/test_google_auth_isolated.py", "tests/test_profile_settings.py", "tests/test_inbox.py", "tests/test_persistence_isolated.py", "tests/test_readiness.py", "-q"]
