/* =====================================================
   LET'S CONNECT — "three panels, hidden second memories"
   Tiny and defensive:
   • main film (connect.mp4): guarantee muted autoplay,
     respect prefers-reduced-motion (park on a static
     frame), pause while the section is off-screen, slow
     cinematic 0.7 rate. It never moves.
   • side panels are two-memory REELS (c-1/c-2, c1/c2).
     Only the active memory carries a src initially — the
     hidden one arms lazily on arrow hover (pre-load) or
     click, so at most three films ever decode at once.
     Reel switches slide the track horizontally (~450ms);
     the outgoing film pauses once the slide settles.
     Reduced motion: everything parks on static frames,
     reel switches are immediate.
   Mobile never arms the side reels at all.
   ===================================================== */

(function () {

    const sec = document.querySelector(".connect-hero");
    const v = sec && sec.querySelector(".connect-hero__video:not(.connect-hero__video--side)");
    if (!sec || !v) return;

    const mqDesktop = window.matchMedia("(min-width: 641px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* autoplay policies: the muted flag must be set as a property too */
    v.muted = true;
    v.defaultMuted = true;

    /* ---- video missing / broken → deep-green fallback stage ----
       With <source> children the error fires on the SOURCE element
       (not the video, and it does not bubble) — and it can fire before
       this script even runs. So: capture-phase listener on the section
       catches late errors, and networkState catches already-dead ones. */
    const fail = () => sec.classList.add("connect-hero--novideo");
    if (v.error || v.networkState === 3 /* NETWORK_NO_SOURCE */) fail();
    sec.addEventListener("error", fail, true);
    v.addEventListener("error", fail);

    /* ---- slow, cinematic playback (file itself untouched) ---- */
    const RATE = 0.7;
    const applyRate = () => { try { v.defaultPlaybackRate = RATE; v.playbackRate = RATE; } catch (e) { /* ignore */ } };
    if (v.readyState >= 1) applyRate();
    v.addEventListener("loadedmetadata", applyRate);
    v.addEventListener("play", applyRate);

    /* =====================================================
       SIDE REELS — c-1/c-2 and c1/c2
       ===================================================== */

    const playVideo = sv => {
        if (!sv) return;
        const p = sv.play();
        if (p && p.catch) p.catch(() => { /* blocked — fine */ });
    };

    /* assign the src the first time a film is actually needed */
    const armVideo = sv => {
        if (!sv || sv.dataset.armed) return;
        sv.dataset.armed = "1";
        sv.muted = true;
        sv.defaultMuted = true;
        sv.src = sv.dataset.srcSide;
        if (reduce) {
            /* static frame, never motion */
            sv.preload = "metadata";
            sv.addEventListener("loadedmetadata", () => {
                try { sv.currentTime = 0.1; } catch (e) { /* ignore */ }
            }, { once: true });
        }
        sv.load();
    };

    const reels = Array.from(sec.querySelectorAll(".connect-reel")).map(el => ({
        el,
        track: el.querySelector(".connect-reel__track"),
        nav: el.querySelector(".connect-reel__nav"),
        slides: Array.from(el.querySelectorAll(".connect-reel__slide"))
            .map(s => s.querySelector(".connect-hero__video--side")),
        idx: 0,
        settle: 0,          // pending "pause the outgoing film" timer
    }));

    const LABEL = [
        "Show the next memory clip",
        "Back to the previous memory clip",
    ];

    const playActive = reel => {
        const sv = reel.slides[reel.idx];
        playVideo(sv);
        sv.addEventListener("playing", () => sv.classList.add("is-on"), { once: true });
    };

    const pauseAll = reel => reel.slides.forEach(sv => sv.pause());

    /* the film this reel would navigate TO right now */
    const peekNext = reel => reel.slides[1 - reel.idx];

    const go = (reel, nextIdx) => {
        if (nextIdx === reel.idx || nextIdx < 0 || nextIdx >= reel.slides.length) return;
        const incoming = reel.slides[nextIdx];
        const outgoing = reel.slides[reel.idx];

        armVideo(incoming);                 // lazy src (usually already pre-armed)
        playVideo(incoming);
        incoming.addEventListener("playing", () => incoming.classList.add("is-on"), { once: true });

        reel.track.style.transform = "translateX(" + (nextIdx ? -50 : 0) + "%)";

        clearTimeout(reel.settle);
        reel.settle = setTimeout(() => {    // pause the outgoing film once the slide settles
            if (!reduce) outgoing.pause();
        }, 480);

        reel.idx = nextIdx;
        reel.el.classList.toggle("is-flipped", nextIdx === 1);
        reel.nav.setAttribute("aria-label", LABEL[nextIdx]);
    };

    reels.forEach(reel => {
        /* hover / focus on the arrow pre-arms the hidden film —
           by click time it is usually already buffered */
        const preArm = () => armVideo(peekNext(reel));
        reel.nav.addEventListener("mouseenter", preArm);
        reel.nav.addEventListener("focus", preArm);
        reel.nav.addEventListener("click", () => go(reel, 1 - reel.idx));
    });

    /* arm only the two currently-visible side films */
    const armActives = () => {
        if (!mqDesktop.matches) return;     // mobile never downloads them
        reels.forEach(reel => armVideo(reel.slides[reel.idx]));
    };

    const playActives = () => reels.forEach(playActive);

    /* =====================================================
       VISIBILITY — pause everything when far off-screen
       ===================================================== */

    let visible = true;

    /* ---- reduced motion: park EVERYTHING on single frames ---- */
    if (reduce) {
        v.removeAttribute("autoplay");
        v.loop = false;
        v.preload = "metadata";
        v.pause();
        const frame = () => {
            try { v.currentTime = 0.1; } catch (e) { /* ignore */ }
        };
        if (v.readyState >= 1) frame();
        else v.addEventListener("loadedmetadata", frame, { once: true });
        armActives();       // the two visible side films become static frames too
        return;
    }

    const wake = () => {
        v.play().catch(() => { /* blocked — fine */ });
        if (mqDesktop.matches) playActives();
    };
    const sleep = () => {
        v.pause();
        reels.forEach(pauseAll);
    };

    mqDesktop.addEventListener ? mqDesktop.addEventListener("change", e => {
        if (e.matches) {
            armActives();
            if (visible) wake();
        } else {
            sleep();        // switched to mobile: stop all side decode
        }
    }) : mqDesktop.addListener(e => e.matches ? wake() : sleep());

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            entries.forEach(e => {
                visible = e.isIntersecting;
                if (visible) {
                    armActives();   // near the viewport → the two active reels may load
                    wake();
                } else {
                    sleep();
                }
            });
        }, { rootMargin: "240px 0px", threshold: 0.01 }).observe(sec);
    } else {
        wake();
    }

})();
