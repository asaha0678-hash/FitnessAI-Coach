#!/usr/bin/env python3
"""
FitnessAI-Coach - Zero-Dependency Backend Server
Runs using pure Python standard library (http.server + sqlite3).
Supports serving the web application and REST APIs for workout tracking.
"""

import os
import sys
import json
import sqlite3
import mimetypes
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", 8000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DB_PATH = os.path.join(BASE_DIR, "workout_sessions.db")

# Ensure proper MIME types for JavaScript and CSS
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("text/html", ".html")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("image/svg+xml", ".svg")

# Database initialization
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

EXERCISES_DATA = [
    {
        "id": "bicep_curl",
        "name": "Bicep Curls",
        "category": "Arms",
        "target_joints": ["Shoulder", "Elbow", "Wrist"],
        "down_angle": 150,
        "up_angle": 45,
        "calories_per_rep": 0.32,
        "description": "Keep elbows close to your torso. Curl weights up fully, then slowly lower back down.",
        "tips": ["Avoid swinging your back", "Full arm extension at bottom", "Squeeze bicep at peak"]
    },
    {
        "id": "squat",
        "name": "Squats",
        "category": "Legs & Core",
        "target_joints": ["Hip", "Knee", "Ankle"],
        "down_angle": 90,
        "up_angle": 160,
        "calories_per_rep": 0.45,
        "description": "Feet shoulder-width apart. Lower hips down until thighs are parallel to ground.",
        "tips": ["Keep chest upright", "Knees track over toes", "Do not let knees cave inward"]
    },
    {
        "id": "pushup",
        "name": "Push-ups",
        "category": "Chest & Arms",
        "target_joints": ["Shoulder", "Elbow", "Wrist", "Hip"],
        "down_angle": 85,
        "up_angle": 155,
        "calories_per_rep": 0.38,
        "description": "Plank posture with hands slightly wider than shoulders. Lower chest to floor.",
        "tips": ["Maintain flat back (plank)", "Do not sag or pike hips", "Elbows at 45 degree angle"]
    },
    {
        "id": "shoulder_press",
        "name": "Overhead Press",
        "category": "Shoulders",
        "target_joints": ["Elbow", "Shoulder", "Hip"],
        "down_angle": 75,
        "up_angle": 165,
        "calories_per_rep": 0.35,
        "description": "Start at shoulder level, press vertically overhead to full lockout without arching back.",
        "tips": ["Lock out overhead", "Engage core", "Avoid excessive lower back arch"]
    },
    {
        "id": "jumping_jack",
        "name": "Jumping Jacks",
        "category": "Cardio",
        "target_joints": ["Shoulder", "Hip", "Ankle"],
        "down_angle": 30,
        "up_angle": 140,
        "calories_per_rep": 0.20,
        "description": "Jump spreading legs wide while bringing hands together overhead, then return.",
        "tips": ["Land softly on balls of feet", "Keep arms straight", "Maintain continuous rhythm"]
    },
    {
        "id": "plank",
        "name": "Plank (Hold)",
        "category": "Core Stability",
        "target_joints": ["Shoulder", "Hip", "Ankle"],
        "target_angle": 175,
        "calories_per_second": 0.08,
        "description": "Maintain straight alignment from shoulders through hips and ankles.",
        "tips": ["Engage abs and glutes", "Don't let hips sag", "Keep neck in neutral position"]
    }
]

class FitnessRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def send_json(self, data, status_code=200):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Root route serves index.html
        if path == "/" or path == "/index.html":
            index_path = os.path.join(STATIC_DIR, "index.html")
            if os.path.exists(index_path):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                with open(index_path, "rb") as f:
                    content = f.read()
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        # API: Get supported exercises
        if path == "/api/exercises":
            self.send_json({"status": "success", "exercises": EXERCISES_DATA})
            return

        # API: Get saved workout sessions
        if path == "/api/sessions":
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
            self.send_json({"status": "success", "sessions": sessions})
            return

        # API: System health check
        if path == "/api/health":
            self.send_json({
                "status": "healthy",
                "app": "FitnessAI-Coach",
                "author": "asaha0678-hash",
                "time": datetime.utcnow().isoformat()
            })
            return

        # Fallback to standard static file serving
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/sessions":
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                post_body = self.rfile.read(content_len)
                payload = json.loads(post_body.decode("utf-8"))

                exercise = payload.get("exercise", "Unknown")
                reps = int(payload.get("reps", 0))
                duration_seconds = int(payload.get("duration_seconds", 0))
                calories = float(payload.get("calories", 0.0))
                accuracy = float(payload.get("accuracy", 100.0))
                form_notes = str(payload.get("form_notes", ""))

                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO sessions (exercise, reps, duration_seconds, calories, accuracy, form_notes)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (exercise, reps, duration_seconds, calories, accuracy, form_notes))
                conn.commit()
                inserted_id = cursor.lastrowid
                conn.close()

                self.send_json({
                    "status": "success",
                    "message": "Workout session recorded",
                    "session_id": inserted_id
                }, status_code=201)
            except Exception as e:
                self.send_json({"status": "error", "message": str(e)}, status_code=400)
            return

        self.send_json({"status": "error", "message": "Not Found"}, status_code=404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/sessions":
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions")
            conn.commit()
            conn.close()
            self.send_json({"status": "success", "message": "All workout sessions cleared"})
            return
        self.send_json({"status": "error", "message": "Not Found"}, status_code=404)

def run():
    init_db()
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, FitnessRequestHandler)
    print("=" * 65)
    print(f" FitnessAI-Coach Server Running at http://localhost:{PORT}")
    print(" GitHub: https://github.com/asaha0678-hash/FitnessAI-Coach")
    print(" Zero external dependencies required (Pure Python standard library)")
    print(" Press Ctrl+C to stop the server")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping FitnessAI-Coach server...")
        httpd.server_close()
        sys.exit(0)

if __name__ == "__main__":
    run()
