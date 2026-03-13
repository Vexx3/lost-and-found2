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

    const htmlBody = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #ef4444;">🚨 Item Found Notification</h2>
      <p>Dear <b>${item.ownerName}</b>,</p>
      <p>Your registered item "<b>${item.itemName}</b>" has been officially reported as <strong>FOUND</strong>!</p>
      <p>The STI Admin has verified the report, and your item is now securely held at the main office and listed on the official Lost Items board.</p>
      
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1f2937;">📍 Recovery Details:</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
          <li><b>Reported by:</b> ${report.finderName || 'Unknown / Anonymous'}</li>
          <li><b>Location Found:</b> ${report.location || 'Not Specified'}</li>
          <li><b>Date Reported:</b> ${new Date(report.createdAt).toLocaleString()}</li>
        </ul>
      </div>

      ${report.photoDataUrl ? `
      <div style="margin: 20px 0;">
        <h3>📸 Photo of your found item:</h3>
        <img src="cid:founditemphoto" alt="Found Item" style="max-width: 100%; border-radius: 8px; border: 1px solid #ccc;"/>
      </div>
      ` : ''}

      <h3>✅ How to Claim Your Item:</h3>
      <ol>
        <li>Log into the iFound system and open the "Lost Items" page.</li>
        <li>Locate your item and click the "Claim Item" button to submit your claim.</li>
        <li>Proceed to the Admin Office and present your <b>Student ID</b> to officially retrieve it.</li>
      </ol>

      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
      
      <div style="font-size: 13px; color: #6b7280; background: #fffbeb; padding: 15px; border-left: 4px solid #f59e0b; border-radius: 4px;">
        ⚠️ <b>SECURITY NOTICE (JOKE / FALSE REPORTS):</b><br/>
        If your item is NOT lost and is safely with you, a friend or another student may have scanned your QR sticker as a joke or by mistake. If the item is safely in your possession, NO ACTION is required. You can completely disregard this email. Please ensure your QR stickers remain secure!
      </div>

      <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
        Thank you,<br/>
        <b>The iFound Admin Team</b><br/>
        STI College Muñoz-EDSA
      </p>
    </div>`;

    const mailOptions: any = {
      from: `"iFound Admin Team" <${process.env.EMAIL_USER}>`,
      to: item.email,
      subject: `📢 Action Required: Your Item "${item.itemName}" was reported found!`,
      text: textBody,
      html: htmlBody
    };

    if (report.photoDataUrl && report.photoDataUrl.startsWith('data:image')) {
      const matches = report.photoDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mailOptions.attachments = [{
          filename: 'found-item.jpg',
          content: Buffer.from(matches[2], 'base64'),
          cid: 'founditemphoto'
        }];
      }
    }

    try {
      await transporter.sendMail(mailOptions);
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