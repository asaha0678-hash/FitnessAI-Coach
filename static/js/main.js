/**
 * FitnessAI-Coach - Main Orchestrator & MediaPipe Pipeline
 * Connects camera stream, MediaPipe Pose, ExerciseTracker, and Canvas Visualizer.
 */

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const videoElement = document.getElementById("webcam");
    const canvasElement = document.getElementById("output_canvas");
    const canvasCtx = canvasElement.getContext("2d");

    // UI Badges & Telemetry
    const repCountEl = document.getElementById("rep_count");
    const stageBadgeEl = document.getElementById("stage_badge");
    const formFeedbackEl = document.getElementById("form_feedback");
    const detectedExerciseEl = document.getElementById("detected_exercise");
    const accuracyEl = document.getElementById("accuracy_val");
    const caloriesEl = document.getElementById("calories_val");
    const cadenceEl = document.getElementById("cadence_val");
    const timerEl = document.getElementById("timer_val");
    const angleFillEl = document.getElementById("angle_fill");
    const angleValEl = document.getElementById("angle_val");
    const exerciseSelect = document.getElementById("exercise_select");

    // Buttons
    const btnStart = document.getElementById("btn_start");
    const btnPause = document.getElementById("btn_pause");
    const btnReset = document.getElementById("btn_reset");
    const btnFinish = document.getElementById("btn_finish");
    const btnHistory = document.getElementById("btn_history");
    const btnSoundToggle = document.getElementById("btn_sound_toggle");

    // Modals
    const summaryModal = document.getElementById("summary_modal");
    const historyModal = document.getElementById("history_modal");
    const btnCloseSummary = document.getElementById("btn_close_summary");
    const btnCloseHistory = document.getElementById("btn_close_history");
    const btnClearHistory = document.getElementById("btn_clear_history");
    const historyTableBody = document.getElementById("history_table_body");

    // Summary Modal Fields
    const sumExercise = document.getElementById("sum_exercise");
    const sumReps = document.getElementById("sum_reps");
    const sumDuration = document.getElementById("sum_duration");
    const sumCalories = document.getElementById("sum_calories");
    const sumAccuracy = document.getElementById("sum_accuracy");

    // Engines
    const tracker = new ExerciseTracker();
    const audioCoach = new AudioCoach();
    const smoother = new LandmarkSmoother(0.6);

    // App State
    let isRunning = false;
    let cameraInstance = null;
    let poseInstance = null;
    let workoutStartTime = null;
    let elapsedSeconds = 0;
    let timerInterval = null;

    // Format seconds to mm:ss
    function formatTime(totalSec) {
        const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const secs = (totalSec % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    // Start workout timer
    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (isRunning) {
                elapsedSeconds += 1;
                timerEl.textContent = formatTime(elapsedSeconds);
                cadenceEl.textContent = tracker.getCadence();
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    // Initialize MediaPipe Pose
    function initPose() {
        poseInstance = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        poseInstance.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.55,
            minTrackingConfidence: 0.55
        });

        poseInstance.onResults(onPoseResults);
    }

    // Initialize Camera
    function initCamera() {
        cameraInstance = new Camera(videoElement, {
            onFrame: async () => {
                if (isRunning) {
                    await poseInstance.send({ image: videoElement });
                }
            },
            width: 1280,
            height: 720
        });
        cameraInstance.start().catch((err) => {
            console.error("Camera access error:", err);
            formFeedbackEl.textContent = "Camera access denied or unavailable";
        });
    }

    // Draw Skeleton and HUD Overlays
    function drawSkeleton(landmarks, isGoodForm) {
        canvasCtx.save();
        const primaryColor = isGoodForm ? "#10B981" : "#EF4444"; // Emerald Green or Crimson
        const jointColor = "#06B6D4"; // Cyan

        // Draw connections
        if (window.drawConnectors && window.POSE_CONNECTIONS) {
            drawConnectors(canvasCtx, landmarks, POSE_CONNECTIONS, {
                color: primaryColor,
                lineWidth: 4
            });
        }

        // Draw joint landmarks
        if (window.drawLandmarks) {
            drawLandmarks(canvasCtx, landmarks, {
                color: jointColor,
                fillColor: "#FFFFFF",
                lineWidth: 2,
                radius: 5
            });
        }

        // Draw active angle text overlay near tracked joint
        const activeExercise = tracker.currentExercise === 'auto' ? tracker.detectedExercise : tracker.currentExercise;
        const P = POSE_LANDMARKS;
        let focalJoint = landmarks[P.LEFT_ELBOW];

        if (activeExercise === 'squat') {
            focalJoint = landmarks[P.LEFT_KNEE] || landmarks[P.RIGHT_KNEE];
        } else if (activeExercise === 'shoulder_press') {
            focalJoint = landmarks[P.LEFT_SHOULDER] || landmarks[P.RIGHT_SHOULDER];
        } else if (activeExercise === 'plank') {
            focalJoint = landmarks[P.LEFT_HIP] || landmarks[P.RIGHT_HIP];
        }

        if (focalJoint && focalJoint.visibility > 0.5) {
            const px = focalJoint.x * canvasElement.width;
            const py = focalJoint.y * canvasElement.height;

            canvasCtx.fillStyle = "rgba(17, 24, 39, 0.85)";
            canvasCtx.beginPath();
            canvasCtx.roundRect(px + 12, py - 20, 85, 34, 8);
            canvasCtx.fill();
            canvasCtx.strokeStyle = primaryColor;
            canvasCtx.lineWidth = 1.5;
            canvasCtx.stroke();

            canvasCtx.fillStyle = "#FFFFFF";
            canvasCtx.font = "bold 16px 'Segoe UI', system-ui, sans-serif";
            canvasCtx.fillText(`${Math.round(tracker.currentAngle)}°`, px + 24, py + 3);
        }

        canvasCtx.restore();
    }

    // Callback on Pose Results
    function onPoseResults(results) {
        // Adjust canvas dimensions to match video stream
        if (canvasElement.width !== videoElement.videoWidth && videoElement.videoWidth > 0) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
        }

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Draw webcam feed
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        if (results.poseLandmarks) {
            // Apply smoothing filter
            const smoothedLandmarks = smoother.smooth(results.poseLandmarks);

            // Process through Exercise Tracker
            tracker.processFrame(smoothedLandmarks, audioCoach);

            // Draw visual cues
            drawSkeleton(smoothedLandmarks, tracker.isGoodForm);
        } else {
            tracker.formFeedback = "Step back into camera view";
            tracker.isGoodForm = false;
        }

        canvasCtx.restore();
        updateUI();
    }

    // Update UI Elements
    function updateUI() {
        repCountEl.textContent = tracker.reps;
        formFeedbackEl.textContent = tracker.formFeedback;

        // Stage Badge
        stageBadgeEl.textContent = tracker.stage.toUpperCase();
        stageBadgeEl.className = "badge " + (
            tracker.stage === 'up' ? 'badge-up' :
            tracker.stage === 'down' ? 'badge-down' :
            tracker.stage === 'hold' ? 'badge-hold' : 'badge-idle'
        );

        // Detected Exercise Name
        const activeEx = tracker.currentExercise === 'auto' ? tracker.detectedExercise : tracker.currentExercise;
        const nameMap = {
            'bicep_curl': 'Bicep Curls',
            'squat': 'Squats',
            'pushup': 'Push-ups',
            'shoulder_press': 'Overhead Press',
            'jumping_jack': 'Jumping Jacks',
            'plank': 'Plank Hold'
        };
        detectedExerciseEl.textContent = (tracker.currentExercise === 'auto' ? "⚡ Auto: " : "") + (nameMap[activeEx] || activeEx);

        // Form feedback alert styling
        if (tracker.isGoodForm) {
            formFeedbackEl.classList.remove("feedback-warning");
            formFeedbackEl.classList.add("feedback-good");
        } else {
            formFeedbackEl.classList.remove("feedback-good");
            formFeedbackEl.classList.add("feedback-warning");
        }

        // Metrics
        accuracyEl.textContent = `${tracker.getAccuracy()}%`;
        caloriesEl.textContent = tracker.calories.toFixed(1);
        angleValEl.textContent = `${Math.round(tracker.currentAngle)}°`;

        // Angle Progress Bar Fill (Range 0 - 180)
        const anglePercent = Math.min(100, Math.max(0, (tracker.currentAngle / 180) * 100));
        angleFillEl.style.width = `${anglePercent}%`;
    }

    // Save Workout Session to API
    async function saveSessionToBackend() {
        const activeEx = tracker.currentExercise === 'auto' ? tracker.detectedExercise : tracker.currentExercise;
        const payload = {
            exercise: activeEx,
            reps: tracker.reps,
            duration_seconds: elapsedSeconds,
            calories: parseFloat(tracker.calories.toFixed(2)),
            accuracy: tracker.getAccuracy(),
            form_notes: tracker.isGoodForm ? "Good posture maintained" : "Needed form corrections"
        };

        try {
            const resp = await fetch("/api/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const result = await resp.json();
            console.log("Saved workout session:", result);
        } catch (err) {
            console.warn("Could not save to backend API (running standalone mode?):", err);
            // Save to localStorage fallback
            const localSessions = JSON.parse(localStorage.getItem("fitness_ai_sessions") || "[]");
            payload.created_at = new Date().toISOString();
            localSessions.unshift(payload);
            localStorage.setItem("fitness_ai_sessions", JSON.stringify(localSessions));
        }
    }

    // Load History
    async function loadWorkoutHistory() {
        historyTableBody.innerHTML = `<tr><td colspan="6" class="text-center">Loading workout logs...</td></tr>`;
        try {
            const resp = await fetch("/api/sessions");
            const data = await resp.json();
            renderHistoryRows(data.sessions || []);
        } catch (err) {
            // Fallback to localStorage
            const localSessions = JSON.parse(localStorage.getItem("fitness_ai_sessions") || "[]");
            renderHistoryRows(localSessions);
        }
    }

    function renderHistoryRows(sessions) {
        if (!sessions || sessions.length === 0) {
            historyTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No past workouts logged yet. Complete a workout to see stats here!</td></tr>`;
            return;
        }

        historyTableBody.innerHTML = sessions.map(s => {
            const dateStr = s.created_at ? new Date(s.created_at).toLocaleString() : "Just now";
            const mins = Math.floor(s.duration_seconds / 60);
            const secs = s.duration_seconds % 60;
            const durStr = `${mins}m ${secs}s`;
            return `
                <tr>
                    <td>${dateStr}</td>
                    <td><strong class="text-accent">${s.exercise.replace('_', ' ').toUpperCase()}</strong></td>
                    <td>${s.reps}</td>
                    <td>${durStr}</td>
                    <td>${s.calories} kcal</td>
                    <td><span class="badge ${s.accuracy >= 80 ? 'badge-up' : 'badge-down'}">${s.accuracy}%</span></td>
                </tr>
            `;
        }).join("");
    }

    // EVENT LISTENERS
    btnStart.addEventListener("click", () => {
        isRunning = true;
        btnStart.classList.add("hidden");
        btnPause.classList.remove("hidden");
        startTimer();
        audioCoach.speak("Workout started. Let's do this!");
    });

    btnPause.addEventListener("click", () => {
        isRunning = false;
        btnPause.classList.add("hidden");
        btnStart.classList.remove("hidden");
        audioCoach.speak("Workout paused");
    });

    btnReset.addEventListener("click", () => {
        tracker.reset();
        smoother.reset();
        elapsedSeconds = 0;
        timerEl.textContent = "00:00";
        cadenceEl.textContent = "0";
        updateUI();
        audioCoach.speak("Workout reset");
    });

    btnFinish.addEventListener("click", () => {
        isRunning = false;
        btnPause.classList.add("hidden");
        btnStart.classList.remove("hidden");
        stopTimer();

        // Populate Summary Modal
        const activeEx = tracker.currentExercise === 'auto' ? tracker.detectedExercise : tracker.currentExercise;
        sumExercise.textContent = activeEx.replace('_', ' ').toUpperCase();
        sumReps.textContent = tracker.reps;
        sumDuration.textContent = formatTime(elapsedSeconds);
        sumCalories.textContent = `${tracker.calories.toFixed(1)} kcal`;
        sumAccuracy.textContent = `${tracker.getAccuracy()}%`;

        audioCoach.playMilestoneFanfare();
        audioCoach.speak(`Great workout! You completed ${tracker.reps} repetitions.`);

        saveSessionToBackend();
        summaryModal.classList.remove("hidden");
    });

    btnCloseSummary.addEventListener("click", () => {
        summaryModal.classList.add("hidden");
        tracker.reset();
        elapsedSeconds = 0;
        timerEl.textContent = "00:00";
        updateUI();
    });

    btnHistory.addEventListener("click", () => {
        loadWorkoutHistory();
        historyModal.classList.remove("hidden");
    });

    btnCloseHistory.addEventListener("click", () => {
        historyModal.classList.add("hidden");
    });

    btnClearHistory.addEventListener("click", async () => {
        if (confirm("Are you sure you want to clear all workout history?")) {
            try {
                await fetch("/api/sessions", { method: "DELETE" });
            } catch (e) {}
            localStorage.removeItem("fitness_ai_sessions");
            loadWorkoutHistory();
        }
    });

    exerciseSelect.addEventListener("change", (e) => {
        tracker.setExercise(e.target.value);
        smoother.reset();
        updateUI();
        audioCoach.speak(`Exercise set to ${e.target.options[e.target.selectedIndex].text}`);
    });

    btnSoundToggle.addEventListener("click", () => {
        const isMuted = btnSoundToggle.dataset.muted === "true";
        const newMuted = !isMuted;
        btnSoundToggle.dataset.muted = newMuted ? "true" : "false";
        audioCoach.setMuted(newMuted);
        btnSoundToggle.innerHTML = newMuted ? "🔇 Unmute Coach" : "🔊 Mute Coach";
    });

    // Initialize systems
    initPose();
    initCamera();
});
