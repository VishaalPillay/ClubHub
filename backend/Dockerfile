FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first (cached layer). Copy only project metadata, then install.
# INSTALL_DEV toggles the dev extras (pytest/ruff/testcontainers): docker-compose passes
# "true" for local work; the production build leaves it "false" for a lean, tool-free image.
ARG INSTALL_DEV=false
COPY pyproject.toml ./
RUN pip install --upgrade pip && \
    if [ "$INSTALL_DEV" = "true" ]; then pip install -e ".[dev]"; else pip install -e .; fi

# App source (also bind-mounted in docker-compose for live reload during dev).
COPY . .

RUN chmod +x ./entrypoint.sh
# Invoke via bash so a non-exec bind-mounted copy (e.g. from a Windows host) still runs.
ENTRYPOINT ["bash", "./entrypoint.sh"]
