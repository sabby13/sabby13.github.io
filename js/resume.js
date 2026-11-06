/* =====================================================
   Resume — "The 80-Column Record"
   One-shot card-reader scan: when the desk enters the
   viewport a light beam sweeps each card once and the
   interpreter print surfaces with it (CSS does the
   staggering; this only flips one class at the right time).

   Fails open: without JS the print is always fully
   visible. prefers-reduced-motion parks everything in
   the final state — the record is simply on file.
   ===================================================== */

(() => {
    const desk = document.querySelector('.resume-desk');
    if (!desk) return;

    const done = () => desk.classList.add('is-scanned');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !('IntersectionObserver' in window)) {
        done();
        return;
    }

    const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
            done();
            io.disconnect();
        }
    }, { threshold: 0.25 });

    io.observe(desk);
})();
