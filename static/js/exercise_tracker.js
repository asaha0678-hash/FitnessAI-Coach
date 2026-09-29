/**
 * FitnessAI-Coach - Exercise Recognition & Rep Counter Engine
 * Features state machines with hysteresis, automatic exercise classification,
 * form correctness evaluation, and calorie expenditure tracking.
 */

class ExerciseTracker {
    constructor() {
        this.currentExercise = 'auto'; // 'auto' or specific exercise id
        this.detectedExercise = 'bicep_curl';
        this.confidence = 0;
        this.reps = 0;
        this.stage = 'idle'; // 'up', 'down', 'idle', 'hold'
        this.currentAngle = 0;
        this.secondaryAngle = 0;
        this.targetAngleMin = 45;
        this.targetAngleMax = 150;
        this.formFeedback = "Get in frame to start";
        this.isGoodForm = true;
        this.goodReps = 0;
        this.totalAttempts = 0;
        this.calories = 0;
        this.plankStartTime = null;
        this.plankHoldSeconds = 0;

        // Auto-recognition buffer for temporal smoothing
        this.classificationHistory = [];
        this.historyWindow = 12;

        // Rep timing to calculate cadence (reps/min)
        this.repTimestamps = [];
    }

    reset() {
        this.reps = 0;
        this.stage = 'idle';
        this.goodReps = 0;
        this.totalAttempts = 0;
        this.calories = 0;
        this.formFeedback = "Ready";
        this.isGoodForm = true;
        this.plankStartTime = null;
        this.plankHoldSeconds = 0;
        this.repTimestamps = [];
    }

    setExercise(exerciseId) {
        this.currentExercise = exerciseId;
        this.reset();
        if (exerciseId !== 'auto') {
            this.detectedExercise = exerciseId;
        }
    }

    /**
     * Automatic Exercise Recognition Classifier
     * Evaluates landmark relationships to infer current exercise.
     */
    classifyExercise(landmarks) {
        if (!landmarks || landmarks.length < 33) return 'bicep_curl';

        const lm = landmarks;
        const P = POSE_LANDMARKS;

        // Key landmarks
        const leftShoulder = lm[P.LEFT_SHOULDER];
        const rightShoulder = lm[P.RIGHT_SHOULDER];
        const leftElbow = lm[P.LEFT_ELBOW];
        const rightElbow = lm[P.RIGHT_ELBOW];
        const leftWrist = lm[P.LEFT_WRIST];
        const rightWrist = lm[P.RIGHT_WRIST];
        const leftHip = lm[P.LEFT_HIP];
        const rightHip = lm[P.RIGHT_HIP];
        const leftKnee = lm[P.LEFT_KNEE];
        const rightKnee = lm[P.RIGHT_KNEE];
        const leftAnkle = lm[P.LEFT_ANKLE];
        const rightAnkle = lm[P.RIGHT_ANKLE];

        // Average heights (Y coordinates in screen space, 0 is top, 1 is bottom)
        const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const hipY = (leftHip.y + rightHip.y) / 2;
        const kneeY = (leftKnee.y + rightKnee.y) / 2;
        const ankleY = (leftAnkle.y + rightAnkle.y) / 2;
        const wristY = (leftWrist.y + rightWrist.y) / 2;

        // Check posture horizontal orientation (Push-up / Plank)
        // If the torso is roughly horizontal: difference between shoulder Y and hip Y is small
        const torsoDy = Math.abs(shoulderY - hipY);
        const torsoDx = Math.abs((leftShoulder.x + rightShoulder.x) / 2 - (leftHip.x + rightHip.x) / 2);
        const isHorizontal = torsoDx > torsoDy * 1.1 && hipY > 0.4;

        if (isHorizontal) {
            // Distinguish Push-up vs Plank
            const elbowAngle = (PoseMath.calculateAngle2D(leftShoulder, leftElbow, leftWrist) +
                                PoseMath.calculateAngle2D(rightShoulder, rightElbow, rightWrist)) / 2;
            if (elbowAngle < 125) {
                return 'pushup';
            }
            return 'plank';
        }

        // Standing Postures
        // 1. Hands above head (Shoulder Press or Jumping Jacks)
        const handsAboveShoulders = wristY < shoulderY;
        const feetDistance = Math.abs(leftAnkle.x - rightAnkle.x);
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

        if (handsAboveShoulders) {
            if (feetDistance > shoulderWidth * 1.5) {
                return 'jumping_jack';
            }
            return 'shoulder_press';
        }

        // 2. Squats: Knee angle is flexing significantly
        const leftKneeAngle = PoseMath.calculateAngle2D(leftHip, leftKnee, leftAnkle);
        const rightKneeAngle = PoseMath.calculateAngle2D(rightHip, rightKnee, rightAnkle);
        const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

        if (avgKneeAngle < 135 && Math.abs(shoulderY - hipY) > 0.18) {
            return 'squat';
        }

        // 3. Default standing arm flexion: Bicep Curl
        return 'bicep_curl';
    }

