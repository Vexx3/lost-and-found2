# ifound — Lost & Found (Client-Side Application)

A streamlined, fully client-side Lost & Found application designed for STI College Muñoz-EDSA. This system operates directly in the browser utilizing `localStorage` for robust, high-performance data management without the need for a dedicated backend, making it highly portable and perfect for school presentations and immediate deployments.

## Features

- **Item Registration**: Attach a photo, save owner details, assign categories, and generate a unique offline QR code instantly.
- **Advanced QR Scanning**: Implements the native `BarcodeDetector` API for lightning-fast camera scanning, with a seamless automated fallback to `jsQR` via video frames or image uploads.
- **My Items Dashboard**: Students can track their registered items by entering their Student ID and download QR code tags directly as PNG files.
- **Responsive Lost Items Feed**: A live feed of verified lost items featuring category filtering and real-time text search. Integrated claim verification flow compares the inputted email against the registered owner's file.
- **Admin Command Center**: A comprehensive dashboard to verify pending found reports (promoting them to the Lost feed), review recent claims, track platform analytics (recovery rates), and manage data portability (Import/Export JSON).

## Run locally

No complex build steps or servers required.

1. Open `index.html` in your browser for the main portal.
2. Open `admin.html` to access the Admin dashboard.

*Tip: Using a simple static server (e.g., Live Server in VS Code) ensures full compatibility across all environments (like granting camera API permissions).*

## Technical Implementation (Error-Free & Functional)

- Data is safely persisted cross-session via `localStorage` under `ifound_store_v1`.
- Designed with UX principles in mind: Custom toast notifications replace generic browser alerts, buttons feature active/hover states, and forms are fully validated.
- Defense against XSS applied across all DOM injections by utilizing safe vanilla JS element creation.
- Graceful fallbacks implemented to prevent crashes: Routing defaults safely if invalid URLs are accessed, and camera APIs execute safely.

## Project Structure

- `index.html`, `admin.html`, `styles.css` — High-fidelity UI with consistent color schemes (STI-inspired blue/yellow accents).
- `public/localdb.js` — Custom lightweight ORM providing structured queries and entity relationships over localStorage.
- `public/app.js` — Client logic with hash-based routing.
- `public/admin.js` — Administrative operations.
- `public/libs/` — Vendored scripts to guarantee functionality offline or in strict network environments.
