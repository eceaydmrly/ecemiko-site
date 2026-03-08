'use strict';

/* ═══════════════════════════════════════════════════════════
   ECEMIKO — script.js  (v2 — integrated scroll storytelling)
   ═══════════════════════════════════════════════════════════ */

/* ───────────────────────────────────────────────────────────
   1. CUSTOM CURSOR — soft magnetic feel
   ─────────────────────────────────────────────────────────── */
const cursorDot = document.getElementById('cursor-dot');
const cursorRing = document.getElementById('cursor-ring');

let mouseX = 0, mouseY = 0;
let ringX = 0, ringY = 0;

document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorDot.style.left = mouseX + 'px';
    cursorDot.style.top = mouseY + 'px';
});

(function animateCursor() {
    ringX += (mouseX - ringX) * 0.11;
    ringY += (mouseY - ringY) * 0.11;
    cursorRing.style.left = ringX + 'px';
    cursorRing.style.top = ringY + 'px';
    requestAnimationFrame(animateCursor);
})();

document.querySelectorAll('a, button, .feature-card, .download-card, .story-panel, .story-btn').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
});


/* ───────────────────────────────────────────────────────────
   2. NAVBAR
   ─────────────────────────────────────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });


/* ───────────────────────────────────────────────────────────
   3. SCROLL-DRIVEN FRAME ANIMATION (GSAP + CANVAS)
   ─────────────────────────────────────────────────────────── */
const canvas = document.getElementById('scroll-canvas');
const ctx = canvas.getContext('2d');
const section = document.getElementById('scroll-animation-section');

// Restored the exact existing JPG sequence from the original codebase
const TOTAL = 93;
const frameSrc = n => `ezgif-821fab6a50df84fa-jpg/ezgif-frame-${String(n).padStart(3, '0')}.jpg`;

const imgs = new Array(TOTAL);
let curIdx = 0;

/* Resize canvas to match viewport taking device pixel ratio into account for high-DPI (Retina/4K) */
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    // Ensure memory maps perfectly to physical screen pixels
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    // Lock the CSS to standard viewport size
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    if (imgs[curIdx]?.complete) renderFrame(curIdx);
}
window.addEventListener('resize', resizeCanvas, { passive: true });
resizeCanvas();

/* Draw a frame — true object-fit: cover logic.
   This guarantees the image completely covers the viewport bounds, scaling dynamically based on resolution. */
function renderFrame(idx) {
    const img = imgs[idx];
    if (!img?.complete || !img.naturalWidth) return;

    // Use the absolute physical pixels of the canvas buffer
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;

    // Use medium (Bilinear) filtering instead of high (Lanczos).
    // Lanczos forcefully over-sharpens constraints, heavily exposing JPG artifacts and pixelation. 
    // Bilinear smoothly interpolates pixels, softening the low-res edges.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    // Cover scale mathematically mapped to absolute resolution
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale, dh = ih * scale;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

/* ── UI refs ── */
const progressLine = document.getElementById('scroll-progress-line');
const progressDot = document.getElementById('scroll-progress-dot');
const counterNum = document.getElementById('frame-counter-num');
const storyPanels = document.querySelectorAll('.story-panel');

/* ── Asset Preloading Logic ── */
// Fetch and cache all frames before building the animation
const loadPromises = [];

for (let i = 0; i < TOTAL; i++) {
    const p = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            if (i === 0) renderFrame(0); // show first frame immediately
            resolve(img);
        };
        img.onerror = () => resolve(img); // resolve anyway so we don't break the chain if one fails
        img.src = frameSrc(i + 1);
        imgs[i] = img;
    });
    loadPromises.push(p);
}

/* ── Initialize GSAP ScrollTrigger once all frames are ready ── */
Promise.all(loadPromises).then(() => {
    // Only register ScrollTrigger after preloading ensures accurate dimensions calculation
    gsap.registerPlugin(ScrollTrigger);

    // Context object to hold the current frame for GSAP to tween smoothly
    const sequenceObj = { frame: 0 };

    gsap.to(sequenceObj, {
        frame: TOTAL - 1,
        snap: "frame", // Snap to whole integers
        ease: "none",
        scrollTrigger: {
            trigger: "#scroll-animation-section",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.5, // 0.5s smoothing effect (1:1 faster scrub logic/interpolation)
            onUpdate: (self) => {
                const idx = Math.round(sequenceObj.frame);

                // Redraw canvas if frame changed
                if (idx !== curIdx) {
                    curIdx = idx;
                    renderFrame(idx);
                }

                // UI Updates: Progress rail
                const pct = self.progress;
                const railPct = pct * 100;
                progressLine.style.height = railPct + '%';
                progressDot.style.top = railPct + '%';

                // UI Updates: Frame counter
                counterNum.textContent = String(idx + 1).padStart(3, '0');

                // UI Updates: Chapter panels visibility (overlapping ranges)
                storyPanels.forEach(panel => {
                    const from = parseFloat(panel.dataset.from);
                    const to = parseFloat(panel.dataset.to);
                    // generous hysteresis on exit
                    const active = pct >= from && pct <= to + 0.06;
                    panel.classList.toggle('visible', active);
                });
            }
        }
    });

    // Refresh ScrollTrigger to recalculate layout
    ScrollTrigger.refresh();
});

