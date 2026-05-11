FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-editable

COPY . .

ENV HOST=0.0.0.0
ENV PORT=8000

EXPOSE 8000

CMD ["uv", "run", "gunicorn", "-w", "2", "-b", "0.0.0.0:8000", "app:app"]
