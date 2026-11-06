/* =====================================================
   SKILLS — star chart interactions
   Focus a star -> its true relationships draw themselves
   in cobalt while the rest of the plate recedes. Works by
   hover (desktop), tap (mobile) and keyboard focus. The
   entrance draw-in happens once, when the chart first
   becomes visible. No constant motion; the only ambient
   movement is an extremely subtle scroll drift (desktop).
   ===================================================== */

(function () {

    const wrap = document.querySelector(".chart-wrap");
    if (!wrap) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---- one-shot entrance (skipped entirely for reduced motion:
            the CSS shows the finished chart immediately) ---- */
    if (!reduce && "IntersectionObserver" in window) {
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.closest(".chart-wrap").classList.add("is-set");
                    io.disconnect();
                }
            });
        }, { threshold: 0.3 });
        wrap.querySelectorAll(".chart").forEach(c => io.observe(c));
    }

    /* ---- focus / relationships (scoped to one chart) ---- */

    function wire(svg) {
        const stars = Array.from(svg.querySelectorAll(".star"));
        if (!stars.length) return;

        /* adjacency from the edges' data attributes */
        const adj = {};
        svg.querySelectorAll(".edge").forEach(ed => {
            (adj[ed.dataset.a] = adj[ed.dataset.a] || []).push(ed);
            (adj[ed.dataset.b] = adj[ed.dataset.b] || []).push(ed);
        });

        let current = null;

        function focusStar(id) {
            current = id;
            svg.classList.add("has-focus");
            stars.forEach(s => {
                const linked = s.dataset.id !== id &&
                    adj[id].some(e => e.dataset.a === s.dataset.id || e.dataset.b === s.dataset.id);
                s.classList.toggle("is-focus", s.dataset.id === id);
                s.classList.toggle("is-linked", linked);
            });
            svg.querySelectorAll(".edge").forEach(e =>
                e.classList.toggle("is-lit", e.dataset.a === id || e.dataset.b === id));
        }

        function clearFocus() {
            if (!current) return;
            current = null;
            svg.classList.remove("has-focus");
            svg.querySelectorAll(".is-focus, .is-linked")
                .forEach(s => s.classList.remove("is-focus", "is-linked"));
            svg.querySelectorAll(".edge.is-lit").forEach(e => e.classList.remove("is-lit"));
        }

        stars.forEach(s => {
            const id = s.dataset.id;
            /* mouse / stylus: hover to explore */
            s.addEventListener("pointerenter", ev => {
                if (ev.pointerType !== "touch") focusStar(id);
            });
            s.addEventListener("pointerleave", ev => {
                if (ev.pointerType !== "touch") clearFocus();
            });
            /* keyboard */
            s.addEventListener("focus", () => focusStar(id));
            s.addEventListener("blur", clearFocus);
            /* touch: tap toggles (pointerup carries the pointer type;
               click only guards the chart-level "tap elsewhere = clear") */
            s.addEventListener("click", ev => ev.stopPropagation());
            s.addEventListener("pointerup", ev => {
                if (ev.pointerType === "touch") (current === id ? clearFocus() : focusStar(id));
            });
        });

        svg.addEventListener("click", ev => {
            if (!ev.target.closest(".star")) clearFocus();  /* tap elsewhere = clear */
        });
    }

    wrap.querySelectorAll(".chart").forEach(wire);

    /* ---- extremely subtle scroll drift (desktop only) ---- */

    if (!reduce && matchMedia("(min-width: 761px)").matches) {
        const drift = wrap.querySelector(".chart--main .chart__drift");
        const figs = wrap.querySelectorAll(".chart--main .chart__fig");
        if (drift) {
            let raf = 0;
            const tick = () => {
                raf = 0;
                const r = wrap.getBoundingClientRect();
                const d = (r.top + r.height / 2) - innerHeight / 2;
                const y = Math.max(-7, Math.min(7, -d * 0.018));
                drift.setAttribute("transform", "translate(0 " + y.toFixed(2) + ")");
                figs.forEach(f => f.setAttribute("transform", "translate(0 " + (-y * 0.55).toFixed(2) + ")"));
            };
            addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
        }
    }

})();
