/* =====================================================
   LET'S CONNECT — background film handling
   Tiny and defensive: guarantee muted autoplay, respect
   prefers-reduced-motion (static frame instead of a
   looping film), pause while the section is off-screen,
   and flag the section if the video ever fails so the
   deep-green fallback stage stays presentable.
   ===================================================== */

(function () {

    const sec = document.querySelector(".connect-hero");
    const v = sec && sec.querySelector(".connect-hero__video");
    if (!sec || !v) return;

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

    /* ---- reduced motion: park on a single frame, never loop ---- */
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
        v.removeAttribute("autoplay");
        v.loop = false;
        v.preload = "metadata";
        v.pause();
        // force the first frame to actually paint
        const frame = () => { try { v.currentTime = 0.1; } catch (e) { /* ignore */ } };
        if (v.readyState >= 1) frame();
        else v.addEventListener("loadedmetadata", frame, { once: true });
        return;
    }

    /* ---- normal: pause the film while the section is off-screen ---- */
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) v.play().catch(() => { /* blocked — fine */ });
                else v.pause();
            });
        }, { threshold: 0.05 }).observe(sec);
    }

})();
