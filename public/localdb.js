/*
  localdb.js
  A tiny in-browser data layer backed by localStorage.

  Collections:
  - items: registered items { id, itemName, studentId, ownerName, category, contact/email/strand, photoPath, status, createdAt, foundPhotoPath?, lastClaimedAt? }
  - found_reports: reports from finders { id, itemId, finderName, location, photoPath?, status, createdAt }
  - claims: claims submitted by owners { id, itemId, claimantName, createdAt }

  Public API (window.ifoundDB): addItem, getItem, listItemsByStudent, listLostItems,
  addFoundReport, listPendingReportsWithItem, verifyReportMoveToLost, addClaim,
  listClaimsWithItem, analytics, exportAll, importMerge
*/

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
    // Create and persist a new item
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
    const item = db.items.find((x) => x.id === id) || null;
    return item;
  }

  function listItemsByStudent(studentId) {
    const db = load();
    return db.items
      .filter((item) => item.studentId === studentId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  function listLostItems() {
    const db = load();
    return db.items
      .filter((item) => item.status === "lost")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  function addFoundReport({ itemId, finderName, location, photoDataUrl }) {
    // Create a new found report linked to an item
    const db = load();
    db.seq.found_reports = (db.seq.found_reports || 0) + 1;
    const report = {
      id: db.seq.found_reports,
      itemId,
      finderName,
      location,
      photoPath: photoDataUrl || null,
      status: "pending",
      createdAt: nowIso(),
    };
    db.found_reports.push(report);
    save(db);
    return report;
  }

  function listPendingReportsWithItem() {
    const db = load();
    return db.found_reports
      .filter((report) => report.status === "pending")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((report) => {
        const item = db.items.find((x) => x.id === report.itemId);
        return {
          ...report,
          itemName: item?.itemName || "Unknown",
          ownerName: item?.ownerName || "",
          itemPhoto: item?.photoPath || null,
        };
      });
  }

  function verifyReportMoveToLost(reportId) {
    // Verify a found report and mark its item as lost
    const db = load();
    const rid = Number(reportId);
    const report = db.found_reports.find((x) => Number(x.id) === rid);
    if (!report) return false;
    const item = db.items.find((x) => x.id === report.itemId);
    if (!item) return false;
    report.status = "verified";
    item.status = "lost";
    // If finder provided a photo, prefer it for lost listing, but keep owner photo as fallback
    if (report.photoPath) {
      item.foundPhotoPath = report.photoPath;
    }
    save(db);
    return true;
  }

  function addClaim({ itemId, claimantName }) {
    // Mark item as claimed and create a claim record
    const db = load();
    const item = db.items.find((x) => x.id === itemId);
    if (!item) return null;
    db.seq.claims = (db.seq.claims || 0) + 1;
    const claim = {
      id: db.seq.claims,
      itemId,
      claimantName,
      createdAt: nowIso(),
    };
    db.claims.push(claim);
    item.status = "claimed";
    item.lastClaimedAt = claim.createdAt;
    save(db);
    return claim;
  }

  function listClaimsWithItem() {
    const db = load();
    return db.claims
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((claim) => {
        const item = db.items.find((x) => x.id === claim.itemId);
        return {
          ...claim,
          itemName: item?.itemName || "",
          ownerName: item?.ownerName || "",
          studentId: item?.studentId || "",
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
  };
})();
