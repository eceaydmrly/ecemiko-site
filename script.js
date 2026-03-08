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

// Smooth scroll for navbar links with height offset
document.querySelectorAll('.nav-links a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetEl = document.querySelector(targetId);
        if (!targetEl) return;

        const navHeight = navbar.offsetHeight || 80;
        const targetPos = targetEl.getBoundingClientRect().top + window.pageYOffset - navHeight;

        window.scrollTo({
            top: targetPos,
            behavior: 'smooth'
        });
    });
});



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

    // Use highest quality (Lanczos/Bicubic) interpolation for scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Tam Kaplama (Cover) moduna geri dönüldü: Resim ekranı tamamen, büyük bir şekilde kaplar.
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
            scrub: true, // Ties the animation exactly 1:1 to the scroll position, no lag to prevent cutoff
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

                    // Mobilde üst üste binmemesi için toleransı azaltıyoruz, masaüstünde geçiş yumuşak kalıyor.
                    const isMobile = window.innerWidth < 600;
                    const margin = isMobile ? 0 : 0.06;

                    const active = pct >= from && pct <= to + margin;
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
        const rawTarget = el.dataset.count;

        // Eğer hedef rakam değilse (örn: "64 Bin") veya 1 gibi çok küçükse animasyona sokma
        if (isNaN(rawTarget) || parseInt(rawTarget) <= 1) {
            el.textContent = rawTarget;
            countObs.unobserve(el);
            return;
        }

        const target = parseInt(rawTarget);
        const dur = 1800;
        const start = performance.now();

        (function tick(now) {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(2, -10 * p);         // easeOutExpo

            // Eğer hedef sayı çok küçükse (1 gibi) Math.floor 0'da bırakabiliyor.
            // Küçük sayılarda Math.ceil kullanarak direkt rakama ulaşmasını sağlıyoruz.
            const current = target < 10 ? Math.ceil(eased * target) : Math.floor(eased * target);
            el.textContent = current.toLocaleString('tr-TR');

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
   11. GITHUB RELEASE FETCHER
   ─────────────────────────────────────────────────────────── */
async function fetchLatestRelease() {
    const repo = 'sovmeyingo/Lucy-Updates';
    const api = `https://api.github.com/repos/${repo}/releases/latest`;

    try {
        const response = await fetch(api);
        if (!response.ok) throw new Error('Release fetch failed');

        const data = await response.json();
        const dlBtn = document.getElementById('main-download-btn');
        const titleEl = document.getElementById('release-title');
        const dateEl = document.getElementById('release-date');
        const heroBtn = document.getElementById('hero-download-btn');

        // Find the first .exe asset
        const exeAsset = data.assets.find(asset => asset.name.endsWith('.exe'));

        if (exeAsset && dlBtn) {
            dlBtn.href = exeAsset.browser_download_url;
            // Also update the hero section download button to anchor correctly
            if (heroBtn) heroBtn.href = "#download";
        }

        if (titleEl) {
            titleEl.textContent = `Ecemiko Launcher ${data.tag_name}`;
        }

        if (dateEl) {
            const date = new Date(data.published_at);
            const formatted = date.toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            // Eğer tarih değiştiyse animasyonlu geçiş yap (Eş Zamanlı hissettirir)
            if (dateEl.textContent !== `Son Güncelleme: ${formatted}`) {
                dateEl.style.transition = 'opacity 0.3s';
                dateEl.style.opacity = '0';
                setTimeout(() => {
                    dateEl.textContent = `Son Güncelleme: ${formatted}`;
                    dateEl.style.opacity = '0.7';
                }, 300);
            }
        }

        console.log(`Latest release fetched: ${data.tag_name}`);
    } catch (error) {
        console.error('Error fetching latest release:', error);
        // Hata durumunda statik ama güvenli bir metin
        const dateEl = document.getElementById('release-date');
        if (dateEl && dateEl.textContent.includes('Bekleniyor')) {
            dateEl.textContent = "Güncelleme bilgisi şuan alınamıyor.";
        }
    }
}

// Her 10 dakikada bir otomatik kontrol et (Sayfayı yenilemeye gerek kalmadan "Eş Zamanlı" kontrol)
setInterval(fetchLatestRelease, 10 * 60 * 1000);


/* ───────────────────────────────────────────────────────────
   12. LIGHTBOX SHOWCASE LOGIC
   ─────────────────────────────────────────────────────────── */
function initLightbox() {
    const card = document.getElementById('premium-design-card');
    const modal = document.getElementById('lightbox-modal');
    const closeBtn = document.getElementById('modal-close');
    const modalImg = document.getElementById('modal-img');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const caption = document.getElementById('image-caption');
    const thumbsContainer = document.getElementById('modal-thumbnails');
    const overlay = document.querySelector('.modal-overlay');

    if (!card || !modal) return;

    let currentIndex = 1;
    const totalImages = 8;
    const baseDir = 'showimgs/';

    // Generate thumbnails
    thumbsContainer.innerHTML = '';
    for (let i = 1; i <= totalImages; i++) {
        const thumb = document.createElement('img');
        thumb.src = `${baseDir}${i}.png`;
        thumb.className = 'thumb-item';
        thumb.dataset.idx = i;
        thumb.onclick = () => updateImage(i);
        thumbsContainer.appendChild(thumb);
    }

    function updateImage(index) {
        currentIndex = index;
        modalImg.src = `${baseDir}${currentIndex}.png`;
        caption.textContent = `Görsel ${currentIndex} / ${totalImages}`;

        // Görüntü değiştiğinde zoom'u sıfırla
        modalImg.classList.remove('zoomed');

        // Update active thumb
        document.querySelectorAll('.thumb-item').forEach(t => {
            t.classList.toggle('active', parseInt(t.dataset.idx) === currentIndex);
        });
    }

    // Mobil Zoom Logic (Tıklayınca büyüme/küçülme)
    modalImg.addEventListener('click', () => {
        modalImg.classList.toggle('zoomed');
    });

    card.addEventListener('click', () => {
        modal.classList.add('active');
        updateImage(1);
        document.body.style.overflow = 'hidden'; // Stop page scroll
    });

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let next = currentIndex + 1;
        if (next > totalImages) next = 1;
        updateImage(next);
    });

    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let prev = currentIndex - 1;
        if (prev < 1) prev = totalImages;
        updateImage(prev);
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('active')) return;
        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowRight') nextBtn.click();
        if (e.key === 'ArrowLeft') prevBtn.click();
    });
}


