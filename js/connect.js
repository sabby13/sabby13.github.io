/* =====================================================
   LET'S CONNECT — "five vertical moving memories"
   Tiny and defensive:
   • main film (connect.mp4): guarantee muted autoplay,
     respect prefers-reduced-motion (park on a static
     frame), pause while the section is off-screen, slow
     cinematic 0.7 rate.
   • side fragments (c-2, c-1, c1, c2): desktop-only. They
     carry NO src in the markup — this script assigns it
     only when the section nears the viewport, so mobile
     never downloads them. They play at their natural rate
     (independent moving memories, deliberately
     unsynchronised), fade in once actually playing, and
     pause when the section leaves. Under reduced motion
     they load metadata only and park on a static frame.
   ===================================================== */

(function () {

    const sec = document.querySelector(".connect-hero");
    const v = sec && sec.querySelector(".connect-hero__video:not(.connect-hero__video--side)");
    if (!sec || !v) return;

    const mqDesktop = window.matchMedia("(min-width: 641px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sides = Array.from(sec.querySelectorAll(".connect-hero__video--side"));

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

    /* =====================================================
       SIDE FRAGMENTS — desktop only, near-viewport loading
       ===================================================== */

    let armed = false;   // srcs assigned?

    const armSides = () => {
        if (armed || !mqDesktop.matches) return;   // never download on mobile
        armed = true;
        sides.forEach(sv => {
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
        });
    };

    const playSides = () => {
        if (!armed || reduce) return;
        sides.forEach(sv => {
            const p = sv.play();
            if (p && p.catch) p.catch(() => { /* blocked — fine */ });
            sv.addEventListener("playing", () => sv.classList.add("is-on"), { once: true });
        });
    };

    const pauseSides = () => sides.forEach(sv => sv.pause());

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
        if (mqDesktop.matches) armSides();     // side fragments become static frames too
        return;
    }

    const wake = () => {
        v.play().catch(() => { /* blocked — fine */ });
        if (mqDesktop.matches) playSides();
    };
    const sleep = () => {
        v.pause();
        pauseSides();
    };

    mqDesktop.addEventListener ? mqDesktop.addEventListener("change", e => {
        if (e.matches) {
            armSides();
            if (visible) wake();
        } else {
            sleep();               // switched to mobile: stop all side decode
        }
    }) : mqDesktop.addListener(e => e.matches ? wake() : sleep());

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            entries.forEach(e => {
                visible = e.isIntersecting;
                if (visible) {
                    armSides();    // near the viewport → now it may load
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
