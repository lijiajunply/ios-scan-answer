from __future__ import annotations

import io
import json
import os
import random
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, abort, jsonify, redirect, render_template, send_file, url_for
import qrcode


BASE_DIR = Path(__file__).resolve().parent
STORE_PATH = BASE_DIR / "quiz_store.json"
QUESTION_BANK_PATH = BASE_DIR / "questions.json"
QUESTION_COUNT = 10
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)


def load_question_bank() -> list[str]:
    if QUESTION_BANK_PATH.exists():
        data = json.loads(QUESTION_BANK_PATH.read_text(encoding="utf-8"))
        if isinstance(data, list) and data:
            return [str(item) for item in data]

    raise RuntimeError(
        "没有找到题库文件。请在扫码答题/ 目录下放置 questions.json。"
    )


QUESTION_BANK = load_question_bank()


def now_iso() -> str:
    return datetime.now().astimezone(timezone.utc).astimezone().isoformat(timespec="seconds")


def parse_question(raw: str, index: int) -> dict[str, Any]:
    lines = [line.strip() for line in str(raw).splitlines() if line.strip()]
    if not lines:
        return {"number": index + 1, "stem": "", "options": [], "raw": ""}

    head = lines[0]
    match = re.match(r"^(\d+)\.?\s*(.*)$", head)
    number = int(match.group(1)) if match else index + 1
    stem = match.group(2).strip() if match else head.strip()

    option_text = " ".join(lines[1:]).replace("\r", " ").replace("\n", " ").strip()
    chunks = [chunk.strip() for chunk in re.split(r"\s{2,}(?=[A-D](?:[.．、\s]))", option_text) if chunk.strip()]

    options: list[dict[str, str]] = []
    for chunk in chunks:
        option_match = re.match(r"^([A-D])(?:[.．、\s]+)?(.*)$", chunk)
        if option_match:
            label = option_match.group(1)
            text = option_match.group(2).strip()
        else:
            label = chr(ord("A") + len(options))
            text = chunk
        options.append({"label": label, "text": text})

    return {
        "number": number,
        "stem": stem,
        "options": options,
        "raw": raw,
    }


def load_store() -> dict[str, Any]:
    if STORE_PATH.exists():
        data = json.loads(STORE_PATH.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data.setdefault("quizzes", {})
            return data
    return {"quizzes": {}}


def save_store(store: dict[str, Any]) -> None:
    temp_path = STORE_PATH.with_suffix(".tmp")
    temp_path.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(STORE_PATH)


def build_quiz_payload() -> dict[str, Any]:
    selected = random.sample(QUESTION_BANK, QUESTION_COUNT)
    questions = [parse_question(raw, index) for index, raw in enumerate(selected, 1)]
    quiz_id = uuid.uuid4().hex[:12]
    title = "iOSClub 有奖答题"
    return {
        "id": quiz_id,
        "title": title,
        "questions": questions,
        "created_at": now_iso(),
    }


def save_quiz(payload: dict[str, Any]) -> None:
    store = load_store()
    store.setdefault("quizzes", {})[payload["id"]] = payload
    save_store(store)


def get_quiz(quiz_id: str) -> dict[str, Any] | None:
    store = load_store()
    quizzes = store.get("quizzes", {})
    quiz = quizzes.get(quiz_id)
    return quiz if isinstance(quiz, dict) else None


def public_url_for(endpoint: str, **values: Any) -> str:
    path = url_for(endpoint, **values)
    if PUBLIC_BASE_URL:
        return f"{PUBLIC_BASE_URL}{path}"
    return url_for(endpoint, _external=True, **values)


def qr_png_bytes(url: str) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    image = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()


@app.get("/")
def index():
    return render_template("index.html", quiz=None, public_url=None)


@app.post("/create")
def create_quiz():
    payload = build_quiz_payload()
    save_quiz(payload)
    return redirect(url_for("manage_quiz", quiz_id=payload["id"]))


@app.get("/manage/<quiz_id>")
def manage_quiz(quiz_id: str):
    quiz = get_quiz(quiz_id)
    if quiz is None:
        abort(404)
    public_url = public_url_for("quiz_page", quiz_id=quiz_id)
    return render_template("index.html", quiz=quiz, public_url=public_url)


@app.get("/quiz/<quiz_id>")
def quiz_page(quiz_id: str):
    quiz = get_quiz(quiz_id)
    if quiz is None:
        abort(404)
    return render_template("quiz.html", quiz=quiz)


@app.get("/api/quiz/<quiz_id>")
def quiz_api(quiz_id: str):
    quiz = get_quiz(quiz_id)
    if quiz is None:
        abort(404)
    return jsonify(quiz)


@app.get("/qr/<quiz_id>.png")
def quiz_qr(quiz_id: str):
    quiz = get_quiz(quiz_id)
    if quiz is None:
        abort(404)
    public_url = public_url_for("quiz_page", quiz_id=quiz_id)
    return send_file(
        io.BytesIO(qr_png_bytes(public_url)),
        mimetype="image/png",
        as_attachment=False,
        download_name=f"{quiz_id}.png",
    )


@app.get("/export/<quiz_id>")
def export_quiz(quiz_id: str):
    quiz = get_quiz(quiz_id)
    if quiz is None:
        abort(404)
    return jsonify(quiz)


def main() -> None:
    port = int(os.environ.get("PORT", "5000"))
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    main()