/* ───────────────────────────────────────────────────────────
   13. FOOTER & CONTACT MODAL LOGIC
   ─────────────────────────────────────────────────────────── */
function initFooterLogic() {
    const contactBtn = document.getElementById('contact-link');
    const contactModal = document.getElementById('contact-modal');
    const contactClose = document.getElementById('contact-close');
    const contactOverlay = contactModal.querySelector('.modal-overlay');
    const contactForm = document.getElementById('contact-form');

    const privacyLink = document.getElementById('privacy-link');
    const termsLink = document.getElementById('terms-link');

    // Prevent jump for privacy/terms
    [privacyLink, termsLink].forEach(link => {
        link?.addEventListener('click', (e) => e.preventDefault());
    });

    const openContact = (e) => {
        e.preventDefault();
        contactModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeContact = () => {
        contactModal.classList.remove('active');
        document.body.style.overflow = '';
    };

    contactBtn?.addEventListener('click', openContact);
    contactClose?.addEventListener('click', closeContact);
    contactOverlay?.addEventListener('click', closeContact);

    // Form submission simulation
    contactForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const submitBtn = contactForm.querySelector('button');
        const originalText = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Gönderiliyor...';

        setTimeout(() => {
            alert('Mesajınız başarıyla iletildi! En kısa sürede size döneceğiz.');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            contactForm.reset();
            closeContact();
        }, 1500);
    });
}


/* ───────────────────────────────────────────────────────────
   14. DOWNLOAD LOADING ANIMATION
   ─────────────────────────────────────────────────────────── */
function initDownloadEffect() {
    const dlBtn = document.getElementById('main-download-btn');
    if (!dlBtn) return;

    dlBtn.addEventListener('click', function (e) {
        // İndirme işlemini simüle etmek için 2 saniye bekletiyoruz
        if (this.classList.contains('loading')) return;

        this.classList.add('loading');
        const inner = this.querySelector('.btn-download-inner');
        const originalHTML = inner.innerHTML;

        inner.innerHTML = `
            <div class="btn-download-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke-linecap="round"/>
                </svg>
            </div>
            <span style="margin-left: 10px">Hazırlanıyor...</span>
        `;

        setTimeout(() => {
            this.classList.remove('loading');
            inner.innerHTML = originalHTML;
            // İndirme işlemi tarayıcı üzerinden devam eder (href zaten set edilmişti)
        }, 2000);
    });
}



/* ───────────────────────────────────────────────────────────
   14. AUTH LOGIC (Kod Sistemi)
   ─────────────────────────────────────────────────────────── */
