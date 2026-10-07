/* ===============================================
   INFINITY LIVING OPTIONS — Interactive Engine
   Lead Generation · Animations · Calculator · Popups
   =============================================== */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 0. NETLIFY FORM SUBMISSION HELPER
    // ==========================================
    // POSTs form data to Netlify Forms (works on any Netlify-hosted deploy).
    // Falls back to a console warning + rejected promise on failure so callers
    // can surface an error to the user instead of silently "succeeding".
    function netlifySubmit(form) {
        const body = new URLSearchParams(new FormData(form)).toString();
        return fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        }).then(res => {
            if (!res.ok) throw new Error('Netlify form POST failed: ' + res.status);
            if (window.iloTrack) window.iloTrack('generate_lead', { form_name: form.getAttribute('name') || 'unknown' });
            return res;
        });
    }

    // ==========================================
    // 1. NAVBAR SCROLL EFFECT + SCROLL PROGRESS
    // ==========================================
    const navbar = document.querySelector('.navbar');
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    document.body.appendChild(progressBar);
    const handleScroll = () => {
        navbar?.classList.toggle('scrolled', window.scrollY > 50);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progressBar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // ==========================================
    // 2. MOBILE NAVIGATION
    // ==========================================
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const navOverlay = document.getElementById('navOverlay');

    if (navToggle && navLinks) {
        const toggleMenu = () => {
            navToggle.classList.toggle('active');
            navLinks.classList.toggle('open');
            navOverlay?.classList.toggle('active');
            const open = navLinks.classList.contains('open');
            navToggle.setAttribute('aria-expanded', String(open));
            document.body.style.overflow = open ? 'hidden' : '';
        };
        navToggle.addEventListener('click', toggleMenu);
        navToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); }
        });

        const closeMenu = () => {
            navToggle.classList.remove('active');
            navLinks.classList.remove('open');
            navOverlay?.classList.remove('active');
            navToggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        };
        navOverlay?.addEventListener('click', closeMenu);
        navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    }

    // ==========================================
    // 3. FAQ ACCORDION
    // ==========================================
    document.querySelectorAll('.faq-question').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item');
            const wasOpen = item.classList.contains('open');
            item.closest('.faq-list, section')?.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
            if (!wasOpen) item.classList.add('open');
        });
    });

    // ==========================================
    // 4. SCROLL ANIMATIONS (IntersectionObserver)
    // ==========================================
    const animatedEls = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right');
    if (animatedEls.length) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
        animatedEls.forEach(el => observer.observe(el));

        // Safety net: content must never stay hidden if observer
        // notifications are deferred (background tabs, prerender).
        setTimeout(() => {
            animatedEls.forEach(el => {
                if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('visible');
            });
        }, 2500);
    }

    // ==========================================
    // 5. SMOOTH SCROLLING
    // ==========================================
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const target = document.querySelector(a.getAttribute('href'));
            if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        });
    });

    // ==========================================
    // 6. ANIMATED COUNTERS
    // ==========================================
    const statNumbers = document.querySelectorAll('.stat-number[data-count]');
    if (statNumbers.length) {
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const target = parseInt(el.dataset.count);
                    const suffix = el.dataset.suffix || '';
                    const prefix = el.dataset.prefix || '';
                    const duration = 2000;
                    const start = performance.now();
                    const animate = (now) => {
                        const progress = Math.min((now - start) / duration, 1);
                        const eased = 1 - Math.pow(1 - progress, 3);
                        el.textContent = prefix + Math.round(target * eased) + suffix;
                        if (progress < 1) requestAnimationFrame(animate);
                    };
                    requestAnimationFrame(animate);
                    counterObserver.unobserve(el);
                }
            });
        }, { threshold: 0.5 });
        statNumbers.forEach(el => counterObserver.observe(el));
    }

    // ==========================================
    // 7. CONTACT FORM HANDLER
    // ==========================================
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = contactForm.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = 'Sending…';
            btn.disabled = true;
            netlifySubmit(contactForm).then(() => {
                btn.textContent = '✓ Message Sent!';
                btn.style.background = 'var(--color-success)';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                    btn.disabled = false;
                    contactForm.reset();
                }, 3000);
            }).catch(() => {
                btn.textContent = '⚠ Failed — email hello@ilo.net.au';
                btn.disabled = false;
                setTimeout(() => { btn.textContent = originalText; }, 5000);
            });
        });
    }

    // ==========================================
    // 8. PARTICLE BACKGROUND (Hero Sections)
    // ==========================================
    const canvas = document.getElementById('particleCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let animId;

        function resizeCanvas() {
            const hero = canvas.parentElement;
            canvas.width = hero.offsetWidth;
            canvas.height = hero.offsetHeight;
        }

        function createParticles() {
            particles = [];
            const count = Math.floor((canvas.width * canvas.height) / 12000);
            for (let i = 0; i < Math.min(count, 80); i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    r: Math.random() * 2 + 0.5,
                    alpha: Math.random() * 0.4 + 0.1
                });
            }
        }

        function drawParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p, i) => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(15, 23, 42, ${p.alpha * 0.4})`; // Slate 900, subtle
                ctx.fill();

                // Connect nearby particles with lines
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = p.x - particles[j].x;
                    const dy = p.y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(14, 165, 233, ${0.08 * (1 - dist / 120)})`; // Sky 500, very subtle
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            });
            animId = requestAnimationFrame(drawParticles);
        }

        resizeCanvas();
        createParticles();
        drawParticles();
        window.addEventListener('resize', () => { resizeCanvas(); createParticles(); });
    }

    // ==========================================
    // 9. HERO TYPING EFFECT
    // ==========================================
    const typingEl = document.getElementById('heroTyping');
    if (typingEl) {
        const phrases = JSON.parse(typingEl.dataset.phrases || '[]');
        let phraseIdx = 0, charIdx = 0, isDeleting = false;

        function typeLoop() {
            if (!phrases.length) return;
            const current = phrases[phraseIdx];
            if (!isDeleting) {
                typingEl.textContent = current.substring(0, charIdx + 1);
                charIdx++;
                if (charIdx === current.length) {
                    setTimeout(() => { isDeleting = true; typeLoop(); }, 2000);
                    return;
                }
                setTimeout(typeLoop, 60);
            } else {
                typingEl.textContent = current.substring(0, charIdx - 1);
                charIdx--;
                if (charIdx === 0) {
                    isDeleting = false;
                    phraseIdx = (phraseIdx + 1) % phrases.length;
                    setTimeout(typeLoop, 400);
                    return;
                }
                setTimeout(typeLoop, 30);
            }
        }
        setTimeout(typeLoop, 1000);
    }

    // ==========================================
    // 10. BUILD & PRICE CONFIGURATOR
    // Sell rates (IDR/m²) derived from ILO's Bali rate
    // database (Apr 2026): coded DB takeoff for a
    // representative build + 5% contingency + standard
    // margin, cross-checked against the client guidance
    // band of Rp 7–11M/m² for full-build villas.
    // ==========================================
    const cfgArea = document.getElementById('cfgArea');
    const cfgFloors = document.getElementById('cfgFloors');
    if (cfgArea && cfgFloors) {
        const RATES = {
            villa: { structure: 2500000, shell: 4300000, turnkey: 7200000, premium: 10500000 },
            townhouse: { structure: 2300000, shell: 4000000, turnkey: 6800000, premium: 9500000 },
            commercial: { structure: 1900000, shell: 2800000, turnkey: 4500000, premium: 6000000 },
        };
        const TIER_DESC = {
            structure: 'Engineered LGS frame, floor cassettes, roof structure & sheeting on your foundations.',
            shell: 'Weather-tight lockup: frame, ILO envelope system, roofing, doors & windows.',
            turnkey: 'Complete build: frame, envelope, interiors, MEP, tiling — move-in ready.',
            premium: 'Turnkey with premium finishes: stone, timber cladding, upgraded sanitary & joinery.',
        };
        const TYPE_LABEL = { villa: 'Villa', townhouse: 'Townhouse', commercial: 'Commercial building' };
        const TIER_LABEL = { structure: 'Frame & Roof', shell: 'Lockup Shell', turnkey: 'Turnkey', premium: 'Turnkey Premium' };
        const FX = { USD: 16300, AUD: 10700 }; // indicative
        const SPREAD = 0.12;

        let type = 'villa', tier = 'turnkey';
        // Default the price currency to the visitor's locale so the headline
        // number is readable on first paint (added 2026-07-13): Indonesian
        // visitors see IDR, Australia/NZ see AUD, everyone else sees USD.
        const _lang = (navigator.language || '').toLowerCase();
        let currency = _lang.startsWith('id') ? 'IDR'
            : (_lang === 'en-au' || _lang === 'en-nz') ? 'AUD'
            : 'USD';

        const areaVal = document.getElementById('cfgAreaVal');
        const floorsVal = document.getElementById('cfgFloorsVal');
        const amountEl = document.getElementById('cfgAmount');
        const amountSubEl = document.getElementById('cfgAmountSub');
        const tierDescEl = document.getElementById('cfgTierDesc');
        const timeEl = document.getElementById('cfgTime');
        const timeTradEl = document.getElementById('cfgTimeTrad');
        const timeSavedEl = document.getElementById('cfgTimeSaved');
        const steelEl = document.getElementById('cfgSteel');
        const waBtn = document.getElementById('cfgWhatsApp');
        const configField = document.getElementById('cfgConfigField');

        const segInit = (id, onPick) => {
            const wrap = document.getElementById(id);
            wrap?.querySelectorAll('.seg').forEach(btn => {
                btn.addEventListener('click', () => {
                    wrap.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    onPick(btn.dataset.val);
                    update();
                });
            });
        };
        segInit('cfgType', v => { type = v; });
        segInit('cfgTier', v => { tier = v; });
        segInit('cfgCurrency', v => { currency = v; });

        // Reflect the locale-detected default in the currency toggle UI so the
        // active button matches the number shown.
        document.querySelectorAll('#cfgCurrency .seg').forEach(b =>
            b.classList.toggle('active', b.dataset.val === currency));

        const fmtIDR = (n) => {
            if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' Miliar';
            return Math.round(n / 1e6) + ' Juta';
        };
        const fmtRangeIn = (cur, lo, hi) => {
            if (cur === 'IDR') return 'Rp ' + fmtIDR(lo) + ' – ' + fmtIDR(hi);
            const sym = cur === 'USD' ? '$' : 'A$';
            const k = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.round(n / 1e3) + 'k';
            return sym + k(lo / FX[cur]) + ' – ' + sym + k(hi / FX[cur]);
        };
        const fmtRange = (lo, hi) => fmtRangeIn(currency, lo, hi);

        function update() {
            const area = parseInt(cfgArea.value);
            const floors = parseInt(cfgFloors.value);
            const total = area; // slider = total floor area
            if (areaVal) areaVal.textContent = area + ' m²';
            if (floorsVal) floorsVal.textContent = floors + (floors === 1 ? ' Floor' : ' Floors');

            const rate = RATES[type][tier];
            const mid = total * rate;
            const lo = mid * (1 - SPREAD), hi = mid * (1 + SPREAD);
            if (amountEl) amountEl.textContent = fmtRange(lo, hi);
            // Show the other currency beneath: Rp keeps the local-price
            // transparency signal for foreign viewers, A$ for IDR viewers.
            if (amountSubEl) amountSubEl.textContent = '≈ ' + fmtRangeIn(currency === 'IDR' ? 'AUD' : 'IDR', lo, hi);
            if (tierDescEl) tierDescEl.textContent = TIER_DESC[tier];

            // Timeline: panelised LGS vs conventional (2–3× faster claim → 2.4×)
            const tierSpeed = { structure: 80, shell: 55, turnkey: 40, premium: 36 };
            const baseWeeks = { structure: 3, shell: 5, turnkey: 7, premium: 8 };
            const speedFactor = type === 'commercial' ? 1.25 : 1;
            const lgsWeeks = Math.ceil(baseWeeks[tier] + total / (tierSpeed[tier] * speedFactor));
            const tradWeeks = Math.ceil(lgsWeeks * 2.4);
            const monthsSaved = Math.max(1, Math.round((tradWeeks - lgsWeeks) / 4.33));
            if (timeEl) timeEl.textContent = '~' + lgsWeeks + ' wks';
            if (timeTradEl) timeTradEl.textContent = '~' + tradWeeks + ' wks';
            if (timeSavedEl) timeSavedEl.textContent = monthsSaved + (monthsSaved === 1 ? ' month' : ' months');

            // Frame steel ~10 kg/m² of floor area
            const tonnes = (total * 10) / 1000;
            if (steelEl) steelEl.textContent = '~' + (tonnes < 10 ? tonnes.toFixed(1) : Math.round(tonnes)) + ' t';

            const priceStr = fmtRange(lo, hi) + (currency === 'IDR' ? '' : ' (≈ ' + fmtRangeIn('IDR', lo, hi) + ')');
            const summary = TIER_LABEL[tier] + ' ' + TYPE_LABEL[type].toLowerCase() + ', ' + area + ' m² over ' +
                floors + (floors === 1 ? ' floor' : ' floors') + ' ≈ ' + priceStr +
                ' (~' + lgsWeeks + ' weeks)';
            if (configField) configField.value = summary;
            if (waBtn) {
                waBtn.href = 'https://wa.me/6285739888885?text=' + encodeURIComponent(
                    'Hi ILO, I configured a build on the ILO website:\n\n' + summary +
                    '\n\nPlease send me an exact quote.');
            }
        }

        cfgArea.addEventListener('input', update);
        cfgFloors.addEventListener('input', update);
        update();

        // "Email me this estimate" capture
        const cfgEmailForm = document.getElementById('cfgEmailForm');
        if (cfgEmailForm) {
            cfgEmailForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const btn = cfgEmailForm.querySelector('button');
                const original = btn.textContent;
                btn.textContent = '…';
                btn.disabled = true;
                netlifySubmit(cfgEmailForm).then(() => {
                    btn.textContent = '✓ Sent';
                    btn.style.background = 'var(--color-success)';
                    setTimeout(() => {
                        btn.textContent = original; btn.style.background = '';
                        btn.disabled = false; cfgEmailForm.querySelector('input[type=email]').value = '';
                    }, 3000);
                }).catch(() => {
                    btn.textContent = '⚠'; btn.disabled = false;
                    setTimeout(() => { btn.textContent = original; }, 4000);
                });
            });
        }
    }

    // ==========================================
    // 11. TESTIMONIAL CAROUSEL
    // ==========================================
    const track = document.querySelector('.testimonials-track');
    const dots = document.querySelectorAll('.testimonials-nav button');
    if (track && dots.length) {
        let currentSlide = 0;
        const cards = track.querySelectorAll('.testimonial-card');
        const total = cards.length;
        let autoSlideTimer;

        function goToSlide(idx) {
            currentSlide = idx;
            track.style.transform = `translateX(-${idx * 100}%)`;
            dots.forEach((d, i) => d.classList.toggle('active', i === idx));
        }

        dots.forEach((dot, i) => {
            dot.addEventListener('click', () => {
                goToSlide(i);
                resetAutoSlide();
            });
        });

        function autoSlide() {
            autoSlideTimer = setInterval(() => {
                goToSlide((currentSlide + 1) % total);
            }, 5000);
        }

        function resetAutoSlide() {
            clearInterval(autoSlideTimer);
            autoSlide();
        }

        goToSlide(0);
        autoSlide();
    }

    // ==========================================
    // 12. EXIT-INTENT POPUP (Lead Magnet)
    // ==========================================
    const exitPopup = document.getElementById('exitPopup');
    if (exitPopup) {
        let popupShown = sessionStorage.getItem('exitPopupShown');

        // Show on mouse leaving viewport top (desktop) — genuine exit intent only.
        // No timed fallback: an uninvited popup mid-read costs more leads than it captures.
        document.addEventListener('mouseleave', (e) => {
            if (e.clientY < 10 && !popupShown) {
                showExitPopup();
            }
        });

        function showExitPopup() {
            exitPopup.classList.add('active');
            popupShown = true;
            sessionStorage.setItem('exitPopupShown', 'true');
        }

        // Close handlers
        exitPopup.querySelector('.modal-close')?.addEventListener('click', () => {
            exitPopup.classList.remove('active');
        });

        exitPopup.addEventListener('click', (e) => {
            if (e.target === exitPopup) exitPopup.classList.remove('active');
        });

        // Exit popup form
        const exitForm = document.getElementById('exitPopupForm');
        if (exitForm) {
            exitForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const btn = exitForm.querySelector('button');
                const original = btn.textContent;
                btn.textContent = 'Sending…';
                btn.disabled = true;
                netlifySubmit(exitForm).then(() => {
                    btn.textContent = '✓ Guide on its way!';
                    btn.style.background = 'var(--color-success)';
                    setTimeout(() => exitPopup.classList.remove('active'), 2000);
                }).catch(() => {
                    btn.textContent = '⚠ Failed — try again';
                    btn.disabled = false;
                    setTimeout(() => { btn.textContent = original; }, 5000);
                });
            });
        }
    }

    // ==========================================
    // 13. LEAD MAGNET MODAL (Free Guide)
    // ==========================================
    const guideModal = document.getElementById('guideModal');
    if (guideModal) {
        document.querySelectorAll('[data-open-guide]').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                guideModal.classList.add('active');
            });
        });

        guideModal.querySelector('.modal-close')?.addEventListener('click', () => {
            guideModal.classList.remove('active');
        });

        guideModal.addEventListener('click', (e) => {
            if (e.target === guideModal) guideModal.classList.remove('active');
        });

        const guideForm = document.getElementById('guideForm');
        if (guideForm) {
            guideForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const btn = guideForm.querySelector('button');
                const original = btn.textContent;
                btn.textContent = 'Sending…';
                btn.disabled = true;
                netlifySubmit(guideForm).then(() => {
                    btn.textContent = '✓ Check your inbox!';
                    btn.style.background = 'var(--color-success)';
                    setTimeout(() => guideModal.classList.remove('active'), 2000);
                }).catch(() => {
                    btn.textContent = '⚠ Failed — try again';
                    btn.disabled = false;
                    setTimeout(() => { btn.textContent = original; }, 5000);
                });
            });
        }
    }

    // ==========================================
    // 14. STICKY BOTTOM CTA BAR
    // ==========================================
    const stickyCta = document.querySelector('.sticky-cta');
    if (stickyCta) {
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            const heroHeight = document.querySelector('.hero, .page-hero')?.offsetHeight || 600;
            // Show after scrolling past the hero, hide when back up
            if (scrollY > heroHeight && scrollY > lastScroll) {
                stickyCta.classList.add('visible');
            } else if (scrollY < heroHeight * 0.5) {
                stickyCta.classList.remove('visible');
            }
            lastScroll = scrollY;
        }, { passive: true });
    }

    // ==========================================
    // 15. INLINE LEAD FORMS
    // ==========================================
    document.querySelectorAll('.inline-lead-form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            const original = btn.textContent;
            btn.textContent = 'Sending…';
            btn.disabled = true;
            netlifySubmit(form).then(() => {
                btn.textContent = '✓ We\'ll be in touch!';
                btn.style.background = 'var(--color-success)';
                setTimeout(() => {
                    btn.textContent = original;
                    btn.style.background = '';
                    btn.disabled = false;
                    form.reset();
                }, 3000);
            }).catch(() => {
                btn.textContent = '⚠ Failed — try again';
                btn.disabled = false;
                setTimeout(() => { btn.textContent = original; }, 5000);
            });
        });
    });

    // ==========================================
    // 15.2 NEWSLETTER SUBSCRIBE FORM
    // ==========================================
    document.querySelectorAll('form[name="newsletter"]').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            const original = btn.textContent;
            btn.textContent = 'Subscribing…';
            btn.disabled = true;
            netlifySubmit(form).then(() => {
                btn.textContent = '✓ Subscribed!';
                btn.style.background = 'var(--color-success)';
                form.reset();
                setTimeout(() => {
                    btn.textContent = original;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 3000);
            }).catch(() => {
                btn.textContent = '⚠ Try again';
                btn.disabled = false;
                setTimeout(() => { btn.textContent = original; }, 5000);
            });
        });
    });

    // ==========================================
    // 15.5 MAGIC HOUSE INTERACTIVE TRIGGER
    // ==========================================
    const buildHouseBtn = document.getElementById('buildHouseBtn');
    const magicScene = document.getElementById('magicScene');
    const magicTriggerOverlay = document.getElementById('magicTriggerOverlay');

    if (buildHouseBtn && magicScene && magicTriggerOverlay) {
        buildHouseBtn.addEventListener('click', () => {
            // Hide the overlay
            magicTriggerOverlay.classList.add('hidden');
            // Adding active class triggers all the CSS animations defined in magic-house.css
            magicScene.classList.add('active');

            // Show a "Replay Assembly" option after it completes (approx 5-6 seconds)
            setTimeout(() => {
                magicTriggerOverlay.innerHTML = `
                    <button class="btn btn-secondary" id="replayHouseBtn" style="gap:8px; display:flex; align-items:center;">
                        <span style="font-size:1.2rem;">🔄</span> Replay Assembly
                    </button>
                `;
                magicTriggerOverlay.classList.remove('hidden');

                document.getElementById('replayHouseBtn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Reset animations by forcing DOM reflow
                    magicScene.classList.remove('active');
                    void magicScene.offsetWidth; // Trigger reflow
                    magicScene.classList.add('active');
                    magicTriggerOverlay.classList.add('hidden');
                });
            }, 6000);
        });
    }

    // ==========================================
    // 15.8 REEL VIDEOS — play only while on screen
    // (saves data: preload="none" + IO-driven play/pause)
    // ==========================================
    const reelVideos = document.querySelectorAll('.reel-video');
    if (reelVideos.length) {
        const reelObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const v = entry.target;
                if (entry.isIntersecting) {
                    v.play().catch(() => { /* autoplay blocked: poster stays */ });
                } else {
                    v.pause();
                }
            });
        }, { threshold: 0.35 });
        reelVideos.forEach(v => reelObserver.observe(v));
    }

    // ==========================================
    // 16. VIDEO LAZY LOAD (Click to play)
    // ==========================================
    document.querySelectorAll('.video-play-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            const container = overlay.closest('.video-container');
            const videoId = container?.dataset.videoId;
            if (videoId) {
                container.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
            }
        });
    });

    // ==========================================
    // 17. 3D CARD TILT (Mouse-tracking)
    // ==========================================
    document.querySelectorAll('.card-3d .card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -8;
            const rotateY = ((x - centerX) / centerX) * 8;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

    // ==========================================
    // 18. PARALLAX ORBS (Mouse-driven)
    // ==========================================
    const orbs = document.querySelectorAll('.orb');
    if (orbs.length) {
        document.addEventListener('mousemove', (e) => {
            const mx = (e.clientX / window.innerWidth - 0.5) * 2;
            const my = (e.clientY / window.innerHeight - 0.5) * 2;
            orbs.forEach((orb, i) => {
                const speed = (i + 1) * 15;
                orb.style.transform = `translate(${mx * speed}px, ${my * speed}px)`;
            });
        }, { passive: true });
    }

    // ==========================================
    // 19. MAGNETIC BUTTONS (Subtle attraction)
    // ==========================================
    document.querySelectorAll('.btn-primary, .btn-secondary').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });

    // ==========================================
    // 20. MAILTO LINK UPGRADE (Copy to Clipboard Fallback)
    // ==========================================
    document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
        link.addEventListener('click', () => {
            const email = link.getAttribute('href').replace('mailto:', '').split('?')[0];

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(email).then(() => {
                    const originalText = link.innerText;
                    if (originalText.includes('@')) {
                        link.innerText = 'Copied to clipboard!';
                        link.style.color = 'var(--color-success)';
                        setTimeout(() => {
                            link.innerText = originalText;
                            link.style.color = '';
                        }, 2000);
                    }
                }).catch(err => console.error('Failed to copy email:', err));
            }
            // Let the default mailto behavior run as well
        });
    });

    // ==========================================
    // 21. FORCE AUTOPLAY VIDEOS
    // ==========================================
    const bgVideos = document.querySelectorAll('video[autoplay]');
    bgVideos.forEach(video => {
        video.muted = true; // Ensure explicitly muted
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("Autoplay was prevented by strict browser policies.", error);
                // Listen for first interaction to trigger video unlock
                const playOnInteract = () => {
                    video.play();
                    ['click', 'scroll', 'touchstart'].forEach(evt => document.removeEventListener(evt, playOnInteract));
                };
                ['click', 'scroll', 'touchstart'].forEach(evt => document.addEventListener(evt, playOnInteract, { once: true }));
            });
        }
    });

});

