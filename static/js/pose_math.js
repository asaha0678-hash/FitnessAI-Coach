/**
 * FitnessAI-Coach - Pose Mathematics & Trigonometry Engine
 * Calculates 2D/3D joint angles, distances, smoothing, and geometric postures.
 */

const POSE_LANDMARKS = {
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
};

class PoseMath {
    /**
     * Calculate interior angle in degrees at vertex p2 formed by (p1 -> p2 -> p3).
     * @param {Object} p1 First point {x, y, (z)}
     * @param {Object} p2 Vertex point {x, y, (z)}
     * @param {Object} p3 Third point {x, y, (z)}
     * @returns {number} Angle in degrees [0, 180]
     */
    static calculateAngle2D(p1, p2, p3) {
        if (!p1 || !p2 || !p3) return 0;

        const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
        let angle = Math.abs((radians * 180.0) / Math.PI);

        if (angle > 180.0) {
            angle = 360.0 - angle;
        }

        return Math.round(angle * 10) / 10;
    }

    /**
     * 3D Euclidean angle using vector dot product.
     */
    static calculateAngle3D(p1, p2, p3) {
        if (!p1 || !p2 || !p3) return 0;

        const v1 = {
            x: p1.x - p2.x,
            y: p1.y - p2.y,
            z: (p1.z || 0) - (p2.z || 0)
        };

        const v2 = {
            x: p3.x - p2.x,
            y: p3.y - p2.y,
            z: (p3.z || 0) - (p2.z || 0)
        };

        const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

        if (mag1 === 0 || mag2 === 0) return 0;

        const cosTheta = Math.min(1.0, Math.max(-1.0, dot / (mag1 * mag2)));
        const angle = Math.acos(cosTheta) * (180.0 / Math.PI);
        return Math.round(angle * 10) / 10;
    }

    /**
     * 2D Euclidean distance between two points normalized [0, 1].
     */
    static calculateDistance(p1, p2) {
        if (!p1 || !p2) return 0;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate inclination angle of a line segment with the vertical Y axis (degrees).
     * Useful for checking torso vertical alignment or spine posture.
     */
    static calculateVerticalInclination(pTop, pBottom) {
        if (!pTop || !pBottom) return 0;
        const dx = Math.abs(pTop.x - pBottom.x);
        const dy = Math.abs(pTop.y - pBottom.y);
        if (dy === 0) return 90;
        const radians = Math.atan2(dx, dy);
        return (radians * 180.0) / Math.PI;
    }

    /**
     * Determine which side of the body is more visible based on visibility scores.
     * @returns {'left' | 'right' | 'both'}
     */
    static getDominantSide(landmarks) {
        if (!landmarks) return 'left';
        const leftScore = (landmarks[POSE_LANDMARKS.LEFT_SHOULDER]?.visibility || 0) +
                          (landmarks[POSE_LANDMARKS.LEFT_ELBOW]?.visibility || 0) +
                          (landmarks[POSE_LANDMARKS.LEFT_HIP]?.visibility || 0) +
                          (landmarks[POSE_LANDMARKS.LEFT_KNEE]?.visibility || 0);

        const rightScore = (landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]?.visibility || 0) +
                           (landmarks[POSE_LANDMARKS.RIGHT_ELBOW]?.visibility || 0) +
                           (landmarks[POSE_LANDMARKS.RIGHT_HIP]?.visibility || 0) +
                           (landmarks[POSE_LANDMARKS.RIGHT_KNEE]?.visibility || 0);

        if (Math.abs(leftScore - rightScore) < 0.6) return 'both';
        return leftScore > rightScore ? 'left' : 'right';
    }
}

/**
 * Exponential Moving Average filter to smooth landmark jitter
 */
class LandmarkSmoother {
    constructor(alpha = 0.65) {
        this.alpha = alpha;
        this.history = {};
    }

    smooth(landmarks) {
        if (!landmarks) return landmarks;
        const smoothed = [];

        for (let i = 0; i < landmarks.length; i++) {
            const current = landmarks[i];
            if (!this.history[i]) {
                this.history[i] = { ...current };
            } else {
                this.history[i].x = this.alpha * current.x + (1 - this.alpha) * this.history[i].x;
                this.history[i].y = this.alpha * current.y + (1 - this.alpha) * this.history[i].y;
                if (current.z !== undefined) {
                    this.history[i].z = this.alpha * current.z + (1 - this.alpha) * (this.history[i].z || 0);
                }
                this.history[i].visibility = current.visibility;
            }
            smoothed.push({ ...this.history[i] });
        }

        return smoothed;
    }

    reset() {
        this.history = {};
    }
}

// Export for browser global scope
window.POSE_LANDMARKS = POSE_LANDMARKS;
window.PoseMath = PoseMath;
window.LandmarkSmoother = LandmarkSmoother;
