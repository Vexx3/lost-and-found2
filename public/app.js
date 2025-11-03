/* Frontend logic for index.html (localStorage version) */

// Simple router to set active panel by hash
function setActivePanel() {
  const hash = window.location.hash || '#home';
  document.querySelectorAll('.panel').forEach((el) => el.classList.remove('active'));
  const target = document.querySelector(hash);
  if (target) target.classList.add('active');
  if (hash === '#lost') loadLostItems();
}
window.addEventListener('hashchange', setActivePanel);
document.addEventListener('DOMContentLoaded', async () => {
  setActivePanel();
  bindRegister();
  bindMyItems();
  bindScan();
  // No backend health check needed in local mode
});

// Helper: create element
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') {
      el.className = v;
    } else if (k === 'html') {
      el.innerHTML = v;
    } else if (k.startsWith('on') && typeof v === 'function') {
      // Bind event listeners like onclick, oninput, etc.
      el.addEventListener(k.slice(2), v);
    } else {
      el.setAttribute(k, v);
    }
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  });
  return el;
}

// No asset URL rewriting needed in local mode
function assetUrl(p) { return p; }

// Register & Generate QR
function bindRegister() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('fullName', document.getElementById('fullName').value.trim());
    fd.append('strand', document.getElementById('strand').value.trim());
    fd.append('email', document.getElementById('email').value.trim());
    fd.append('contact', document.getElementById('contact').value.trim());
    fd.append('studentId', document.getElementById('studentId').value.trim());
    fd.append('itemName', document.getElementById('itemName').value.trim());
    const photo = document.getElementById('itemPhoto').files[0];
    if (photo) fd.append('itemPhoto', photo);

    try {
      // Read and downscale image to data URL for storage
      let photoDataUrl = null;
      if (photo) {
        photoDataUrl = await fileToDataUrl(photo, 800);
      }
      const item = ifoundDB.addItem({
        itemName: document.getElementById('itemName').value.trim(),
        studentId: document.getElementById('studentId').value.trim(),
        ownerName: document.getElementById('fullName').value.trim(),
        strand: document.getElementById('strand').value.trim(),
        email: document.getElementById('email').value.trim(),
        contact: document.getElementById('contact').value.trim(),
        photoDataUrl,
      });
      const sidInput = document.getElementById('myStudentId');
      if (sidInput) sidInput.value = item.studentId;
      window.location.hash = '#myitems';
      const showBtn = document.getElementById('myItemsBtn');
      if (showBtn) showBtn.click();
      alert('Registered! Your QR is available under My Registered Items.');
    } catch (err) {
      console.error(err);
      alert('Failed to register. Please try again.');
    }
  });
}

// Scan QR (camera) using native BarcodeDetector (no external CDN)
let scannedItemId = null;
let mediaStream = null;
let scanning = false;
function bindScan() {
  const startBtn = document.getElementById('start-camera');
  const videoWrap = document.querySelector('.video-wrap');
  const resultCard = document.getElementById('scan-result');
  const foundForm = document.getElementById('foundForm');
  const imgFile = document.getElementById('img-file');

  if (resultCard) resultCard.innerHTML = '<div><em>Waiting for scan...</em></div>';

  async function startCameraScan() {
    if (!('BarcodeDetector' in window)) {
      alert('QR scanning is not supported in this browser. Try Chrome/Edge or use the image upload.');
      return;
    }
    try {
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.style.width = '360px';
      video.style.height = '270px';
      videoWrap.innerHTML = '';
      videoWrap.appendChild(video);

      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = mediaStream;
      await video.play();

      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      scanning = true;
      const tick = async () => {
        if (!scanning) return;
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length) {
            scannedItemId = (codes[0].rawValue || '').trim();
            await stopCamera();
            loadScannedItem(scannedItemId, resultCard);
            return;
          }
        } catch (e) {}
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (e) {
      console.error(e);
      alert('Camera access failed. Please allow permission or use the image upload.');
    }
  }

  async function stopCamera() {
    scanning = false;
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
  }

  async function decodeFromImage(file) {
    if (!('BarcodeDetector' in window)) {
      alert('QR decoding from image is not supported in this browser.');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const codes = await detector.detect(canvas);
        if (codes && codes.length) {
          scannedItemId = (codes[0].rawValue || '').trim();
          loadScannedItem(scannedItemId, resultCard);
        } else {
          alert('No QR found in the image.');
        }
      } catch (e) {
        console.error(e);
        alert('Failed to decode the image.');
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert('Failed to load the image.');
    };
    img.src = url;
  }

  if (startBtn && videoWrap) startBtn.addEventListener('click', startCameraScan);
  if (imgFile) imgFile.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) decodeFromImage(f);
  });

  if (foundForm) {
    foundForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!scannedItemId) {
        alert('Scan an item QR first.');
        return;
      }
      const finderName = document.getElementById('finderName').value.trim();
      const location = document.getElementById('foundLocation').value.trim();
      const photo = document.getElementById('foundPhoto').files[0];
      try {
        let photoDataUrl = null;
        if (photo) photoDataUrl = await fileToDataUrl(photo, 800);
        const r = ifoundDB.addFoundReport({ itemId: scannedItemId, finderName, location, photoDataUrl });
        if (!r) throw new Error('Submit failed');
        alert('Report submitted. Thank you!');
        foundForm.reset();
      } catch (err) {
        console.error(err);
        alert('Failed to submit report.');
      }
    });
  }
}

