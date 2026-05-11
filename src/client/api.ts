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
    return data ? JSON.parse(data) : { items: [], reports: [] };
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
    db.reports.push(newReport);
    await this.updateDb(db);
    
    // Attempt EmailJS notification if EmailJS is available globally
    const item = await this.getItem(reportData.itemId);
    if (item && item.email && typeof (window as any).emailjs !== 'undefined') {
      try {
        await (window as any).emailjs.send("service_ekzlw6i", "template_ile62wu", {
          to_email: item.email,
          item_name: item.itemName || "Unknown Item",
          faculty_notes: reportData.notes || ""
        });
      } catch (err) {
        console.error("EmailJS sending failed:", err);
      }
    }

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
  
  async notifyVerified(email: string, itemName: string, notes: string): Promise<boolean> {
    if (typeof (window as any).emailjs !== 'undefined') {
      try {
        await (window as any).emailjs.send("default_service", "template_found", {
          to_email: email,
          item_name: itemName,
          faculty_notes: notes || ""
        });
        return true;
      } catch (err) {
        console.error("EmailJS sending failed:", err);
        return false;
      }
    }
    return false;
  }
};
