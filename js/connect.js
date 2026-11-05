/* =====================================================
   LET'S CONNECT — background film handling
   Tiny and defensive: guarantee muted autoplay, respect
   prefers-reduced-motion (static frame instead of a
   looping film), pause while the section is off-screen,
   slow cinematic playback, and a YouTube-style ambient
   light layer on desktop.

   Ambient mode: NO second video. A tiny canvas (~144px
   wide) copy-draws the visible film's frame a couple of
   times a second-batch; CSS covers it over the section,
   scales it past the edges and blurs it into pure moving
   colour. Being fed from the same video element it is
   perfectly synchronised, and the decode cost is zero.
   ===================================================== */

(function () {

    const sec = document.querySelector(".connect-hero");
    const v = sec && sec.querySelector(".connect-hero__video");
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

    /* ---- slow, cinematic playback (file itself untouched) ----
       Set as both playbackRate and defaultPlaybackRate, re-applied on
       loadedmetadata/play, so it stays 0.7 even if the media reloads
       or the film loops. */
    const RATE = 0.7;
    const applyRate = () => { try { v.defaultPlaybackRate = RATE; v.playbackRate = RATE; } catch (e) { /* ignore */ } };
    if (v.readyState >= 1) applyRate();
    v.addEventListener("loadedmetadata", applyRate);
    v.addEventListener("play", applyRate);

    /* ---- ambient light layer (desktop only) ---- */
    const ac = sec.querySelector(".connect-hero__ambient");
    const actx = ac && ac.getContext("2d");

    const drawAmbient = () => {
        if (!actx || !mqDesktop.matches || v.readyState < 2) return;
        try { actx.drawImage(v, 0, 0, ac.width, ac.height); } catch (e) { /* frame not ready */ }
    };
    const sizeAmbient = () => {
        if (!actx) return;
        const ratio = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 9 / 16;
        ac.width = 144;
        ac.height = Math.max(1, Math.round(144 / ratio));
    };

    let visible = true;   // section within the viewport?

    if (reduce) {
        /* ---- reduced motion: park on a single frame, never loop ---- */
        v.removeAttribute("autoplay");
        v.loop = false;
        v.preload = "metadata";
        v.pause();
        // force the first frame to actually paint
        const frame = () => {
            try { v.currentTime = 0.1; } catch (e) { /* ignore */ }
        };
        if (v.readyState >= 1) frame();
        else v.addEventListener("loadedmetadata", frame, { once: true });
        // one ambient draw once the parked frame is decodable
        const once = () => {
            if (!ac.width) sizeAmbient();
            drawAmbient();
        };
        sizeAmbient();
        v.addEventListener("loadeddata", once, { once: true });
        v.addEventListener("seeked", once, { once: true });
        return;
    }

    /* ---- normal: pause the film while the section is off-screen ---- */

    /* The ambient layer runs on a plain interval (~15fps) rather than
       rAF: it paints a heavily blurred tiny canvas, so smoothness is a
       non-goal, and an interval stays reliable even when the browser
       suspends rAF (occluded windows) — while the tab itself is hidden
       the interval is throttled by the browser, i.e. it pauses for free. */
    let ambientTimer = 0;

    const startAmbient = () => {
        if (!ambientTimer && visible && mqDesktop.matches && !reduce) {
            ambientTimer = setInterval(drawAmbient, 66);
        }
    };
    const stopAmbient = () => { if (ambientTimer) { clearInterval(ambientTimer); ambientTimer = 0; } };

    const sizeNow = () => {
        if (v.videoWidth) sizeAmbient();   // canvas defaults to 300x150 — always (re)size
        if (v.readyState >= 2) drawAmbient();
        startAmbient();
    };
    v.addEventListener("loadedmetadata", sizeNow);
    v.addEventListener("loadeddata", sizeNow);

    mqDesktop.addEventListener ? mqDesktop.addEventListener("change", e => {
        if (e.matches) { sizeAmbient(); startAmbient(); } else stopAmbient();
    }) : mqDesktop.addListener(e => e.matches ? startAmbient() : stopAmbient());

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            entries.forEach(e => {
                visible = e.isIntersecting;
                if (visible) {
                    v.play().catch(() => { /* blocked — fine */ });
                    startAmbient();
                } else {
                    v.pause();
                    stopAmbient();
                }
            });
        }, { threshold: 0.05 }).observe(sec);
    } else {
        startAmbient();
    }

})();