async function loadScannedItem(itemId, container) {
  try {
    const it = ifoundDB.getItem(itemId);
    if (!it) throw new Error('Item not found');
    const wrap = h('div', {}, [
      h('div', { style: 'display:flex; gap:12px; align-items:flex-start' }, [
  it.photoPath ? h('img', { src: assetUrl(it.photoPath), style: 'max-width:160px;border-radius:6px' }) : null,
        h('div', {}, [
          h('div', { html: `<strong>${it.itemName}</strong>` }),
          h('div', {}, `Owner: ${it.ownerName} (${it.contact || 'n/a'})`),
          h('div', {}, `Status: ${it.status}`),
        ]),
      ]),
    ]);
    container.innerHTML = '';
    container.appendChild(wrap);
  } catch (e) {
    container.innerHTML = '<div><strong>Item not found</strong></div>';
  }
}

// My Registered Items
function bindMyItems() {
  const btn = document.getElementById('myItemsBtn');
  const list = document.getElementById('myItemsList');
  if (!btn || !list) return;
  // Clear static examples
  list.innerHTML = '';
  btn.addEventListener('click', async () => {
    const sid = document.getElementById('myStudentId').value.trim();
    if (!sid) return alert('Enter Student ID');
    try {
      const items = ifoundDB.listItemsByStudent(sid);
      list.innerHTML = '';
      if (!items.length) {
        list.appendChild(h('div', {}, 'No items found.'));
        return;
      }
      items.forEach((it) => {
        list.appendChild(h('div', { class: 'card', style: 'margin-bottom:8px' }, [
          h('div', { html: `<strong>${it.itemName}</strong> <span class="status-${it.status}">${it.status}</span>` }),
          it.photoPath ? h('img', { src: assetUrl(it.photoPath), style: 'max-width:200px;margin-top:8px' }) : null,
          h('div', { style: 'margin-top:8px;display:flex;gap:8px;align-items:center' }, [
            h('img', { src: ifoundDB.qrUrlFor(it.id), alt: 'QR', style: 'width:120px;height:120px;background:#fff;padding:6px;border-radius:8px' }),
            h('a', { href: '#', class: 'btn', onclick: (e) => { e.preventDefault(); downloadQr(it.id); } }, 'Download QR')
          ]),
          h('div', { style: 'margin-top:8px;font-size:12px;color:#6b7280' }, `Item ID: ${it.id}`),
        ]));
      });
    } catch (err) {
      console.error(err);
      alert('Failed to fetch items');
    }
  });
}

// Lost Items list and Claim
async function loadLostItems() {
  const list = document.getElementById('itemsList');
  if (!list) return;
  try {
    const items = ifoundDB.listLostItems();
    list.innerHTML = '';
    const search = document.getElementById('searchBar').value.trim().toLowerCase();
    const cat = (document.getElementById('categoryFilter').value || 'all').toLowerCase();
    items
      .filter((it) => {
        const hit = `${it.itemName} ${it.ownerName}`.toLowerCase().includes(search);
        const inCat = cat === 'all' || (cat === 'phones' && /phone/i.test(it.itemName)) || (cat === 'wallets' && /wallet/i.test(it.itemName)) || (cat === 'tumblers' && /tumbler/i.test(it.itemName));
        return hit && inCat;
      })
      .forEach((it) => {
        const primaryPhoto = it.foundPhotoPath || it.photoPath;
        const secondaryPhoto = it.foundPhotoPath && it.photoPath ? it.photoPath : null;
        const card = h('div', { class: 'item card' }, [
          primaryPhoto ? h('img', { src: assetUrl(primaryPhoto), alt: it.itemName }) : null,
          h('div', { class: 'meta' }, [
            h('strong', {}, it.itemName),
            h('div', {}, `Owner: ${it.ownerName}`),
            secondaryPhoto ? h('div', { style: 'margin-top:8px' }, [
              h('img', { src: assetUrl(secondaryPhoto), alt: 'Owner Photo', style: 'max-width:140px;border-radius:6px;opacity:0.9' })
            ]) : null,
            h('div', { style: 'margin-top:8px' }, [
              h('button', { class: 'btn', onclick: async () => {
                const sid = prompt('Enter owner\'s Student ID to claim:');
                if (!sid) return;
                const name = prompt('Enter owner\'s Full Name to claim:');
                if (!name) return;
                const sameId = (sid || '').trim() === (it.studentId || '').trim();
                const sameName = (name || '').trim().toLowerCase() === (it.ownerName || '').trim().toLowerCase();
                if (!sameId || !sameName) {
                  alert('Details do not match the registered owner. Cannot claim.');
                  return;
                }
                const r = ifoundDB.addClaim({ itemId: it.id, claimantName: name });
                if (r) {
                  alert('Claim submitted.');
                  loadLostItems();
                } else alert('Failed to claim');
              } }, 'Claim')
            ])
          ])
        ]);
        list.appendChild(card);
      });
  } catch (err) {
    console.error(err);
    list.innerHTML = '<div class="card">Failed to load lost items.</div>';
  }
}

// Filters reload
document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('searchBar');
  const cat = document.getElementById('categoryFilter');
  if (search) search.addEventListener('input', loadLostItems);
  if (cat) cat.addEventListener('change', loadLostItems);
});

// Helpers
function fileToDataUrl(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.naturalWidth || 1);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Download QR image as a file without opening a new tab
async function downloadQr(itemId) {
  try {
    const url = ifoundDB.qrUrlFor(itemId);
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj;
    a.download = `item-${itemId}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(obj);
  } catch (e) {
    // Fallback: open in new tab if direct download fails
    window.open(ifoundDB.qrUrlFor(itemId), '_blank');
  }
}
