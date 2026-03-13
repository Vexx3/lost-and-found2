import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs/promises";
import nodemailer from "nodemailer";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "database.json");

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increase limit for Base64 photos
app.use(express.static(__dirname)); // Serve root for index.html
app.use("/public", express.static(path.join(__dirname, "public")));

// Mailer Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "your-email@gmail.com",
    pass: process.env.EMAIL_PASS || "your-app-password",
  },
});

// Helper: Read/Write Database
async function readDB() {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      const initDB = { items: [], found_reports: [], claims: [], seq: { found_reports: 0, claims: 0 } };
      await fs.writeFile(DB_FILE, JSON.stringify(initDB, null, 2));
      return initDB;
    }
    throw err;
  }
}

async function writeDB(db: any) {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

// Routes
app.get("/api/db", async (req, res) => {
  const db = await readDB();
  res.json(db);
});

// Admin Replace DB
app.put("/api/db", async (req, res) => {
  await writeDB(req.body);
  res.json({ success: true });
});

// Create Item
app.post("/api/items", async (req, res) => {
  const db = await readDB();
  const newItem = {
    id: crypto.randomUUID(),
    ...req.body,
    status: "registered",
    createdAt: new Date().toISOString()
  };
  db.items.push(newItem);
  await writeDB(db);
  res.status(201).json(newItem);
});

// Add Found Report
app.post("/api/found-reports", async (req, res) => {
  const db = await readDB();
  db.seq.found_reports++;
  const report = {
    id: db.seq.found_reports,
    ...req.body,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  db.found_reports.push(report);
  await writeDB(db);
  res.status(201).json(report);
});

// Notify Verified & Moved to Lost
app.post("/api/notify-verified", async (req, res) => {
  const { reportId } = req.body;
  const db = await readDB();
  const report = db.found_reports.find((r: any) => r.id === reportId);
  if (!report) return res.status(404).json({ error: "Report not found" });

  const item = db.items.find((i: any) => i.id === report.itemId);
  if (item && item.email) {
    const textBody = `Dear ${item.ownerName},

🚨 OFFICIAL NOTIFICATION: Your registered item "${item.itemName}" has been reported as FOUND!

The STI Admin has verified the report, and your item is now securely held at the main office and listed on the official Lost Items board. 

📍 RECOVERY DETAILS:
- Reported by: ${report.finderName || 'Unknown / Anonymous'}
- Location Found: ${report.location || 'Not Specified'}
- Date Reported: ${new Date(report.createdAt).toLocaleString()}

✅ HOW TO CLAIM YOUR ITEM:
1. Log into the iFound system and open the "Lost Items" page.
2. Locate your item and click the "Claim Item" button to submit your claim.
3. Proceed to the Admin Office and present your Student ID to officially retrieve it.

⚠️ SECURITY NOTICE (JOKE / FALSE REPORTS):
If your item is NOT lost and is safely with you, a friend or another student may have scanned your QR sticker as a joke or by mistake. If the item is safely in your possession, NO ACTION is required. You can completely disregard this email. Please ensure your QR stickers remain secure!

Thank you,
The iFound Admin Team
STI College Muñoz-EDSA`;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: item.email,
        subject: `📢 Action Required: Your Item "${item.itemName}" was reported found!`,
        text: textBody
      });
      console.log('Verification email sent to', item.email);
    } catch (e: any) {
      console.error("Verification email delivery failed:", e.message);
    }
  }
  res.json({ success: true });
});

// Submit Claim
app.post("/api/claims", async (req, res) => {
  const db = await readDB();
  db.seq.claims++;
  const claim = {
    id: db.seq.claims,
    ...req.body,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  db.claims.push(claim);

  // Mark the item as claimed temporarily or pending verification
  const item = db.items.find((i: any) => i.id === claim.itemId);
  if (item) {
    item.status = "claimed";
  }

  await writeDB(db);
  res.status(201).json(claim);
});
// Catchall
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Database stored at ${DB_FILE}`);
});