/* Admin dashboard logic (localStorage version)
  Depends on utils.js (h, assetUrl).
*/

document.addEventListener("DOMContentLoaded", () => {
  loadPending();
  loadClaims();
  loadAnalytics();
  bindDataControls();
});

// h and assetUrl are provided by utils.js

async function loadPending() {
  const container = document.getElementById("reports");
  if (!container) return;
  try {
    const reports = ifoundDB.listPendingReportsWithItem();
    container.innerHTML = "";
    if (!reports.length) {
      container.appendChild(h("div", { class: "card" }, "No pending reports."));
      return;
    }
    reports.forEach((r) => {
      const card = h("div", { class: "card", style: "margin-bottom:8px" }, [
        h("strong", {}, r.itemName),
        h("div", {}, `Finder: ${r.finderName}`),
        h("div", {}, `Location: ${r.location}`),
        h(
          "div",
          {
            style:
              "display:flex; gap:12px; margin-top:8px; align-items:flex-start",
          },
          [
            r.photoPath
              ? h("div", {}, [
                  h(
                    "div",
                    { style: "font-size:12px;color:#6b7280" },
                    "Finder Photo"
                  ),
                  h("img", {
                    src: assetUrl(r.photoPath),
                    style: "max-width:200px;border-radius:6px;margin-top:4px",
                  }),
                ])
              : null,
            r.itemPhoto
              ? h("div", {}, [
                  h(
                    "div",
                    { style: "font-size:12px;color:#6b7280" },
                    "Owner Photo"
                  ),
                  h("img", {
                    src: assetUrl(r.itemPhoto),
                    style: "max-width:200px;border-radius:6px;margin-top:4px",
                  }),
                ])
              : null,
          ]
        ),
        h("div", { style: "margin-top:10px" }, [
          h(
            "button",
            {
              type: "button",
              class: "btn primary",
              onclick: async (ev) => {
                console.log("Verifying report id", r.id);
                const ok = confirm("Verify and move to Lost Items?");
                if (!ok) return;
                const btn = ev.currentTarget;
                btn.disabled = true;
                const prev = btn.textContent;
                btn.textContent = "Verifying...";
                try {
                  const ok2 = ifoundDB.verifyReportMoveToLost(r.id);
                  if (ok2) {
                    // Immediate visual feedback
                    card.innerHTML = "";
                    card.appendChild(
                      h(
                        "div",
                        { class: "status-claimed" },
                        "Moved to Lost Items"
                      )
                    );
                    // Refresh lists/analytics
                    loadPending();
                    loadAnalytics();
                    alert("Verified and moved to Lost Items.");
                  } else {
                    alert("Failed to verify.");
                    btn.disabled = false;
                    btn.textContent = prev;
                  }
                } catch (e) {
                  console.error("Verify error", e);
                  alert("Error during verification.");
                  btn.disabled = false;
                  btn.textContent = prev;
                }
              },
            },
            "Verify & Move to Lost Items"
          ),
        ]),
      ]);
      container.appendChild(card);
    });
  } catch (e) {
    console.error(e);
  }
}

async function loadClaims() {
  const container = document.getElementById("claims");
  if (!container) return;
  try {
    const claims = ifoundDB.listClaimsWithItem();
    container.innerHTML = "";
    if (!claims.length) {
      container.appendChild(h("div", { class: "card" }, "No claims yet."));
      return;
    }
    claims.forEach((c) => {
      container.appendChild(
        h("div", { class: "card", style: "margin-bottom:8px" }, [
          h("strong", {}, `Claim: ${c.itemName}`),
          h("div", {}, `Claimant: ${c.claimantName}`),
          h("div", {}, `Student ID: ${c.studentId}`),
          h(
            "div",
            { style: "font-size:12px;color:#6b7280" },
            `On: ${new Date(c.createdAt).toLocaleString()}`
          ),
        ])
      );
    });
  } catch (e) {
    console.error(e);
  }
}

async function loadAnalytics() {
  const container = document.getElementById("analytics");
  if (!container) return;
  try {
    const a = ifoundDB.analytics();
    container.innerHTML = "";
    container.appendChild(h("div", {}, `Total items: ${a.total}`));
    container.appendChild(h("div", {}, `Lost: ${a.lost}`));
    container.appendChild(h("div", {}, `Claimed: ${a.claimed}`));
    container.appendChild(h("div", {}, `Pending reports: ${a.pendingReports}`));
    container.appendChild(h("div", {}, `Recovery rate: ${a.recoveryRate}%`));
  } catch (e) {
    console.error(e);
  }
}

function bindDataControls() {
  const exportBtn = document.getElementById("exportData");
  const importInput = document.getElementById("importFile");
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      try {
        const data = ifoundDB.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ifound-export.json";
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        alert("Export failed");
      }
    });
  }
  if (importInput) {
    importInput.addEventListener("change", async () => {
      const file = importInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const ok = ifoundDB.importMerge(data);
        if (ok) {
          alert("Import complete");
          loadAnalytics();
          loadPending();
          loadClaims();
        } else alert("Import failed");
      } catch (e) {
        alert("Invalid JSON file");
      }
    });
  }
}
