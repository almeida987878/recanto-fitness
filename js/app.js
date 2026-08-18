(() => {
  'use strict';

  const WA_NUMBER = '5511940312343'; // (11) 94031-2343

  /* ---------- WhatsApp links ---------- */
  function wireWhatsAppLinks() {
    document.querySelectorAll('[data-wa]').forEach((el) => {
      const msg = el.getAttribute('data-wa-msg') || 'Olá! Vi o site da Recanto Fitness e gostaria de saber mais sobre os planos e valores da academia.';
      el.setAttribute('href', `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
    });
  }

  /* ---------- Mobile menu ---------- */
  function wireMobileMenu() {
    const toggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('mobile-nav');
    if (!toggle || !nav) return;

    const close = () => {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('nav-open');
      document.body.style.overflow = '';
    };
    const open = () => {
      toggle.setAttribute('aria-expanded', 'true');
      nav.classList.add('nav-open');
      document.body.style.overflow = 'hidden';
    };

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      isOpen ? close() : open();
    });
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  }

  /* ---------- Header state on scroll ---------- */
  function wireHeader() {
    const header = document.getElementById('site-header');
    const introSection = document.getElementById('brand-intro');
    if (!header) return;

    // Thresholds as a fraction of the *scrollable* distance through the
    // pinned intro (its own height minus the 100vh it stays pinned for) —
    // not the raw section height — so "visible" lands mid-reveal (team video
    // taking over) and "scrolled" lands right as the pin is about to release
    // into the Hero, regardless of how tall the intro's runway is.
    function thresholds() {
      if (!introSection) return { show: window.innerHeight * 0.12, solid: window.innerHeight * 0.85 };
      const scrollable = Math.max(introSection.offsetHeight - window.innerHeight, 1);
      return { show: scrollable * 0.45, solid: scrollable * 0.98 };
    }
    let t = thresholds();
    window.addEventListener('resize', () => { t = thresholds(); });

    let ticking = false;
    function update() {
      const y = window.scrollY;
      header.classList.toggle('header-visible', y > t.show);
      header.classList.toggle('header-scrolled', y > t.solid);
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  /* ---------- Belt-and-suspenders autoplay for a muted video ----------
     Forces the muted/playsInline *properties* (not just HTML attributes —
     some mobile browsers only honor the former once JS touches the element),
     attempts play() immediately, and retries once on the visitor's first
     touch/scroll/click if a stricter policy blocked it. Silent either way,
     so this isn't the kind of gesture-gated playback such policies guard. */
  function setupAutoplay(video) {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const events = ['touchstart', 'click', 'scroll'];
    const onGesture = () => tryPlay();
    function tryPlay() {
      const p = video.play();
      if (p && typeof p.then === 'function') {
        p.then(stopRetrying).catch(() => {});
      } else {
        stopRetrying();
      }
    }
    function stopRetrying() { events.forEach((evt) => window.removeEventListener(evt, onGesture)); }

    tryPlay();
    events.forEach((evt) => window.addEventListener(evt, onGesture, { passive: true }));
    return tryPlay;
  }

  /* ---------- Brand intro: logo → team-video portal reveal → handoff ----------
     A tall pinned (`position: sticky`) section. Scroll progress through its
     scrollable distance (own height − 100vh) drives every stage as a single
     0→1 timeline — matches the choreography sketched in css/style.css's
     .brand-intro comment. */
  function wireBrandIntro() {
    const section = document.getElementById('brand-intro');
    const logoStage = document.getElementById('logo-stage');
    const logoVideo = document.getElementById('logo-video');
    const teamVideo = document.getElementById('team-video');
    const teamFrame = document.getElementById('team-video-frame');
    const teamOverlay = document.getElementById('team-video-overlay');
    const teamCopy = document.getElementById('team-copy');
    const handoff = document.getElementById('brand-intro-handoff');
    const cue = document.getElementById('brand-intro-cue');
    if (!section || !logoVideo || !teamVideo) return;

    const tryPlayLogo = setupAutoplay(logoVideo);
    const tryPlayTeam = setupAutoplay(teamVideo);

    // Pause both when the whole intro scrolls out of view; resume in place
    // (no restart) when it's back — same technique as the rest of the site.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            tryPlayLogo();
            tryPlayTeam();
          } else {
            logoVideo.pause();
            teamVideo.pause();
          }
        });
      }, { threshold: 0.05 });
      io.observe(section);
    }

    // The reduced-motion fallback (final frame, no motion, no pin) lives
    // entirely in CSS — nothing left to drive here.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const isMobile = window.matchMedia('(max-width: 720px)').matches;
    const portalStart = isMobile ? { w: 80, h: 42, r: 18 } : { w: 68, h: 68, r: 26 };

    // Stage breakpoints, as fractions of the 0→1 pinned-scroll progress.
    const P = {
      logoScaleStart: 0.20, logoFadeStart: 0.35, logoFadeEnd: 0.42,
      teamAppearStart: 0.38, teamAppearEnd: 0.48,
      expandStart: 0.40, expandEnd: 0.85,
      copyStart: 0.83, copyEnd: 0.93,
      handoffStart: 0.95, handoffEnd: 1.0,
      cueFadeEnd: 0.15,
    };

    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
    const stageT = (p, start, end) => clamp01((p - start) / (end - start));

    let ticking = false;
    function update() {
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      const progress = clamp01(-rect.top / Math.max(scrollable, 1));

      // Etapa 1 — logo: scale up slightly, then fade.
      const scaleT = stageT(progress, P.logoScaleStart, P.logoFadeEnd);
      logoVideo.style.transform = `scale(${lerp(1, 1.12, scaleT)})`;
      const fadeT = stageT(progress, P.logoFadeStart, P.logoFadeEnd);
      if (logoStage) logoStage.style.opacity = String(1 - fadeT);

      // Etapa 2 — team video: fades in small, behind the logo, then the
      // portal expands to full screen with its corners squaring off.
      const appearT = stageT(progress, P.teamAppearStart, P.teamAppearEnd);
      teamFrame.style.opacity = String(appearT);

      const expandT = stageT(progress, P.expandStart, P.expandEnd);
      teamFrame.style.width = `${lerp(portalStart.w, 100, expandT)}vw`;
      teamFrame.style.height = `${lerp(portalStart.h, 100, expandT)}vh`;
      teamFrame.style.borderRadius = `${lerp(portalStart.r, 0, expandT)}px`;
      if (teamOverlay) teamOverlay.style.opacity = String(lerp(0, 0.5, expandT));

      // Headline copy, once the video is essentially full-screen.
      const copyT = stageT(progress, P.copyStart, P.copyEnd);
      if (teamCopy) {
        teamCopy.style.opacity = String(copyT);
        teamCopy.style.transform = `translateY(${lerp(30, 0, copyT)}px)`;
      }

      // Final blackout, handing off to the Hero underneath once the pin releases.
      const handoffT = stageT(progress, P.handoffStart, P.handoffEnd);
      if (handoff) handoff.style.opacity = String(handoffT * 0.92);

      // Scroll cue only makes sense on the very first frame.
      if (cue) cue.style.opacity = String(1 - stageT(progress, 0, P.cueFadeEnd));

      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  /* ---------- Hero: parallax background + content fade on scroll ---------- */
  function wireHeroParallax() {
    const section = document.querySelector('.hero');
    const bg = section ? section.querySelector('.hero-bg img') : null;
    const content = section ? section.querySelector('.hero-content') : null;
    if (!section || !bg) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    // Content starts as a `.reveal` element with an on-load fade-up transition
    // that only plays once Hero actually scrolls into view (it now sits below
    // the brand intro's tall pinned runway, so it's off-screen at page load).
    // Don't fight that transition with per-frame scroll updates — wait for it
    // to finish (or a fallback timer, armed only once Hero is visible) first.
    let heroEntranceDone = false;
    if (content) {
      content.addEventListener('transitionend', () => { heroEntranceDone = true; }, { once: true });
      if ('IntersectionObserver' in window) {
        const entranceIO = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setTimeout(() => { heroEntranceDone = true; }, 900);
              entranceIO.disconnect();
            }
          });
        }, { threshold: 0.1 });
        entranceIO.observe(content);
      } else {
        heroEntranceDone = true;
      }
    }

    let ticking = false;
    function update() {
      const rect = section.getBoundingClientRect();
      const h = rect.height || window.innerHeight;
      // progress: 0 while hero fills the viewport, 1 once it has fully scrolled past
      const progress = Math.min(Math.max(-rect.top / h, 0), 1);
      // Background drifts slower than the page (classic parallax depth cue).
      bg.style.transform = `translateY(${progress * 14}%) scale(${1 + progress * 0.06})`;
      // Content eases out and lifts slightly as the next section takes over.
      if (content && heroEntranceDone) {
        content.style.transition = 'none';
        content.style.opacity = String(Math.max(1 - progress * 1.6, 0));
        content.style.transform = `translateY(${progress * -40}px)`;
      }
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  /* ---------- Showcase (Estrutura/Galeria editorial): entrance + parallax ---------- */
  function wireShowcaseReveal() {
    const blocks = document.querySelectorAll('.showcase-block');
    if (!blocks.length) return;

    if (!('IntersectionObserver' in window)) {
      blocks.forEach((el) => el.classList.add('in-view'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -80px 0px' });
    blocks.forEach((el) => io.observe(el));
  }

  function wireShowcaseParallax() {
    const items = document.querySelectorAll('.showcase .parallax-img');
    if (!items.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Skip the continuous scroll listener on small screens — the section already
    // simplifies to stacked, non-overlapping images there (see CSS), and mobile
    // is where a scroll-driven rAF loop is most likely to feel like jank.
    const isMobile = window.matchMedia('(max-width: 720px)').matches;
    if (reduceMotion || isMobile) return;

    let ticking = false;
    function update() {
      const vh = window.innerHeight;
      items.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        // -1 (above viewport) .. 0 (centered) .. 1 (below viewport)
        const offset = Math.max(-1, Math.min(1, (center - vh / 2) / vh));
        el.style.transform = `translateY(${offset * -22}px)`;
      });
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  /* ---------- Diferenciais: interactive list ↔ visual panel ----------
     Desktop: hover/click/focus on a list item crossfades the shared image
     panel on the right. Mobile: the same panel node is physically relocated
     (no duplicate images) into the active item's own accordion slot. */
  function wireDifferentials() {
    const section = document.getElementById('differentials');
    if (!section) return;
    const items = Array.from(section.querySelectorAll('.diff-item'));
    const wraps = Array.from(section.querySelectorAll('.diff-item-wrap'));
    const slides = Array.from(section.querySelectorAll('.diff-slide'));
    const visual = document.getElementById('diff-visual');
    const desktopMount = section.querySelector('.differentials-visual-col');
    if (!items.length || !visual || !desktopMount) return;

    const mobileQuery = window.matchMedia('(max-width: 1024px)');
    let activeIndex = -1; // -1 forces the first setActive() call to run the full sync

    function slotFor(wrap) { return wrap.querySelector('.diff-item-mobile-slot'); }

    // Mobile accordion height: JS-measured max-height rather than a pure-CSS
    // grid-rows trick (aspect-ratio + a 0fr track proved unreliable — the row
    // wouldn't collapse fully and the image spilled into the next item).
    function syncMobileSlots() {
      wraps.forEach((wrap, i) => {
        const slot = slotFor(wrap);
        if (!slot) return;
        slot.style.maxHeight = (mobileQuery.matches && i === activeIndex)
          ? `${slot.scrollHeight}px`
          : '0px';
      });
    }

    function placeVisualPanel() {
      if (mobileQuery.matches) {
        const slot = wraps[activeIndex] && slotFor(wraps[activeIndex]);
        if (slot && visual.parentElement !== slot) slot.appendChild(visual);
      } else if (visual.parentElement !== desktopMount) {
        desktopMount.appendChild(visual);
      }
      // Measure after the node lands in its new parent (scrollHeight depends
      // on the image actually being inside the slot being measured).
      requestAnimationFrame(syncMobileSlots);
    }

    function setActive(index) {
      // Same redundant-triple-firing guard as wireAulas below (mouseenter +
      // focus + click all call this per click) — still re-place/measure the
      // mobile panel even for a same-index call.
      if (index === activeIndex) { placeVisualPanel(); return; }
      activeIndex = index;

      items.forEach((el, i) => {
        const active = i === index;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-selected', String(active));
      });
      wraps.forEach((el, i) => el.classList.toggle('is-open', i === index));
      slides.forEach((el, i) => el.classList.toggle('is-active', i === index));

      placeVisualPanel();
    }

    items.forEach((el, i) => {
      el.addEventListener('click', () => setActive(i));
      el.addEventListener('focus', () => setActive(i));
      el.addEventListener('mouseenter', () => {
        if (!mobileQuery.matches) setActive(i);
      });
    });

    const onBreakpointChange = () => placeVisualPanel();
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', onBreakpointChange);
    } else if (mobileQuery.addListener) {
      mobileQuery.addListener(onBreakpointChange); // Safari <14 fallback
    }
    // The active slide's image height (aspect-ratio-driven) changes with
    // viewport width, so the open slot's measured max-height needs updating too.
    window.addEventListener('resize', () => {
      if (mobileQuery.matches) requestAnimationFrame(syncMobileSlots);
    }, { passive: true });

    const initial = items.findIndex((el) => el.classList.contains('is-active'));
    setActive(initial >= 0 ? initial : 0);
  }

  /* ---------- Aulas: interactive list ↔ visual panel ----------
     Same pattern as wireDifferentials above (hover/click/focus crossfades a
     shared image panel; mobile relocates that one panel node into an
     accordion slot instead of duplicating it) — kept as its own function
     since the two sections are unrelated content, not a shared component. */
  function wireAulas() {
    const section = document.getElementById('aulas');
    if (!section) return;
    const items = Array.from(section.querySelectorAll('.aula-item'));
    const wraps = Array.from(section.querySelectorAll('.aula-item-wrap'));
    const slides = Array.from(section.querySelectorAll('.aula-slide'));
    const visual = document.getElementById('aula-visual');
    const desktopMount = section.querySelector('.aulas-visual-col');
    if (!items.length || !visual || !desktopMount) return;

    const mobileQuery = window.matchMedia('(max-width: 1024px)');
    let activeIndex = -1;

    // Some slides (Jump, Fit Dance, Pilates, Bike) are real muted videos, not
    // photos — each only plays while its own slide is the active one (saves
    // bandwidth/battery for whichever of the 8 slides aren't showing), and
    // all of them pause once the whole section scrolls out of view.
    //
    // Deliberately NOT using the shared setupAutoplay() helper here: its
    // window-level scroll/click/touchstart retry listeners are meant for a
    // single page-load video fighting an autoplay block. With up to 4 of
    // these videos alive at once, those broad listeners cross-fire on any
    // page scroll (e.g. scrolling to reach a lower list item) and race with
    // setActive()'s own play/pause calls — a real bug caught in testing, not
    // just theoretical. A click/hover selecting a slide is itself the user
    // gesture that makes play() reliable, so no retry plumbing is needed.
    const slideVideos = slides.map((slide) => {
      const video = slide.querySelector('.aula-slide-video');
      if (!video) return null;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      const tryPlay = () => video.play().catch(() => {});
      return { video, tryPlay };
    });

    if (slideVideos.some(Boolean) && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const active = slideVideos[activeIndex];
            if (active) active.tryPlay();
          } else {
            slideVideos.forEach((sv) => { if (sv) sv.video.pause(); });
          }
        });
      }, { threshold: 0.05 });
      io.observe(section);
    }

    function slotFor(wrap) { return wrap.querySelector('.aula-item-mobile-slot'); }

    function syncMobileSlots() {
      wraps.forEach((wrap, i) => {
        const slot = slotFor(wrap);
        if (!slot) return;
        slot.style.maxHeight = (mobileQuery.matches && i === activeIndex)
          ? `${slot.scrollHeight}px`
          : '0px';
      });
    }

    function placeVisualPanel() {
      if (mobileQuery.matches) {
        const slot = wraps[activeIndex] && slotFor(wraps[activeIndex]);
        if (slot && visual.parentElement !== slot) slot.appendChild(visual);
      } else if (visual.parentElement !== desktopMount) {
        desktopMount.appendChild(visual);
      }
      requestAnimationFrame(syncMobileSlots);
    }

    function setActive(index) {
      // A single click on a <button> fires mouseenter, focus AND click in
      // quick succession — all three are wired to setActive(i) with the same
      // index, so without this guard every click re-runs the whole function
      // (and every video's play()/pause()) three times over a few ms, which
      // raced badly in testing. Placing/measuring the mobile panel is the
      // one thing worth re-running even for a same-index call (e.g. after a
      // resize), so that part happens either way.
      if (index === activeIndex) { placeVisualPanel(); return; }
      activeIndex = index;

      items.forEach((el, i) => {
        const active = i === index;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-selected', String(active));
      });
      wraps.forEach((el, i) => el.classList.toggle('is-open', i === index));
      slides.forEach((el, i) => el.classList.toggle('is-active', i === index));

      slideVideos.forEach((sv, i) => {
        if (!sv) return;
        if (i === index) {
          if (sv.video.preload === 'none') sv.video.preload = 'auto';
          sv.tryPlay();
        } else {
          sv.video.pause();
        }
      });

      placeVisualPanel();
    }

    items.forEach((el, i) => {
      el.addEventListener('click', () => setActive(i));
      el.addEventListener('focus', () => setActive(i));
      el.addEventListener('mouseenter', () => {
        if (!mobileQuery.matches) setActive(i);
      });
    });

    const onBreakpointChange = () => placeVisualPanel();
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', onBreakpointChange);
    } else if (mobileQuery.addListener) {
      mobileQuery.addListener(onBreakpointChange);
    }
    window.addEventListener('resize', () => {
      if (mobileQuery.matches) requestAnimationFrame(syncMobileSlots);
    }, { passive: true });

    const initial = items.findIndex((el) => el.classList.contains('is-active'));
    setActive(initial >= 0 ? initial : 0);
  }

  /* ---------- Scroll reveal ---------- */
  function wireReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in-view'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- Counters (only runs for elements with a numeric data-count-target) ---------- */
  function wireCounters() {
    const els = document.querySelectorAll('[data-count-target]');
    if (!els.length) return;

    const animate = (el) => {
      const target = parseFloat(el.getAttribute('data-count-target'));
      if (isNaN(target)) return; // placeholder values (e.g. "XX") are left static
      const prefix = el.textContent.trim().startsWith('+') ? '+' : '';
      const duration = 1600;
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + Math.round(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- Plan prices: count up from 0 with a BRL-style "59,90" format ---------- */
  function wirePlanPrices() {
    const els = document.querySelectorAll('[data-price-target]');
    if (!els.length) return;

    const format = (v) => v.toFixed(2).replace('.', ',');

    const animate = (el) => {
      const target = parseFloat(el.getAttribute('data-price-target'));
      if (isNaN(target)) return;
      const duration = 1200;
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = format(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => { el.textContent = format(parseFloat(el.getAttribute('data-price-target')) || 0); });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireWhatsAppLinks();
    wireMobileMenu();
    wireHeader();
    wireBrandIntro();
    wireHeroParallax();
    wireShowcaseReveal();
    wireShowcaseParallax();
    wireDifferentials();
    wireAulas();
    wireReveal();
    wireCounters();
    wirePlanPrices();
  });
})();
