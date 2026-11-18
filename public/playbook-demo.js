// Playbook demo: the theme buttons re-skin the components below them, the sort chips toggle,
// and the main button shows a toast. Without this script the demo still shows the Game Day theme.
(() => {
  const demo = document.querySelector(".pb-demo");
  if (!demo) return;

  document.querySelectorAll('input[name="pb-theme"]').forEach((radio) => {
    radio.addEventListener("change", () => { if (radio.checked) demo.dataset.theme = radio.value; });
  });

  demo.querySelectorAll(".pb-chips").forEach((group) => {
    const chips = group.querySelectorAll(".pb-chip");
    chips.forEach((chip) => chip.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    }));
  });

  const live = demo.querySelector(".pb-live");
  demo.querySelectorAll("[data-toast]").forEach((btn) => btn.addEventListener("click", () => {
    const city = demo.dataset.theme.startsWith("city");
    const toast = document.createElement("div");
    toast.className = "pb-toast";
    toast.textContent = city ? "Saved. You can change this later." : "You're in! Go Foghorns!";
    live.replaceChildren(toast);
  }));
})();