    /**
     * Update smoothed exercise classification
     */
    updateClassification(landmarks) {
        const rawClass = this.classifyExercise(landmarks);
        this.classificationHistory.push(rawClass);
        if (this.classificationHistory.length > this.historyWindow) {
            this.classificationHistory.shift();
        }

        // Count votes
        const counts = {};
        for (const c of this.classificationHistory) {
            counts[c] = (counts[c] || 0) + 1;
        }

        let bestClass = rawClass;
        let maxVotes = 0;
        for (const [c, count] of Object.entries(counts)) {
            if (count > maxVotes) {
                maxVotes = count;
                bestClass = c;
            }
        }

        this.confidence = Math.round((maxVotes / this.classificationHistory.length) * 100);
        this.detectedExercise = bestClass;
    }

    /**
     * Primary processing step per frame
     * @param {Array} landmarks MediaPipe 33-landmark array
     * @param {AudioCoach} audioCoach Instance of AudioCoach
     */
    processFrame(landmarks, audioCoach) {
        if (!landmarks || landmarks.length < 33) {
            this.formFeedback = "Full body not in view";
            this.isGoodForm = false;
            return;
        }

        // If Auto Mode, continuously classify
        if (this.currentExercise === 'auto') {
            this.updateClassification(landmarks);
        }

        const activeExercise = this.currentExercise === 'auto' ? this.detectedExercise : this.currentExercise;

        switch (activeExercise) {
            case 'bicep_curl':
                this.trackBicepCurl(landmarks, audioCoach);
                break;
            case 'squat':
                this.trackSquat(landmarks, audioCoach);
                break;
            case 'pushup':
                this.trackPushup(landmarks, audioCoach);
                break;
            case 'shoulder_press':
                this.trackShoulderPress(landmarks, audioCoach);
                break;
            case 'jumping_jack':
                this.trackJumpingJack(landmarks, audioCoach);
                break;
            case 'plank':
                this.trackPlank(landmarks, audioCoach);
                break;
            default:
                this.trackBicepCurl(landmarks, audioCoach);
        }
    }

    /**
     * BICEP CURL TRACKING
     */
    trackBicepCurl(landmarks, audioCoach) {
        const P = POSE_LANDMARKS;
        const side = PoseMath.getDominantSide(landmarks);

        let shoulder, elbow, wrist;
        if (side === 'right') {
            shoulder = landmarks[P.RIGHT_SHOULDER];
            elbow = landmarks[P.RIGHT_ELBOW];
            wrist = landmarks[P.RIGHT_WRIST];
        } else {
            shoulder = landmarks[P.LEFT_SHOULDER];
            elbow = landmarks[P.LEFT_ELBOW];
            wrist = landmarks[P.LEFT_WRIST];
        }

        const elbowAngle = PoseMath.calculateAngle2D(shoulder, elbow, wrist);
        this.currentAngle = elbowAngle;
        this.targetAngleMin = 40;
        this.targetAngleMax = 155;

        // Form check: Elbow drift / swinging
        const hip = side === 'right' ? landmarks[P.RIGHT_HIP] : landmarks[P.LEFT_HIP];
        const shoulderElbowHipAngle = PoseMath.calculateAngle2D(shoulder, elbow, hip);
        const isSwinging = shoulderElbowHipAngle > 35;

        // State Machine with Hysteresis
        if (elbowAngle > 150) {
            if (this.stage === 'up') {
                // Completed Rep!
                this.reps += 1;
                this.totalAttempts += 1;
                this.stage = 'down';
                this.calories += 0.32;
                this.recordRepTiming();

                if (isSwinging) {
                    this.formFeedback = "Watch elbow swing! Keep elbows still.";
                    this.isGoodForm = false;
                    audioCoach.playFormWarningTone();
                    audioCoach.speak("Keep elbows close to your torso");
                } else {
                    this.goodReps += 1;
                    this.formFeedback = "Great curl! Full extension.";
                    this.isGoodForm = true;
                    audioCoach.playRepTone();
                    audioCoach.speak(`${this.reps}`);
                }
            } else {
                this.stage = 'down';
                this.formFeedback = "Curl up to chest";
            }
        } else if (elbowAngle < 45) {
            if (this.stage === 'down' || this.stage === 'idle') {
                this.stage = 'up';
                this.formFeedback = "Squeeze at peak! Now lower down slowly.";
            }
        } else {
            if (this.stage === 'down') {
                this.formFeedback = "Curling up...";
            } else if (this.stage === 'up') {
                this.formFeedback = "Lowering down with control...";
            }
        }
    }