/* ===== ILO website lead capture -> bridge (HubSpot CRM + Telegram alert) ===== */
/* Fires on every Netlify form submit, in the capture phase so it runs before the
   form's own handler. Uses sendBeacon so it never blocks or delays the submission. */
(function () {
    var BRIDGE = 'https://openclaw-whatsapp-bridge-production.up.railway.app/lead';
    function captureLead(form) {
        try {
            if (!form || form.getAttribute('data-netlify') !== 'true') return;
            var fd = new FormData(form);
            var data = { formName: form.getAttribute('name') || 'website', sourceUrl: location.href };
            fd.forEach(function (v, k) { if (typeof v === 'string') data[k] = v; });
            if (data['bot-field']) return; // Netlify honeypot — skip bots
            var body = new URLSearchParams(data).toString();
            var blob = new Blob([body], { type: 'application/x-www-form-urlencoded' });
            if (navigator.sendBeacon) {
                navigator.sendBeacon(BRIDGE, blob);
            } else {
                fetch(BRIDGE, { method: 'POST', body: body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, keepalive: true, mode: 'no-cors' });
            }
        } catch (e) { /* never block the form */ }
    }
    document.addEventListener('submit', function (e) {
        var f = e.target;
        if (f && f.tagName === 'FORM') captureLead(f);
    }, true);
})();

