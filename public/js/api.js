const DB_KEY = 'lostAndFoundDb';
// Set this to true and fill in your details to use Supabase
const USE_SUPABASE = true;
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
let supabase = null;
if (USE_SUPABASE && typeof window.supabase !== 'undefined' && SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
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
        const newItem = {
            ...itemData,
            id: generateId(),
            createdAt: Date.now(),
            status: "registered"
        };
        if (supabase) {
            const { data, error } = await supabase.from('items').insert([newItem]).select().single();
            if (error) {
                console.error("Supabase insert error:", error);
                throw error;
            }
            return data || newItem;
        }
        const db = await this.getDb();
        db.items.push(newItem);
        await this.updateDb(db);
        return newItem;
    },
    async getItem(id) {
        if (supabase) {
            const { data, error } = await supabase.from('items').select('*').eq('id', id).single();
            if (error) {
                if (error.code === 'PGRST116')
                    return null; // Not found
                throw error;
            }
            return data;
        }
        const db = await this.getDb();
        return db.items.find((x) => x.id === id) || null;
    },
    async listItemsByStudent(studentId) {
        if (supabase) {
            const { data, error } = await supabase.from('items').select('*').eq('studentId', studentId).order('createdAt', { ascending: false });
            if (error)
                throw error;
            return data || [];
        }
        const db = await this.getDb();
        return db.items
            .filter((item) => item.studentId === studentId)
            .sort((a, b) => (b.createdAt - a.createdAt));
    },
    async listLostItems() {
        if (supabase) {
            const { data, error } = await supabase.from('items').select('*').eq('status', 'lost').order('createdAt', { ascending: false });
            if (error)
                throw error;
            return data || [];
        }
        const db = await this.getDb();
        return db.items
            .filter((item) => item.status === "lost")
            .sort((a, b) => (b.createdAt - a.createdAt));
    },
    async addFoundReport(reportData) {
        const newReport = {
            ...reportData,
            id: generateId(),
            createdAt: Date.now(),
            status: "pending"
        };
        if (supabase) {
            const { data, error } = await supabase.from('found_reports').insert([newReport]).select().single();
            if (error)
                throw error;
            return data || newReport;
        }
        const db = await this.getDb();
        db.found_reports = db.found_reports || [];
        db.found_reports.push(newReport);
        await this.updateDb(db);
        return newReport;
    },
    async updateItemStatus(id, newStatus) {
        if (supabase) {
            const updates = { status: newStatus };
            if (newStatus === "claimed")
                updates.claimedAt = new Date().toISOString();
            else if (newStatus === "lost")
                updates.lostSince = new Date().toISOString();
            else if (newStatus === "returned")
                updates.returnedAt = new Date().toISOString();
            const { data, error } = await supabase.from('items').update(updates).eq('id', id).select().single();
            if (error)
                throw error;
            return data;
        }
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
    /**
     * Send email notification when a found report is verified and item moved to Lost Items
     */
    async notifyVerified(email, itemName, notes) {
        if (typeof window.emailjs !== 'undefined') {
            try {
                await window.emailjs.send("default_service", "ifound-report", {
                    to_email: email,
                    item_name: itemName,
                    faculty_notes: notes || "No additional notes."
                });
                console.log("Verification email sent to:", email);
                return true;
            }
            catch (err) {
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
    async notifyClaimed(email, itemName, ownerName) {
        if (typeof window.emailjs !== 'undefined') {
            try {
                await window.emailjs.send("default_service", "ifound-claimed", {
                    to_email: email,
                    item_name: itemName,
                    owner_name: ownerName || "Student"
                });
                console.log("Claim confirmation email sent to:", email);
                return true;
            }
            catch (err) {
                console.error("EmailJS claim email failed:", err);
                return false;
            }
        }
        console.warn("EmailJS not loaded, claim email notification skipped.");
        return false;
    }
};