/* ── Main scroll handler (ONLY for generic section reveals now, canvas is handled by GSAP) ── */
function onScroll() {
    handleScrollReveal();
}
window.addEventListener('scroll', onScroll, { passive: true });


/* ───────────────────────────────────────────────────────────
   4. SCROLL REVEAL — generic sections
   ─────────────────────────────────────────────────────────── */
const revealEls = document.querySelectorAll(
    '.section-header, .download-card, .download-requirements, .reveal'
);

const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('in-view');
            revealObs.unobserve(e.target);
        }
    });
}, { threshold: 0.12 });

revealEls.forEach(el => revealObs.observe(el));

function handleScrollReveal() {
    revealEls.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9) el.classList.add('in-view');
    });
}


/* ───────────────────────────────────────────────────────────
   5. FEATURE CARDS — staggered reveal
   ─────────────────────────────────────────────────────────── */
const cardObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            const delay = (parseInt(e.target.dataset.index) || 0) * 90;
            setTimeout(() => e.target.classList.add('in-view'), delay);
            cardObs.unobserve(e.target);
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.feature-card').forEach(c => cardObs.observe(c));


/* ───────────────────────────────────────────────────────────
   6. COUNT-UP — hero stats
   ─────────────────────────────────────────────────────────── */
const countObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const target = parseInt(el.dataset.count);
        if (isNaN(target)) return;
        const dur = 1800;
        const start = performance.now();

        (function tick(now) {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(2, -10 * p);         // easeOutExpo
            el.textContent = Math.floor(eased * target).toLocaleString('tr-TR');
            if (p < 1) requestAnimationFrame(tick);
        })(start);

        countObs.unobserve(el);
    });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-num').forEach(el => countObs.observe(el));


/* ───────────────────────────────────────────────────────────
   7. DOWNLOAD BUTTON — ripple
   ─────────────────────────────────────────────────────────── */
const dlBtn = document.getElementById('main-download-btn');
if (dlBtn) {
    dlBtn.addEventListener('click', function (e) {
        const rip = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;
        rip.style.cssText = `
      position:absolute;
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:rgba(255,255,255,0.22);
      top:${e.clientY - rect.top - size / 2}px;
      left:${e.clientX - rect.left - size / 2}px;
      transform:scale(0);
      animation:_ripple 0.65s ease-out forwards;
      pointer-events:none;z-index:5;
    `;
        this.appendChild(rip);
        setTimeout(() => rip.remove(), 700);
    });
}

/* Inject ripple keyframe */
document.head.insertAdjacentHTML('beforeend', `
  <style>@keyframes _ripple { to { transform:scale(1); opacity:0; } }</style>
`);


/* ───────────────────────────────────────────────────────────
   8. SMOOTH SCROLL
   ─────────────────────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
        const target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
    });
});


/* ───────────────────────────────────────────────────────────
   9. HERO FLOAT CARD — mouse parallax
   ─────────────────────────────────────────────────────────── */
const floatCard = document.querySelector('.hero-float-card');
if (floatCard) {
    document.addEventListener('mousemove', e => {
        const xR = (e.clientX / window.innerWidth - 0.5) * 2;
        const yR = (e.clientY / window.innerHeight - 0.5) * 2;
        floatCard.style.transform = `translateY(${-6 + yR * -6}px) rotate(${xR * 3}deg)`;
    });
}


/* ───────────────────────────────────────────────────────────
   10. FAQ ACCORDION LOGIC
   ─────────────────────────────────────────────────────────── */
document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const faqItem = button.parentElement;
        const answer = button.nextElementSibling;
        const isActive = faqItem.classList.contains('active');

        // Close all other FAQs
        document.querySelectorAll('.faq-item').forEach(item => {
            item.classList.remove('active');
            item.querySelector('.faq-answer').style.maxHeight = null;
        });

        // Toggle clicked FAQ
        if (!isActive) {
            faqItem.classList.add('active');
            answer.style.maxHeight = answer.scrollHeight + "px";
        }
    });
});



/* ───────────────────────────────────────────────────────────
   Init
   ─────────────────────────────────────────────────────────── */
handleScrollReveal();
