(function () {
  const DB_KEY = "ifound_store_v1";

  function load() {
    try {
      const txt = localStorage.getItem(DB_KEY);
      if (!txt) return init();
      const db = JSON.parse(txt);
      db.seq = db.seq || { found_reports: 0, claims: 0 };
      return db;
    } catch (e) {
      return init();
    }
  }

  function init() {
    const db = {
      items: [],
      found_reports: [],
      claims: [],
      seq: { found_reports: 0, claims: 0 },
    };
    save(db);
    return db;
  }

  function save(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uuidv4() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // Fallback
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  function addItem({
    itemName,
    studentId,
    ownerName,
    strand,
    email,
    contact,
    photoDataUrl,
    category,
  }) {
    const db = load();
    const id = uuidv4();
    const item = {
      id,
      itemName,
      studentId,
      ownerName,
      category: category || "other",
      strand: strand || null,
      email: email || null,
      contact: contact || null,
      photoPath: photoDataUrl || null,
      // QR generated via external service for demo; not stored
      status: "registered",
      createdAt: nowIso(),
    };
    db.items.push(item);
    save(db);
    return item;
  }

  function getItem(id) {
    const db = load();
    return db.items.find((i) => i.id === id) || null;
  }

  function listItemsByStudent(studentId) {
    const db = load();
    return db.items
      .filter((i) => i.studentId === studentId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  function listLostItems() {
    const db = load();
    return db.items
      .filter((i) => i.status === "lost")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  function addFoundReport({ itemId, finderName, location, photoDataUrl }) {
    const db = load();
    db.seq.found_reports = (db.seq.found_reports || 0) + 1;
    const fr = {
      id: db.seq.found_reports,
      itemId,
      finderName,
      location,
      photoPath: photoDataUrl || null,
      status: "pending",
      createdAt: nowIso(),
    };
    db.found_reports.push(fr);
    save(db);
    return fr;
  }

  function listPendingReportsWithItem() {
    const db = load();
    return db.found_reports
      .filter((r) => r.status === "pending")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((r) => {
        const it = db.items.find((i) => i.id === r.itemId);
        return {
          ...r,
          itemName: it?.itemName || "Unknown",
          ownerName: it?.ownerName || "",
          itemPhoto: it?.photoPath || null,
        };
      });
  }

  function verifyReportMoveToLost(reportId) {
    const db = load();
    const rid = Number(reportId);
    const r = db.found_reports.find((x) => Number(x.id) === rid);
    if (!r) return false;
    const it = db.items.find((i) => i.id === r.itemId);
    if (!it) return false;
    r.status = "verified";
    it.status = "lost";
    // If finder provided a photo, prefer it for lost listing, but keep owner photo as fallback
    if (r.photoPath) {
      it.foundPhotoPath = r.photoPath;
    }
    save(db);
    return true;
  }

  function addClaim({ itemId, claimantName }) {
    const db = load();
    const it = db.items.find((i) => i.id === itemId);
    if (!it) return null;
    db.seq.claims = (db.seq.claims || 0) + 1;
    const cl = { id: db.seq.claims, itemId, claimantName, createdAt: nowIso() };
    db.claims.push(cl);
    it.status = "claimed";
    it.lastClaimedAt = cl.createdAt;
    save(db);
    return cl;
  }

  function listClaimsWithItem() {
    const db = load();
    return db.claims
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((c) => {
        const it = db.items.find((i) => i.id === c.itemId);
        return {
          ...c,
          itemName: it?.itemName || "",
          ownerName: it?.ownerName || "",
          studentId: it?.studentId || "",
        };
      });
  }

  function analytics() {
    const db = load();
    const total = db.items.length;
    const claimed = db.items.filter((i) => i.status === "claimed").length;
    const lost = db.items.filter((i) => i.status === "lost").length;
    const pendingReports = db.found_reports.filter(
      (r) => r.status === "pending"
    ).length;
    const recoveryRate = total ? Math.round((claimed / total) * 100) : 0;
    return { total, claimed, lost, pendingReports, recoveryRate };
  }

  function exportAll() {
    return load();
  }

  function importMerge(data) {
    if (!data || typeof data !== "object") return false;
    const db = load();
    function mergeArray(key, uniqueBy) {
      const existing = new Map(db[key].map((x) => [uniqueBy(x), x]));
      for (const item of data[key] || []) {
        if (!existing.has(uniqueBy(item))) db[key].push(item);
      }
    }
    mergeArray("items", (x) => x.id);
    mergeArray("found_reports", (x) => x.id);
    mergeArray("claims", (x) => x.id);
    // fix sequences
    db.seq.found_reports = Math.max(
      db.seq.found_reports || 0,
      ...db.found_reports.map((x) => x.id).concat(0)
    );
    db.seq.claims = Math.max(
      db.seq.claims || 0,
      ...db.claims.map((x) => x.id).concat(0)
    );
    save(db);
    return true;
  }

  function qrUrlFor(itemId) {
    // Use public QR service for demo only
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      itemId
    )}`;
  }

  window.ifoundDB = {
    addItem,
    getItem,
    listItemsByStudent,
    listLostItems,
    addFoundReport,
    listPendingReportsWithItem,
    verifyReportMoveToLost,
    addClaim,
    listClaimsWithItem,
    analytics,
    exportAll,
    importMerge,
    qrUrlFor,
  };
})();