    /**
     * SQUAT TRACKING
     */
    trackSquat(landmarks, audioCoach) {
        const P = POSE_LANDMARKS;
        const side = PoseMath.getDominantSide(landmarks);

        let hip, knee, ankle, shoulder;
        if (side === 'right') {
            hip = landmarks[P.RIGHT_HIP];
            knee = landmarks[P.RIGHT_KNEE];
            ankle = landmarks[P.RIGHT_ANKLE];
            shoulder = landmarks[P.RIGHT_SHOULDER];
        } else {
            hip = landmarks[P.LEFT_HIP];
            knee = landmarks[P.LEFT_KNEE];
            ankle = landmarks[P.LEFT_ANKLE];
            shoulder = landmarks[P.LEFT_SHOULDER];
        }

        const kneeAngle = PoseMath.calculateAngle2D(hip, knee, ankle);
        this.currentAngle = kneeAngle;
        this.targetAngleMin = 90;
        this.targetAngleMax = 165;

        // Form check: Back angle / torso lean
        const torsoInclination = PoseMath.calculateVerticalInclination(shoulder, hip);
        const excessiveLean = torsoInclination > 42;

        // State Machine
        if (kneeAngle > 160) {
            if (this.stage === 'down') {
                // Completed Rep!
                this.reps += 1;
                this.totalAttempts += 1;
                this.stage = 'up';
                this.calories += 0.45;
                this.recordRepTiming();

                if (excessiveLean) {
                    this.formFeedback = "Keep your chest high and back upright!";
                    this.isGoodForm = false;
                    audioCoach.playFormWarningTone();
                    audioCoach.speak("Keep your chest up");
                } else {
                    this.goodReps += 1;
                    this.formFeedback = "Solid squat! Full depth achieved.";
                    this.isGoodForm = true;
                    audioCoach.playRepTone();
                    audioCoach.speak(`${this.reps}`);
                }
            } else {
                this.stage = 'up';
                this.formFeedback = "Lower hips down into squat";
            }
        } else if (kneeAngle < 95) {
            if (this.stage === 'up' || this.stage === 'idle') {
                this.stage = 'down';
                this.formFeedback = "Good depth! Drive through heels up.";
            }
        } else {
            if (kneeAngle < 130 && this.stage === 'up') {
                this.formFeedback = "Go lower until thighs are parallel";
            }
        }
    }

