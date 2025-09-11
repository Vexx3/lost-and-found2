ifound — Lost & Found Prototype

A lightweight static prototype for "ifound" (STI College Muñoz-EDSA lost & found system).

What this includes:
- index.html — Main UI: Home, Scan QR, Register, Lost Items, FAQ
- admin.html — Admin dashboard for verifying found reports and basic analytics
- styles.css — Responsive, blue/yellow theme
- app.js — Client-side logic using localStorage as a prototype database
- No server, uses only HTML/CSS/JS and JSON for import/export

How to run:
Open `index.html` in a modern browser (Chrome/Edge/Firefox). For camera scanning, host over https or use localhost via a simple static server (e.g., `python -m http.server`).

Key flows implemented:
- Register an item (owner info + item photo) -> generates QR code (data payload contains itemId)
- Finder: Scan QR via camera or upload QR image -> submit found report with photo + location
- Admin: verify found reports -> item becomes visible in Lost Items
- Owner: simple claim via Items list (prompt-based verification)

Security & notes (prototype):
- Uses localStorage; no real authentication. Admin page is not protected—add auth for production.
- For email notifications, the system stores a simulated email in localStorage under `ifound_mails`.

Admin testing:
- For convenience in this prototype, an `ifound_is_admin` flag in localStorage enables admin-only UI controls. To toggle admin features in your browser console:
	- `localStorage.setItem('ifound_is_admin','1')` to enable
	- `localStorage.setItem('ifound_is_admin','0')` to disable

Next steps (optional):
- Add server (Node/Python) and JSON file backend or real database
- Add proper authentication for staff and owners
- Replace prompt-based claim with a proper claim form + file upload for proof

