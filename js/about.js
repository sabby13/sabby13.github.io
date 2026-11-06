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


/* -----------------------------------------------------
   Signature entrance — one-shot "pen-drawn" reveal.
   The PNG is masked (soft feathered front sweeping left to
   right, so it reads as ink appearing under a pen). Armed
   only when JS runs — without JS / with reduced motion the
   signature is simply visible (fails open). Fired once by
   IntersectionObserver when the CARD is meaningfully
   visible, after a short beat, and never replayed.
   ----------------------------------------------------- */

(function () {

    const sig  = document.querySelector(".about-card__signature");
    const card = document.querySelector(".about-card");
    if (!sig || !card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    sig.classList.add("sig-armed");

    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            io.disconnect();                       /* once per page load */
            setTimeout(() => sig.classList.add("sig-draw"), 400);
        });
    }, { threshold: 0.5 });

    io.observe(card);

})();