function initAuthLogic() {
    const validCodes = [
        "ECW-A3X7", "ECW-M9R2", "ECW-K4F8", "ECW-P7Y3", "ECW-T2W5",
        "ECW-H8N4", "ECW-B5J9", "ECW-C6V2", "ECW-D3M7", "ECW-E9K4",
        "ECW-G2P8", "ECW-Q5T3", "ECW-R7H6", "ECW-S4B2", "ECW-U8C9",
        "ECW-V3D5", "ECW-W9E7", "ECW-X2G4", "ECW-Y6Q8", "ECW-Z4R3",
        "ECW-F7S5", "ECW-J2U9", "ECW-N8V4", "ECW-A5W2", "ECW-M3X8",
        "ECW-K9Y4", "ECW-P2Z7", "ECW-T6A3", "ECW-H4B9", "ECW-B8C5",
        "ECW-C3D2", "ECW-D7E6", "ECW-E2G9", "ECW-G5H4", "ECW-Q9J2",
        "ECW-R4K8", "ECW-S8M3", "ECW-U3N7", "ECW-V7P2", "ECW-W4Q6",
        "ECW-X9R5", "ECW-Y2S8", "ECW-Z6T4", "ECW-F3U2", "ECW-J8V7",
        "ECW-N5W3", "ECW-A9X2", "ECW-M4Y6", "ECW-K2Z8", "ECW-P6A5",
        "ECW-T3B9", "ECW-H7C4", "ECW-B2D8", "ECW-C9E3", "ECW-D4G7",
        "ECW-E8H2", "ECW-G3J6", "ECW-Q7K4", "ECW-R2M9", "ECW-S5N3",
        "ECW-U9P8", "ECW-V4Q2", "ECW-W8R7", "ECW-X3S5", "ECW-Y7T2",
        "ECW-Z2U9", "ECW-F6V4", "ECW-J3W8", "ECW-N9X5", "ECW-A4Y2",
        "ECW-M8Z6", "ECW-K5A3", "ECW-P9B7", "ECW-T4C2", "ECW-H2D9",
        "ECW-B7E4", "ECW-C4G8", "ECW-D9H3", "ECW-E5J2", "ECW-G8K7",
        "ECW-Q2M5", "ECW-R6N9", "ECW-S3P4", "ECW-U7Q2", "ECW-V2R8",
        "ECW-W5S3", "ECW-X8T7", "ECW-Y4U2", "ECW-Z9V5", "ECW-F2W8",
        "ECW-J7X4", "ECW-N3Y9", "ECW-A8Z2", "ECW-M5A7", "ECW-K3B4",
        "ECW-P8C9", "ECW-T2D5", "ECW-H9E2", "ECW-B4G6", "ECW-C7H8"
    ];

    const modal = document.getElementById('auth-modal');
    const input = document.getElementById('auth-code-input');
    const submitBtn = document.getElementById('auth-submit-btn');
    const skipBtn = document.getElementById('auth-skip-btn');
    const errorMsg = document.getElementById('auth-error');
    const dynamicBtns = document.querySelectorAll('.auth-dynamic-btn');

    function updateUIState(isAuthenticated) {
        if (isAuthenticated) {
            document.body.classList.add('authenticated');
            dynamicBtns.forEach(btn => {
                if (btn.id === 'nav-download-btn') btn.textContent = 'İndir';
                if (btn.id === 'hero-download-btn') {
                    const textEl = btn.querySelector('.btn-text');
                    if (textEl) textEl.textContent = 'Hemen İndir';
                }
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            });
        } else {
            document.body.classList.remove('authenticated');
            dynamicBtns.forEach(btn => {
                if (btn.id === 'nav-download-btn') btn.textContent = 'Kod ile Giriş Yap';
                if (btn.id === 'hero-download-btn') {
                    const textEl = btn.querySelector('.btn-text');
                    if (textEl) textEl.textContent = 'Kod ile Giriş Yap';
                }
            });
        }
    }

    // Başlangıç kontrolü
    const savedCode = localStorage.getItem('ecemiko_auth_code');
    updateUIState(!!savedCode && validCodes.includes(savedCode));

    if (!savedCode) {
        setTimeout(() => modal.classList.add('active'), 1200);
    }

    // Buton tıklama mantığı (Eğer yetki yoksa modali aç)
    dynamicBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!document.body.classList.contains('authenticated')) {
                e.preventDefault();
                modal.classList.add('active');
            }
        });
    });

    submitBtn.addEventListener('click', () => {
        const code = input.value.trim().toUpperCase();

        // "Kullanılmış Kodlar" kontrolü (Simüle edilmiş - localStorage üzerinde tutulur)
        let usedCodes = JSON.parse(localStorage.getItem('ecemiko_used_codes') || '[]');

        if (usedCodes.includes(code)) {
            errorMsg.textContent = "Bu kod daha önce kullanılmış!";
            errorMsg.classList.add('visible');
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 400);
            return;
        }

        if (validCodes.includes(code)) {
            // Kodu kullanıldı olarak işaretle
            usedCodes.push(code);
            localStorage.setItem('ecemiko_used_codes', JSON.stringify(usedCodes));
            localStorage.setItem('ecemiko_auth_code', code);

            updateUIState(true);
            modal.classList.remove('active');
            errorMsg.classList.remove('visible');
        } else {
            errorMsg.textContent = "Geçersiz kod! Lütfen tekrar deneyiniz.";
            errorMsg.classList.add('visible');
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 400);
        }
    });

    skipBtn.addEventListener('click', () => modal.classList.remove('active'));
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitBtn.click(); });
}


/* ───────────────────────────────────────────────────────────
   Init
   ─────────────────────────────────────────────────────────── */
handleScrollReveal();
fetchLatestRelease();
initLightbox();
initFooterLogic();
initDownloadEffect();
initAuthLogic();
