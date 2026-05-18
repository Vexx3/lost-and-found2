import { api } from "./api.js";
import { showToast } from "./modules/ui.js";
import { bindRegister, stopRegCamera } from "./modules/registration.js";
import { bindMyItems } from "./modules/myitems.js";
import { loadLostItems } from "./modules/lost.js";
import { bindScan, stopFoundCamera, stopScanCamera, handleExternalScan } from "./modules/scanner.js";

function setActivePanel() {
  const hash = window.location.hash || "#home";
  document
    .querySelectorAll(".panel")
    .forEach((el) => el.classList.remove("active"));

  // Stop any active cameras when navigating away
  try {
    stopRegCamera();
    stopScanCamera();
    stopFoundCamera();
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

  const params = new URLSearchParams(window.location.search);
  const scanId = params.get("scan");
  if (scanId) {
    window.location.hash = "#scan";
    setActivePanel();
    setTimeout(() => {
      handleExternalScan(scanId);
    }, 300);
  }

  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");
  const backdrop = document.getElementById("navBackdrop");
  const closeBtn = document.getElementById("menuClose");

  function closeMenu() {
    nav?.classList.remove("open");
    backdrop?.classList.remove("open");
  }

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.add("open");
      backdrop?.classList.add("open");
    });
  }

  closeBtn?.addEventListener("click", closeMenu);
  backdrop?.addEventListener("click", closeMenu);

  document.querySelectorAll("#mainNav a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });
});