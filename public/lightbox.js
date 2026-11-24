// Case study images: click one to see it larger in an overlay, click anywhere (or press Esc) to close.
// Dragging never opens or closes it; only a click or tap that stays put counts.
// Without this script the images are simply images.
(() => {
  const images = [...document.querySelectorAll("main figure img, main .phones img")].filter((img) => !img.closest("a, button"));
  if (!images.length || !("HTMLDialogElement" in window)) return;

  // ---- Telling a click from a drag (also covers a drag that happens to end where it started, and pinching).
  const SLOP = 8; // how far, in pixels, a finger or mouse may wander and still count as a click
  const down = new Map(); // pointers currently pressed
  let dragged = false;
  addEventListener("pointerdown", (e) => {
    if (!down.size) dragged = false;
    down.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (down.size > 1) dragged = true;
  }, true);
  addEventListener("pointermove", (e) => {
    const p = down.get(e.pointerId);
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) dragged = true;
  }, true);
  for (const type of ["pointerup", "pointercancel"]) addEventListener(type, (e) => down.delete(e.pointerId), true);
  // Keyboard presses and screen reader activations have no pointer behind them, so they always count.
  const wasDrag = (e) => e.detail !== 0 && dragged;

  // ---- The overlay
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const root = document.documentElement;
  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.setAttribute("aria-label", "Larger image");
  dialog.innerHTML = '<img alt="" draggable="false"><button type="button" class="lightbox-close" aria-label="Close larger image"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>';
  document.body.append(dialog);
  const big = dialog.querySelector("img");
  const closeButton = dialog.querySelector("button");

  function open(img) {
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    big.width = img.naturalWidth || img.width;
    big.height = img.naturalHeight || img.height;
    // Keep the page behind from scrolling, without it jumping sideways when its scrollbar goes away.
    const bar = innerWidth - root.clientWidth;
    root.classList.add("lightbox-open");
    if (bar > 0) document.body.style.paddingRight = `${bar}px`;
    dialog.classList.remove("closing");
    dialog.showModal();
    closeButton.focus({ preventScroll: true });
  }
  function close() {
    if (!dialog.open || dialog.classList.contains("closing")) return;
    if (reduceMotion.matches) return dialog.close();
    dialog.classList.add("closing");
    setTimeout(() => dialog.close(), 200); // the length of the closing animation
  }
  dialog.addEventListener("click", (e) => { if (!wasDrag(e)) close(); });
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); }); // Esc
  dialog.addEventListener("close", () => {
    dialog.classList.remove("closing");
    root.classList.remove("lightbox-open");
    document.body.style.paddingRight = "";
  });
  dialog.addEventListener("dragstart", (e) => e.preventDefault());

  // ---- Make each image a button
  for (const img of images) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "zoom";
    img.draggable = false;
    img.replaceWith(button);
    const hint = document.createElement("span");
    hint.className = "vh";
    hint.textContent = " (view larger)";
    button.append(img, hint);
    button.addEventListener("click", (e) => { if (!wasDrag(e)) open(img); });
  }
})();
