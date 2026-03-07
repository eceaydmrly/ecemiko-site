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
   3. SCROLL-DRIVEN FRAME ANIMATION
   ─────────────────────────────────────────────────────────── */
const canvas = document.getElementById('scroll-canvas');
const ctx = canvas.getContext('2d');
const section = document.getElementById('scroll-animation-section');

const TOTAL = 93;
const frameSrc = n => `ezgif-821fab6a50df84fa-jpg/ezgif-frame-${String(n).padStart(3, '0')}.jpg`;

const imgs = new Array(TOTAL);
let loaded = 0;
let curIdx = 0;

/* Resize canvas to match viewport */
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (imgs[curIdx]?.complete) renderFrame(curIdx);
}
window.addEventListener('resize', resizeCanvas, { passive: true });
resizeCanvas();

/* Draw a frame — adaptive scaling:
   - Widescreen images → cover (fills viewport edge-to-edge)
   - Portrait / close-up images → cap at 1.6× contain so character
     fits without the blurry mega-zoom effect */
function renderFrame(idx) {
    const img = imgs[idx];
    if (!img?.complete || !img.naturalWidth) return;
    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;

    const coverScale = Math.max(cw / iw, ch / ih);
    const containScale = Math.min(cw / iw, ch / ih);
    const scale = Math.min(coverScale, containScale * 1.6);
    const dw = iw * scale, dh = ih * scale;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

/* Load all frames; draw first one as soon as it's ready */
for (let i = 0; i < TOTAL; i++) {
    const img = new Image();
    img.onload = () => {
        loaded++;
        if (i === 0) renderFrame(0);    // show first frame immediately
    };
    img.src = frameSrc(i + 1);
    imgs[i] = img;
}


/* ── UI refs ── */
const progressLine = document.getElementById('scroll-progress-line');
const progressDot = document.getElementById('scroll-progress-dot');
const counterNum = document.getElementById('frame-counter-num');
const storyPanels = document.querySelectorAll('.story-panel');


/* ── easeInOutCubic for smoother frame interpolation ── */
function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ── Main scroll handler ── */
function onScroll() {
    handleCanvas();
    handleScrollReveal();
}
window.addEventListener('scroll', onScroll, { passive: true });

function handleCanvas() {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const scroll = window.scrollY;
    const vh = window.innerHeight;

    /* raw 0→1 progress */
    const raw = (scroll - top) / (height - vh);
    const pct = Math.min(1, Math.max(0, raw));

    /* eased progress → frame index */
    const eased = easeInOut(pct);
    const idx = Math.min(TOTAL - 1, Math.round(eased * (TOTAL - 1)));

    /* render only when index changes & image is ready */
    if (idx !== curIdx && imgs[idx]?.complete) {
        curIdx = idx;
        renderFrame(idx);
    }

    /* progress rail */
    const railPct = pct * 100;
    progressLine.style.height = railPct + '%';
    progressDot.style.top = railPct + '%';

    /* frame counter */
    counterNum.textContent = String(idx + 1).padStart(3, '0');

    /* ── Chapter panels —
       Wide overlapping ranges so a panel is ALWAYS visible when
       the user is inside the scroll section. Panels fade out only
       when the next one overlaps. ── */
    storyPanels.forEach(panel => {
        const from = parseFloat(panel.dataset.from);
        const to = parseFloat(panel.dataset.to);
        /* generous hysteresis on exit so panels don't vanish too soon */
        const active = pct >= from && pct <= to + 0.06;
        panel.classList.toggle('visible', active);
    });
}


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
handleCanvas();
