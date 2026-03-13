import { api } from "./api.js";
import { showToast } from "./modules/ui.js";
import { bindRegister } from "./modules/registration.js";
import { bindMyItems } from "./modules/myitems.js";
import { loadLostItems } from "./modules/lost.js";
import { bindScan } from "./modules/scanner.js";

function setActivePanel() {
  const hash = window.location.hash || "#home";
  document
    .querySelectorAll(".panel")
    .forEach((el) => el.classList.remove("active"));

  // Stop any active cameras when navigating away
  try {
    if ((window as any).stopRegCamera) (window as any).stopRegCamera();
    if ((window as any).stopScanCamera) (window as any).stopScanCamera();
    if ((window as any).stopFoundCamera) (window as any).stopFoundCamera();
  } catch (e) {}

  try {
    const target = document.querySelector(hash);
    if (target) {
      target.classList.add("active");
    } else {
      document.querySelector("#home")?.classList.add("active");
    }
  } catch (e) {
    document.querySelector("#home")?.classList.add("active");
  }

  document.querySelectorAll(".topbar nav a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (href === hash || (href.includes("#") && href.endsWith(hash))) {
      a.classList.add("active-link");
    } else {
      a.classList.remove("active-link");
    }
  });

  const nav = document.getElementById("mainNav");
  if (nav) nav.classList.remove("open");
}

window.addEventListener("hashchange", setActivePanel);

document.addEventListener("DOMContentLoaded", async () => {
  setActivePanel();
  bindRegister();
  bindMyItems();
  loadLostItems();
  bindScan();

  try {
    await api.getDb();
    console.log("Backend Connected Successfully");
  } catch (e) {
    showToast("Backend connection failed. Is the server running?", "error");
  }

  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }
});