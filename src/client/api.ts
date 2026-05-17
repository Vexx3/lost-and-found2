const DB_KEY = 'lostAndFoundDb';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
}

export const api = {
  async getDb(): Promise<any> {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : { items: [], found_reports: [], claims: [] };
  },

  async updateDb(db: any): Promise<any> {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return true;
  },

  async addItem(itemData: any): Promise<any> {
    const db = await this.getDb();
    const newItem = { 
      ...itemData, 
      id: generateId(), 
      createdAt: Date.now(), 
      status: "registered" 
    };
    db.items.push(newItem);
    await this.updateDb(db);
    return newItem;
  },

  async getItem(id: string): Promise<any> {
    const db = await this.getDb();
    return db.items.find((x: any) => x.id === id) || null;
  },

  async listItemsByStudent(studentId: string): Promise<any[]> {
    const db = await this.getDb();
    return db.items
      .filter((item: any) => item.studentId === studentId)
      .sort((a: any, b: any) => (b.createdAt - a.createdAt));
  },

  async listLostItems(): Promise<any[]> {
    const db = await this.getDb();
    return db.items
      .filter((item: any) => item.status === "lost")
      .sort((a: any, b: any) => (b.createdAt - a.createdAt));
  },

  async addFoundReport(reportData: any): Promise<any> {
    const db = await this.getDb();
    const newReport = {
      ...reportData,
      id: generateId(),
      createdAt: Date.now(),
      status: "pending"
    };
    db.found_reports = db.found_reports || [];
    db.found_reports.push(newReport);
    await this.updateDb(db);

    return newReport;
  },
  
  async updateItemStatus(id: string, newStatus: string): Promise<any> {
    const db = await this.getDb();
    let updatedItem = null;
    db.items = db.items.map((item: any) => {
      if (item.id === id) {
        updatedItem = { ...item, status: newStatus };
        return updatedItem;
      }
      return item;
    });
    if (updatedItem) {
      await this.updateDb(db);
    }
    return updatedItem;
  },
  
  /**
   * Send email notification when a found report is verified and item moved to Lost Items
   */
  async notifyVerified(email: string, itemName: string, notes: string): Promise<boolean> {
    if (typeof (window as any).emailjs !== 'undefined') {
      try {
        await (window as any).emailjs.send("default_service", "ifound-report", {
          to_email: email,
          item_name: itemName,
          faculty_notes: notes || "No additional notes."
        });
        console.log("Verification email sent to:", email);
        return true;
      } catch (err) {
        console.error("EmailJS verification email failed:", err);
        return false;
      }
    }
    console.warn("EmailJS not loaded, email notification skipped.");
    return false;
  },

  /**
   * Send email notification when an item is successfully claimed
   */
  async notifyClaimed(email: string, itemName: string, ownerName: string): Promise<boolean> {
    if (typeof (window as any).emailjs !== 'undefined') {
      try {
        await (window as any).emailjs.send("default_service", "ifound-claimed", {
          to_email: email,
          item_name: itemName,
          owner_name: ownerName || "Student"
        });
        console.log("Claim confirmation email sent to:", email);
        return true;
      } catch (err) {
        console.error("EmailJS claim email failed:", err);
        return false;
      }
    }
    console.warn("EmailJS not loaded, claim email notification skipped.");
    return false;
  }
};
