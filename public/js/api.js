const DB_KEY = 'lostAndFoundDb';
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
}
export const api = {
    async getDb() {
        const data = localStorage.getItem(DB_KEY);
        return data ? JSON.parse(data) : { items: [], found_reports: [], claims: [] };
    },
    async updateDb(db) {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        return true;
    },
    async addItem(itemData) {
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
    async getItem(id) {
        const db = await this.getDb();
        return db.items.find((x) => x.id === id) || null;
    },
    async listItemsByStudent(studentId) {
        const db = await this.getDb();
        return db.items
            .filter((item) => item.studentId === studentId)
            .sort((a, b) => (b.createdAt - a.createdAt));
    },
    async listLostItems() {
        const db = await this.getDb();
        return db.items
            .filter((item) => item.status === "lost")
            .sort((a, b) => (b.createdAt - a.createdAt));
    },
    async addFoundReport(reportData) {
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
    async updateItemStatus(id, newStatus) {
        const db = await this.getDb();
        let updatedItem = null;
        db.items = db.items.map((item) => {
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
    async notifyVerified(email, itemName, notes) {
        if (typeof window.emailjs !== 'undefined') {
            try {
                await window.emailjs.send("default_service", "template_found", {
                    to_email: email,
                    item_name: itemName,
                    faculty_notes: notes || ""
                });
                return true;
            }
            catch (err) {
                console.error("EmailJS sending failed:", err);
                return false;
            }
        }
        return false;
    }
};
