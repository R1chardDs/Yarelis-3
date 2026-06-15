// Canvas setup
const canvas = document.getElementById('heartCanvas');
const ctx = canvas.getContext('2d');
const textContainer = document.getElementById('textContainer');
const interactiveTip = document.getElementById('interactiveTip');

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

let centerX = width / 2;
let centerY = height / 2;

// Particle configuration
const HEART_PARTICLES_COUNT = 1500;
const heartParticles = [];
const trailParticles = [];

// Interaction state
const mouse = {
    x: null,
    y: null,
    radius: 80, // repulsion radius
    active: false
};

// Animation control
let time = 0;
let baseScale = 1;
let animState = 'assembling'; // 'assembling', 'beating'
let assemblyProgress = 0;
let textRevealed = false;

// Color palette - Pink shades
const pinkShades = [
    'rgba(255, 77, 136, ',   // Hot Pink
    'rgba(255, 133, 162, ',  // Soft Pink
    'rgba(255, 179, 198, ',  // Light Pink
    'rgba(255, 20, 147, ',   // Deep Pink
    'rgba(255, 105, 180, '   // Pastel Pink
];

// Parametric heart formula
// x = 16 * sin^3(t)
// y = -(13 * cos(t) - 5 * cos(2t) - 2 * cos(3t) - cos(4t))
function getHeartPoint(t) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    return { x, y };
}

// Determine scale of the heart based on viewport size
function calculateHeartScale() {
    return Math.min(width, height) / 38;
}

// Particle Class
class Particle {
    constructor(isHeartParticle, heartTargetX = 0, heartTargetY = 0) {
        this.isHeart = isHeartParticle;
        
        if (this.isHeart) {
            // Start at random screen position
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            
            // Raw coordinates on a 1-unit heart, to be scaled dynamically
            this.hx = heartTargetX;
            this.hy = heartTargetY;
            
            this.tx = centerX + this.hx * calculateHeartScale();
            this.ty = centerY + this.hy * calculateHeartScale();
            
            // Random initial velocity
            this.vx = (Math.random() - 0.5) * 4;
            this.vy = (Math.random() - 0.5) * 4;
            
            this.size = Math.random() * 2 + 1.2; // Size between 1.2 and 3.2
            
            // Select random pink shade
            this.colorPrefix = pinkShades[Math.floor(Math.random() * pinkShades.length)];
            this.baseAlpha = Math.random() * 0.4 + 0.6; // Opacity 0.6 to 1.0
            this.alpha = 0; // Starts invisible, fades in
            
            this.friction = Math.random() * 0.05 + 0.88; // 0.88 - 0.93
            this.speed = Math.random() * 0.03 + 0.015; // spring strength
        } else {
            // Interactive mouse trail particles
            this.x = mouse.x;
            this.y = mouse.y;
            this.vx = (Math.random() - 0.5) * 3;
            this.vy = (Math.random() - 0.5) * 3 - 0.5; // slight upward drift
            this.size = Math.random() * 3 + 1;
            this.colorPrefix = 'rgba(255, 179, 198, ';
            this.alpha = 1;
            this.decay = Math.random() * 0.02 + 0.015;
        }
    }

    update(heartScale, currentBeatScale) {
        if (this.isHeart) {
            // Gradually fade in transparency at start
            if (this.alpha < this.baseAlpha) {
                this.alpha += 0.01;
            }

            // Calculate target position based on heart shape and beating
            this.tx = centerX + this.hx * heartScale * currentBeatScale;
            this.ty = centerY + this.hy * heartScale * currentBeatScale;

            // Physics attraction to target
            const dx = this.tx - this.x;
            const dy = this.ty - this.y;
            
            // Acceleration (spring force)
            let ax = dx * this.speed;
            let ay = dy * this.speed;

            // Mouse interaction (repulsion)
            if (mouse.active && mouse.x !== null) {
                const mdx = this.x - mouse.x;
                const mdy = this.y - mouse.y;
                const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
                
                if (mDist < mouse.radius) {
                    const force = (mouse.radius - mDist) / mouse.radius;
                    // Push particles away
                    const pushX = (mdx / mDist) * force * 4;
                    const pushY = (mdy / mDist) * force * 4;
                    
                    this.vx += pushX;
                    this.vy += pushY;
                }
            }

            // Apply forces
            this.vx += ax;
            this.vy += ay;
            
            // Apply friction/damping
            this.vx *= this.friction;
            this.vy *= this.friction;
            
            // Update position
            this.x += this.vx;
            this.y += this.vy;
            
            // Add a very subtle micro-vibration when close to target to make it look alive
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
                this.x += (Math.random() - 0.5) * 0.4;
                this.y += (Math.random() - 0.5) * 0.4;
            }
        } else {
            // Trail particle update
            this.x += this.vx;
            this.y += this.vy;
            this.alpha -= this.decay;
        }
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        
        // Draw with glow effect for larger particles
        if (this.size > 2.2) {
            ctx.shadowBlur = this.size * 3;
            ctx.shadowColor = 'rgba(255, 77, 136, 0.8)';
        }
        