    /**
     * PUSH-UP TRACKING
     */
    trackPushup(landmarks, audioCoach) {
        const P = POSE_LANDMARKS;
        const side = PoseMath.getDominantSide(landmarks);

        let shoulder, elbow, wrist, hip, ankle;
        if (side === 'right') {
            shoulder = landmarks[P.RIGHT_SHOULDER];
            elbow = landmarks[P.RIGHT_ELBOW];
            wrist = landmarks[P.RIGHT_WRIST];
            hip = landmarks[P.RIGHT_HIP];
            ankle = landmarks[P.RIGHT_ANKLE];
        } else {
            shoulder = landmarks[P.LEFT_SHOULDER];
            elbow = landmarks[P.LEFT_ELBOW];
            wrist = landmarks[P.LEFT_WRIST];
            hip = landmarks[P.LEFT_HIP];
            ankle = landmarks[P.LEFT_ANKLE];
        }

        const elbowAngle = PoseMath.calculateAngle2D(shoulder, elbow, wrist);
        const bodyAlignmentAngle = PoseMath.calculateAngle2D(shoulder, hip, ankle);
        this.currentAngle = elbowAngle;
        this.secondaryAngle = bodyAlignmentAngle;
        this.targetAngleMin = 80;
        this.targetAngleMax = 155;

        // Form check: Straight back plank
        const hipsSagging = bodyAlignmentAngle < 155 || bodyAlignmentAngle > 195;

        // State Machine
        if (elbowAngle > 155) {
            if (this.stage === 'down') {
                this.reps += 1;
                this.totalAttempts += 1;
                this.stage = 'up';
                this.calories += 0.38;
                this.recordRepTiming();

                if (hipsSagging) {
                    this.formFeedback = "Straighten your body! Avoid sagging hips.";
                    this.isGoodForm = false;
                    audioCoach.playFormWarningTone();
                    audioCoach.speak("Keep your core tight");
                } else {
                    this.goodReps += 1;
                    this.formFeedback = "Excellent push-up!";
                    this.isGoodForm = true;
                    audioCoach.playRepTone();
                    audioCoach.speak(`${this.reps}`);
                }
            } else {
                this.stage = 'up';
                this.formFeedback = "Lower chest to ground";
            }
        } else if (elbowAngle < 85) {
            if (this.stage === 'up' || this.stage === 'idle') {
                this.stage = 'down';
                this.formFeedback = "Chest low! Push back up.";
            }
        }
    }

    /**
     * OVERHEAD SHOULDER PRESS TRACKING
     */
    trackShoulderPress(landmarks, audioCoach) {
        const P = POSE_LANDMARKS;
        const leftShoulder = landmarks[P.LEFT_SHOULDER];
        const leftElbow = landmarks[P.LEFT_ELBOW];
        const leftWrist = landmarks[P.LEFT_WRIST];
        const rightShoulder = landmarks[P.RIGHT_SHOULDER];
        const rightElbow = landmarks[P.RIGHT_ELBOW];
        const rightWrist = landmarks[P.RIGHT_WRIST];

        const leftArmAngle = PoseMath.calculateAngle2D(leftShoulder, leftElbow, leftWrist);
        const rightArmAngle = PoseMath.calculateAngle2D(rightShoulder, rightElbow, rightWrist);
        const avgArmAngle = (leftArmAngle + rightArmAngle) / 2;

        this.currentAngle = avgArmAngle;
        this.targetAngleMin = 75;
        this.targetAngleMax = 165;

        // Form check: Symmetry between both arms
        const asymmetry = Math.abs(leftArmAngle - rightArmAngle);
        const isSymmetric = asymmetry < 25;

        if (avgArmAngle > 160) {
            if (this.stage === 'down') {
                this.reps += 1;
                this.totalAttempts += 1;
                this.stage = 'up';
                this.calories += 0.35;
                this.recordRepTiming();

                if (!isSymmetric) {
                    this.formFeedback = "Press evenly with both arms!";
                    this.isGoodForm = false;
                    audioCoach.playFormWarningTone();
                    audioCoach.speak("Balance your press");
                } else {
                    this.goodReps += 1;
                    this.formFeedback = "Full overhead lockout!";
                    this.isGoodForm = true;
                    audioCoach.playRepTone();
                    audioCoach.speak(`${this.reps}`);
                }
            } else {
                this.stage = 'up';
                this.formFeedback = "Lower weights to shoulder level";
            }
        } else if (avgArmAngle < 80) {
            if (this.stage === 'up' || this.stage === 'idle') {
                this.stage = 'down';
                this.formFeedback = "Press weights straight overhead!";
            }
        }
    }

