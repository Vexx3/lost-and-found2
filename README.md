# ifound — Lost & Found (Static, Browser-Only)

A simple, fully client-side Lost & Found app that runs from static files. No server, no database—everything is stored in your browser’s localStorage for demo and school projects.

## Features

- Register item: attach an item photo, save owner details, and generate a unique QR.
 - Scan QR: use your camera (BarcodeDetector) or upload an image of the QR to view item info; submit a Found Report. The app now also falls back to a JavaScript-based decoder (jsQR) for browsers that don't support BarcodeDetector.
- My Registered Items: list items by Student ID and download their QR code directly.
- Lost Items: shows verified found items; Claim flow checks student ID + owner name.
- Admin Dashboard: verify pending found reports (moves to Lost Items), see claims, analytics, and import/export JSON.

## Run locally

No build or server required.

1. Open `index.html` in your browser for the user site.
2. Open `admin.html` for the admin dashboard.

Tip: Use a simple static server (e.g., VS Code Live Server) for best camera permissions, but file:// will also work for most features.

## How it works

- Data is saved in localStorage under the key `ifound_store_v1`.
- QR images are fetched from a public QR service when viewed, and downloaded directly as PNG when you click Download.
 - Camera scanning uses the native `BarcodeDetector` API when available. If it's not available the app dynamically loads `jsQR` and attempts to decode QR codes by scanning video frames or decoding uploaded images. Note: the jsQR fallback requires network access to load the library from a CDN unless you vendor it locally (I can add a local copy if you prefer offline support).
 - Camera scanning uses the native `BarcodeDetector` API when available. If it's not available the app dynamically loads `jsQR` and attempts to decode QR codes by scanning video frames or decoding uploaded images. The app prefers a vendored local copy at `public/libs/jsQR.js` if present, otherwise it loads from CDN. I added a small QR test page at `public/qr-test.html` to generate QR images for manual testing.
- On Verify, if the finder included a photo, that image is used on the Lost Items list (owner photo is kept as a secondary reference).

## Project structure

- `index.html`, `admin.html`, `styles.css` — pages and styles
- `public/localdb.js` — localStorage-backed data helpers
- `public/app.js` — user site logic
- `public/admin.js` — admin dashboard logic

Legacy server files were removed in favor of this static setup.

## Import/Export

- Export downloads a JSON snapshot of the current localStorage database.
- Import merges the file into your current data (no deletions).

## Notes & Next steps

- Add categories to items at registration for better filtering.
- Add a nicer claim verification UI (instead of prompts) and optional photo attachments.
- Consider a real backend if you need multi-user persistence beyond a single browser.