FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first (cached layer). Copy only project metadata, then install.
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e ".[dev]"

# App source (also bind-mounted in docker-compose for live reload during dev).
COPY . .

RUN chmod +x ./entrypoint.sh
# Invoke via bash so a non-exec bind-mounted copy (e.g. from a Windows host) still runs.
ENTRYPOINT ["bash", "./entrypoint.sh"]
