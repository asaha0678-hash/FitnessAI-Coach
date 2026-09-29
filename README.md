# 🏋️‍♂️ FitnessAI-Coach
### Personal AI Trainer With Automatic Exercise Recognition and Counting

An AI-powered computer vision application that leverages **Pose Estimation** and **Machine Learning** to automatically recognize workout exercises, track repetitions in real-time, validate biomechanical form, and provide spoken audio coaching through a modern web interface.

[![GitHub Repo](https://img.shields.io/badge/GitHub-asaha0678--hash%2FFitnessAI--Coach-10B981?style=for-the-badge&logo=github)](https://github.com/asaha0678-hash/FitnessAI-Coach)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Python-06B6D4?style=for-the-badge)](https://github.com/asaha0678-hash/FitnessAI-Coach)
[![Zero-Dependency](https://img.shields.io/badge/Setup-Zero%20pip%20Install-F59E0B?style=for-the-badge)](#quickstart)

---

## ✨ Key Features

- ⚡ **Automatic Exercise Recognition**: Intelligently classifies exercises (Bicep Curls, Squats, Push-ups, Overhead Press, Jumping Jacks, and Plank) based on 33-point skeletal geometry.
- 🎯 **Accurate Repetition Counter**: Implements hysteresis threshold state machines (`IDLE` ➔ `CONCENTRIC` ➔ `PEAK` ➔ `ECCENTRIC`) to eliminate false triggers and tremor artifacts.
- 📐 **Vector Joint Trigonometry**: Computes real-time 2D/3D joint angles with an Exponential Moving Average (EMA) smoothing filter.
- 🗣️ **Real-Time Voice Coaching**: Announces repetitions and provides instant corrective speech cues (e.g., *"Keep your back straight"*, *"Go deeper"*, *"Full extension"*).
- 📊 **Live Telemetry & Metrics**:
  - Repetition counter & active stage badge
  - Joint angle progress gauge
  - Real-time Cadence (Reps per Minute)
  - Biomechanical Form Accuracy (%)
  - Calorie Expenditure Estimator (MET-based)
  - Active Workout Stopwatch
- 💾 **Workout History & Session Persistence**: Local SQLite database and fallback browser storage logging workout duration, reps, calories, and posture scores.
- 🚀 **Zero External Dependencies**: Runs out of the box using Python's built-in standard library (`http.server` + `sqlite3`), with optional Flask support.

---

## 🏃 Supported Exercises

| Exercise | Target Keypoints | Joint Angle Range | Form Checks |
| :--- | :--- | :--- | :--- |
| **Bicep Curls** | Shoulder ➔ Elbow ➔ Wrist | $45^\circ \leftrightarrow 150^\circ$ | Elbow drift, momentum swing penalty |
| **Squats** | Hip ➔ Knee ➔ Ankle | $90^\circ \leftrightarrow 160^\circ$ | Parallel depth, upright torso lean |
| **Push-ups** | Shoulder ➔ Elbow ➔ Wrist | $85^\circ \leftrightarrow 155^\circ$ | Plank alignment, hip sagging check |
| **Overhead Press** | Elbow ➔ Shoulder ➔ Hip | $75^\circ \leftrightarrow 165^\circ$ | Full overhead lockout, arm symmetry |
| **Jumping Jacks** | Shoulder & Ankles | Spread ratio $> 1.3$ | Arm-foot synchronization |
| **Plank (Hold)** | Shoulder ➔ Hip ➔ Ankle | $160^\circ - 180^\circ$ | Straight spine hold duration counter |

---

## 🚀 Quickstart

### 1. Clone the Repository
```bash
git clone https://github.com/asaha0678-hash/FitnessAI-Coach.git
cd FitnessAI-Coach
```

### 2. Launch the Application (Zero Dependencies Required)
No `pip install` required! Simply execute:
```bash
python server.py
```
Open **[http://localhost:8000](http://localhost:8000)** in any modern web browser (Chrome, Edge, Firefox, Safari).

### 3. Alternative (Flask Server)
If you prefer running with Flask:
```bash
pip install -r requirements.txt
python app.py
```

---

## 📁 Project Architecture

```
FitnessAI-Coach/
│
├── server.py              # Zero-dependency Python HTTP & REST API server
├── app.py                 # Alternative Flask backend server
├── requirements.txt       # Optional Flask dependencies
├── README.md              # Project documentation
│
└── static/                # Web application assets
    ├── index.html         # Responsive fitness dashboard UI
    ├── css/
    │   └── style.css      # Dark-mode gym aesthetic styling
    └── js/
        ├── pose_math.js   # 33-point vector trigonometry & EMA smoothing
        ├── audio_coach.js # Web Speech API & Web Audio synthesizer
        ├── exercise_tracker.js # State machines, auto-detection classifier
        └── main.js        # MediaPipe camera pipeline & UI orchestrator
```

---

## 🛠️ Technology Stack

- **Computer Vision & Pose Estimation**: Google MediaPipe Pose (33 3D Landmarks)
- **Frontend**: HTML5 Canvas, Vanilla ES6+ JavaScript, CSS3 Grid/Flexbox
- **Audio Synthesis**: Web Speech API & Web Audio API
- **Backend**: Python 3 standard library (`http.server`, `sqlite3`, `json`) / Flask
- **Persistence**: SQLite3

---

## 👤 Author
Developed for **[asaha0678-hash](https://github.com/asaha0678-hash)**  
Repository: [https://github.com/asaha0678-hash/FitnessAI-Coach](https://github.com/asaha0678-hash/FitnessAI-Coach)
