// Opens a working prototype in a large overlay. Links marked data-prototype still work as plain links without this.
// The prototype loads the first time it's opened, and keeps its place if you close and reopen it.
(() => {
  const links = document.querySelectorAll("a[data-prototype]");
  if (!links.length || !("HTMLDialogElement" in window)) return;
  const root = document.documentElement;
  const dialog = document.createElement("dialog");
  dialog.className = "proto-overlay";
  dialog.innerHTML = '<div class="proto-bar"><p></p><button type="button" class="lightbox-close" aria-label="Close prototype"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></div><iframe></iframe>';
  document.body.append(dialog);
  const frame = dialog.querySelector("iframe");
  const note = dialog.querySelector("p");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function open(link) {
    const url = link.href;
    dialog.setAttribute("aria-label", link.dataset.title);
    frame.title = link.dataset.title;
    note.textContent = link.dataset.note;
    if (frame.src !== url) frame.src = url;
    const bar = innerWidth - root.clientWidth;
    root.classList.add("lightbox-open");
    if (bar > 0) document.body.style.paddingRight = `${bar}px`;
    dialog.classList.remove("closing");
    dialog.showModal();
    frame.focus();
  }
  function close() {
    if (!dialog.open || dialog.classList.contains("closing")) return;
    if (reduceMotion.matches) return dialog.close();
    dialog.classList.add("closing");
    setTimeout(() => dialog.close(), 200);
  }
  // Phones: while the keypad is up, fit the overlay to the space above it, so the prototype can keep its text box
  // and button in view. Pinch-zooming also shrinks the visible area, so that's left alone.
  const vv = window.visualViewport;
  function fitKeypad() {
    if (!vv || !dialog.open || vv.scale > 1.01) return;
    const up = root.clientHeight - vv.height > 120;
    dialog.classList.toggle("keypad", up);
    if (up) {
      dialog.style.setProperty("--vv-h", `${vv.height}px`);
      dialog.style.setProperty("--vv-top", `${vv.offsetTop}px`);
    } else clearKeypad();
  }
  function clearKeypad() {
    dialog.classList.remove("keypad");
    dialog.style.removeProperty("--vv-h");
    dialog.style.removeProperty("--vv-top");
  }
  vv?.addEventListener("resize", fitKeypad);
  vv?.addEventListener("scroll", fitKeypad);

  // Escape pressed inside the prototype: it closes its own popup first; if there wasn't one, close this overlay.
  frame.addEventListener("load", () => {
    try {
      frame.contentWindow.addEventListener("keydown", (e) => { if (e.key === "Escape" && !e.defaultPrevented) close(); });
    } catch { /* not readable: the Close button still works */ }
  });
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dialog.querySelector("button").addEventListener("click", close);
  // Outside the phone: only a click that both starts and ends there, so a drag out of the prototype never closes it.
  let downOutside = false;
  dialog.addEventListener("pointerdown", (e) => { downOutside = e.target === dialog; });
  dialog.addEventListener("click", (e) => { if (downOutside && e.target === dialog) close(); });
  dialog.addEventListener("close", () => {
    dialog.classList.remove("closing");
    root.classList.remove("lightbox-open");
    document.body.style.paddingRight = "";
    clearKeypad();
  });
  links.forEach((link) => link.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; // let people open it in a new tab
    e.preventDefault();
    open(link);
  }));
})();
