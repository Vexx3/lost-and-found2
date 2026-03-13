export function showToast(message: string, type: "info" | "success" | "error" = "info"): void {
  const existing = document.querySelectorAll(".toast-notification");
  existing.forEach((t) => t.remove());
  
  const toast = document.createElement("div");
  toast.className = `toast-notification toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

export function h(tag: string, attrs: Record<string, any> = {}, children: any[] | any = []): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.substring(2).toLowerCase(), v);
    } else {
      el.setAttribute(k, v);
    }
  }
  
  const childArray = Array.isArray(children) ? children : [children];
  childArray.forEach((c) => {
    if (c === null || c === undefined) return;
    if (typeof c === "string" || typeof c === "number") {
      el.appendChild(document.createTextNode(c.toString()));
    } else if (c instanceof Node) {
      el.appendChild(c);
    }
  });
  return el;
}
