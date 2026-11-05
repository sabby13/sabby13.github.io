/* =====================================================
   ABOUT — construct WebM handling
   Autoplay muted + loop, but never decoded while nobody
   is looking: paused whenever far outside the viewport,
   resumed on return. prefers-reduced-motion users get a
   representative (final) frame instead of animation.
   ===================================================== */

(function () {

    const v = document.querySelector(".about-construct");
    if (!v) return;

    v.muted = true;
    v.defaultMuted = true;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
        v.removeAttribute("autoplay");
        v.loop = false;
        v.pause();
        /* representative frame: the animation's last moment, where the
           full statement is on screen */
        const park = () => {
            try {
                const end = v.duration && isFinite(v.duration) ? v.duration - 0.06 : 0;
                if (end > 0) v.currentTime = end;
            } catch (e) { /* ignore */ }
        };
        if (v.readyState >= 1) park();
        else v.addEventListener("loadedmetadata", park, { once: true });
        return;
    }

    /* decode only while near the viewport */
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) v.play().catch(() => { /* blocked — fine */ });
                else v.pause();
            });
        }, { rootMargin: "150px" }).observe(v);
    }

})();
