#!/usr/bin/env python3
"""
FitnessAI-Coach - Flask Backend (Alternative Server)
Provided for standard Flask deployments.
"""

import os
import sqlite3
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DB_PATH = os.path.join(BASE_DIR, "workout_sessions.db")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")
CORS(app)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exercise TEXT NOT NULL,
            reps INTEGER DEFAULT 0,
            duration_seconds INTEGER DEFAULT 0,
            calories REAL DEFAULT 0.0,
            accuracy REAL DEFAULT 100.0,
            form_notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

from server import EXERCISES_DATA

@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "app": "FitnessAI-Coach",
        "author": "asaha0678-hash",
        "server": "Flask",
        "time": datetime.utcnow().isoformat()
    })

@app.route("/api/exercises", methods=["GET"])
def get_exercises():
    return jsonify({"status": "success", "exercises": EXERCISES_DATA})

@app.route("/api/sessions", methods=["GET"])
def get_sessions():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, exercise, reps, duration_seconds, calories, accuracy, form_notes, created_at
        FROM sessions
        ORDER BY created_at DESC
        LIMIT 50
    """)
    rows = cursor.fetchall()
    sessions = [dict(row) for row in rows]
    conn.close()
    return jsonify({"status": "success", "sessions": sessions})

@app.route("/api/sessions", methods=["POST"])
def save_session():
    data = request.get_json(force=True)
    exercise = data.get("exercise", "Unknown")
    reps = int(data.get("reps", 0))
    duration_seconds = int(data.get("duration_seconds", 0))
    calories = float(data.get("calories", 0.0))
    accuracy = float(data.get("accuracy", 100.0))
    form_notes = str(data.get("form_notes", ""))

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO sessions (exercise, reps, duration_seconds, calories, accuracy, form_notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (exercise, reps, duration_seconds, calories, accuracy, form_notes))
    conn.commit()
    inserted_id = cursor.lastrowid
    conn.close()

    return jsonify({"status": "success", "session_id": inserted_id}), 201

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Flask server on http://localhost:{port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