        ctx.fillStyle = this.colorPrefix + Math.max(0, this.alpha) + ')';
        ctx.fill();
        ctx.restore();
    }
}

// Generate the coordinates on a heart shape
function initHeartParticles() {
    heartParticles.length = 0;
    
    // We want some particles on the sharp border, and some filling the interior
    const outlineCount = Math.floor(HEART_PARTICLES_COUNT * 0.45);
    const interiorCount = HEART_PARTICLES_COUNT - outlineCount;

    // 1. Generate border particles
    for (let i = 0; i < outlineCount; i++) {
        const t = (i / outlineCount) * Math.PI * 2;
        const pt = getHeartPoint(t);
        // Add a tiny bit of noise so they look organic
        const noiseX = (Math.random() - 0.5) * 0.15;
        const noiseY = (Math.random() - 0.5) * 0.15;
        heartParticles.push(new Particle(true, pt.x + noiseX, pt.y + noiseY));
    }

    // 2. Generate interior particles
    for (let i = 0; i < interiorCount; i++) {
        const t = Math.random() * Math.PI * 2;
        const pt = getHeartPoint(t);
        
        // Distribute within the boundary using power distribution
        // Math.pow(Math.random(), 0.6) yields a nice organic volume
        const r = Math.pow(Math.random(), 0.7); 
        
        const targetX = pt.x * r;
        const targetY = pt.y * r;
        
        heartParticles.push(new Particle(true, targetX, targetY));
    }
}

// Double-pulse heartbeat scaling calculation (lub-dub rhythm)
// Period of beat in seconds: 1.2s (approx 70-80 bpm)
function getBeatScale(t) {
    if (animState === 'assembling') {
        return 1.0;
    }
    
    const period = 1.6; // Period of complete beat cycle (seconds)
    const phase = (t % period) / period;
    
    if (phase < 0.12) {
        // First beat (Lub) - scale up quickly
        const progress = phase / 0.12;
        return 1 + 0.12 * Math.sin(progress * Math.PI);
    } else if (phase < 0.22) {
        // Brief pause / return
        const progress = (phase - 0.12) / 0.10;
        return 1 + 0.12 * Math.cos(progress * Math.PI / 2);
    } else if (phase < 0.34) {
        // Second beat (Dub) - smaller scale up
        const progress = (phase - 0.22) / 0.12;
        return 1 + 0.06 * Math.sin(progress * Math.PI);
    } else if (phase < 0.46) {
        // Return to normal
        const progress = (phase - 0.34) / 0.12;
        return 1 + 0.06 * Math.cos(progress * Math.PI / 2);
    } else {
        // Idle/relaxation phase
        return 1.0;
    }
}

// Window resizing
window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    centerX = width / 2;
    centerY = height / 2;
});

// User interactions
function handleMove(e) {
    mouse.active = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    mouse.x = clientX;
    mouse.y = clientY;

    // Create sparkly mouse trail particles
    for (let i = 0; i < 2; i++) {
        if (trailParticles.length < 100) {
            trailParticles.push(new Particle(false));
        }
    }
}

function handleEnd() {
    mouse.active = false;
    mouse.x = null;
    mouse.y = null;
}

window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseleave', handleEnd);

window.addEventListener('touchstart', (e) => {
    handleMove(e);
    // Hide tip on first tap
    interactiveTip.style.opacity = 0;
});
window.addEventListener('touchmove', handleMove);
window.addEventListener('touchend', handleEnd);

// Main Animation Loop
function animate() {
    ctx.clearRect(0, 0, width, height);
    
    // Update timing
    time += 0.016; // Approx 60fps step
    
    // Scale calculation
    const heartScale = calculateHeartScale();
    const currentBeatScale = getBeatScale(time);

    // Assembly state checking
    if (animState === 'assembling') {
        assemblyProgress += 0.005;
        if (assemblyProgress >= 1) {
            animState = 'beating';
        }
    }

    // Reveal text card after assembly is complete
    if (animState === 'beating' && !textRevealed) {
        textRevealed = true;
        setTimeout(() => {
            textContainer.classList.add('visible');
            // Smoothly fade out instructions
            interactiveTip.style.animation = 'none';
            interactiveTip.style.transition = 'opacity 2s ease';
            interactiveTip.style.opacity = '0.2';
        }, 800);
    }

    // Update & Draw Heart Particles
    for (let i = 0; i < heartParticles.length; i++) {
        const p = heartParticles[i];
        p.update(heartScale, currentBeatScale);
        p.draw();
    }

    // Update & Draw Trail Particles (reverse loop to safely splice)
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        const p = trailParticles[i];
        p.update();
        if (p.alpha <= 0) {
            trailParticles.splice(i, 1);
        } else {
            p.draw();
        }
    }

    requestAnimationFrame(animate);
}

// Initialise and start
initHeartParticles();
animate();
