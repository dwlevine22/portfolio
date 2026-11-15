// Case study section timeline: marks the section you're reading as the current location (for screen
// readers too) and, on narrower screens, slides the strip so that step stays in view.
// Accessibility rules it follows:
//   - It only moves because the reader scrolled the page; it never moves by itself.
//   - It scrolls the strip only: never the page, never keyboard focus.
//   - While someone is swiping the strip or tabbing through it, it waits until they're done.
//   - With Reduce motion on, the strip jumps instead of sliding.
(() => {
  const nav = document.querySelector(".cs-nav");
  if (!nav || !("IntersectionObserver" in window)) return;

  const links = new Map(); // section id -> its link
  nav.querySelectorAll('a[href^="#"]').forEach((a) => links.set(a.getAttribute("href").slice(1), a));
  const sections = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);

  const narrow = window.matchMedia("(max-width: 1099px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Pause while the reader is using the strip themselves.
  let touching = false, focused = false, resumeTimer;
  const busy = () => touching || focused;
  nav.addEventListener("pointerdown", () => { touching = true; clearTimeout(resumeTimer); });
  const release = () => { clearTimeout(resumeTimer); resumeTimer = setTimeout(() => { touching = false; if (current) bringIntoView(links.get(current)); }, 1500); };
  nav.addEventListener("pointerup", release);
  nav.addEventListener("pointercancel", release);
  nav.addEventListener("wheel", () => { touching = true; release(); }, { passive: true });
  // Keyboard focus only: a tap can leave focus on the link, and that shouldn't freeze the strip.
  nav.addEventListener("focusin", (e) => { focused = e.target.matches(":focus-visible"); });
  nav.addEventListener("focusout", () => { focused = false; });

  // Center the visible step (dot, number and name) in the strip. Near either end the strip can't scroll
  // any further, so the step simply sits as close to the middle as the ends allow.
  function bringIntoView(link) {
    if (!narrow.matches || busy()) return;
    const navBox = nav.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    const dotLeft = linkBox.left + (parseFloat(getComputedStyle(link, "::before").left) || 0);
    const name = link.querySelector(".t") || link;
    const stepCenter = (dotLeft + name.getBoundingClientRect().right) / 2;
    const stripCenter = navBox.left + nav.clientLeft + nav.clientWidth / 2;
    const max = nav.scrollWidth - nav.clientWidth;
    const target = Math.min(max, Math.max(0, nav.scrollLeft + stepCenter - stripCenter));
    nav.scrollTo({ left: target, behavior: reduceMotion.matches ? "auto" : "smooth" });
  }

  let current = null;
  function setCurrent(id) {
    if (id === current) return;
    current = id;
    links.forEach((a, key) => {
      if (key === id) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
    if (id) bringIntoView(links.get(id));
  }

  // "Current" = the section crossing the middle of the screen (the same rule the CSS highlight uses).
  const io = new IntersectionObserver(
    (entries) => {
      const hit = entries.filter((e) => e.isIntersecting).map((e) => e.target.id);
      if (hit.length) setCurrent(hit[hit.length - 1]);
      else if (!sections.some((s) => { const r = s.getBoundingClientRect(); return r.top < innerHeight / 2 && r.bottom > innerHeight / 2; })) setCurrent(null);
    },
    { rootMargin: "-50% 0px -50% 0px" },
  );
  sections.forEach((s) => io.observe(s));

  // When they finish using the strip, catch it up to where they are.
  nav.addEventListener("focusout", () => setTimeout(() => current && bringIntoView(links.get(current)), 0));
})();