    /**
     * JUMPING JACKS TRACKING
     */
    trackJumpingJack(landmarks, audioCoach) {
        const P = POSE_LANDMARKS;
        const leftShoulder = landmarks[P.LEFT_SHOULDER];
        const rightShoulder = landmarks[P.RIGHT_SHOULDER];
        const leftWrist = landmarks[P.LEFT_WRIST];
        const rightWrist = landmarks[P.RIGHT_WRIST];
        const leftAnkle = landmarks[P.LEFT_ANKLE];
        const rightAnkle = landmarks[P.RIGHT_ANKLE];

        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        const feetWidth = Math.abs(leftAnkle.x - rightAnkle.x);
        const handsAboveHead = leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;

        const feetSpreadRatio = feetWidth / (shoulderWidth || 1);
        this.currentAngle = Math.round(feetSpreadRatio * 100);

        if (handsAboveHead && feetSpreadRatio > 1.3) {
            if (this.stage === 'down' || this.stage === 'idle') {
                this.stage = 'up';
                this.formFeedback = "Return arms and legs together";
            }
        } else if (!handsAboveHead && feetSpreadRatio < 1.0) {
            if (this.stage === 'up') {
                this.reps += 1;
                this.totalAttempts += 1;
                this.goodReps += 1;
                this.stage = 'down';
                this.calories += 0.20;
                this.recordRepTiming();
                this.formFeedback = "Great rhythm!";
                this.isGoodForm = true;
                audioCoach.playRepTone();
                audioCoach.speak(`${this.reps}`);
            } else {
                this.stage = 'down';
                this.formFeedback = "Jump spreading feet & raise hands!";
            }
        }
    }

    /**
     * PLANK HOLD TRACKING
     */
    trackPlank(landmarks, audioCoach) {
        const P = POSE_LANDMARKS;
        const side = PoseMath.getDominantSide(landmarks);

        let shoulder, hip, ankle;
        if (side === 'right') {
            shoulder = landmarks[P.RIGHT_SHOULDER];
            hip = landmarks[P.RIGHT_HIP];
            ankle = landmarks[P.RIGHT_ANKLE];
        } else {
            shoulder = landmarks[P.LEFT_SHOULDER];
            hip = landmarks[P.LEFT_HIP];
            ankle = landmarks[P.LEFT_ANKLE];
        }

        const bodyAngle = PoseMath.calculateAngle2D(shoulder, hip, ankle);
        this.currentAngle = bodyAngle;
        this.targetAngleMin = 160;
        this.targetAngleMax = 180;

        const isAligned = bodyAngle >= 155 && bodyAngle <= 195;

        if (isAligned) {
            this.isGoodForm = true;
            this.stage = 'hold';

            if (!this.plankStartTime) {
                this.plankStartTime = Date.now();
                audioCoach.speak("Plank started, hold steady");
            } else {
                const elapsedSec = Math.floor((Date.now() - this.plankStartTime) / 1000);
                this.plankHoldSeconds = elapsedSec;
                this.reps = elapsedSec; // Reps display seconds held for plank
                this.calories += 0.0013; // Calorie accumulation
                this.formFeedback = `Holding plank: ${elapsedSec}s - Great alignment!`;

                // Spoken milestone every 10 seconds
                if (elapsedSec > 0 && elapsedSec % 10 === 0 && elapsedSec !== this._lastPlankMilestone) {
                    this._lastPlankMilestone = elapsedSec;
                    audioCoach.speak(`${elapsedSec} seconds`);
                }
            }
        } else {
            this.isGoodForm = false;
            this.stage = 'idle';
            this.plankStartTime = null;
            if (bodyAngle < 155) {
                this.formFeedback = "Hips are sagging! Lift your core.";
            } else {
                this.formFeedback = "Hips are too high! Lower to a straight line.";
            }
        }
    }

    recordRepTiming() {
        const now = Date.now();
        this.repTimestamps.push(now);
        // Keep last 10 reps for cadence
        if (this.repTimestamps.length > 10) {
            this.repTimestamps.shift();
        }
    }

    getCadence() {
        if (this.repTimestamps.length < 2) return 0;
        const oldest = this.repTimestamps[0];
        const newest = this.repTimestamps[this.repTimestamps.length - 1];
        const minutes = (newest - oldest) / 60000;
        if (minutes <= 0) return 0;
        return Math.round((this.repTimestamps.length - 1) / minutes);
    }

    getAccuracy() {
        if (this.totalAttempts === 0) return 100;
        return Math.round((this.goodReps / this.totalAttempts) * 100);
    }
}

window.ExerciseTracker = ExerciseTracker;
