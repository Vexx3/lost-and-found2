const DB_KEY = 'lostAndFoundDb';
// Set this to true and fill in your details to use Supabase
const USE_SUPABASE = true;
const SUPABASE_URL = 'https://mwwiqznxccqlfgvzmxcg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13d2lxem54Y2NxbGZndnpteGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTQwMjksImV4cCI6MjA5NDY3MDAyOX0.AdCjJkJihvKHgBS5cBDjBoek1KAOOj2ahu3BLc2KzV4';
let supabaseInstance = null;
function getSupabase() {
    if (supabaseInstance)
        return supabaseInstance;
    if (USE_SUPABASE) {
        if (typeof window.supabase !== 'undefined') {
            supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        else {
            console.warn("Supabase script not loaded. Falling back to localStorage.");
        }
    }
    return supabaseInstance;
}
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
}
export const api = {
    async getDb() {
        const supabase = getSupabase();
        if (supabase) {
            const [itemsRes, reportsRes, claimsRes] = await Promise.all([
                supabase.from('items').select('*'),
                supabase.from('found_reports').select('*'),
                supabase.from('claims').select('*')
            ]);
            if (itemsRes.error)
                console.error("Items fetch error:", itemsRes.error);
            if (reportsRes.error)
                console.error("Reports fetch error:", reportsRes.error);
            if (claimsRes.error)
                console.error("Claims fetch error:", claimsRes.error);
            return {
                items: itemsRes.data || [],
                found_reports: reportsRes.data || [],
                claims: claimsRes.data || []
            };
        }
        const data = localStorage.getItem(DB_KEY);
        return data ? JSON.parse(data) : { items: [], found_reports: [], claims: [] };
    },
    async updateDb(db) {
        const supabase = getSupabase();
        if (supabase) {
            try {
                const [itemsRes, reportsRes, claimsRes] = await Promise.all([
                    db.items && db.items.length ? supabase.from('items').upsert(db.items).select() : Promise.resolve({ error: null }),
                    db.found_reports && db.found_reports.length ? supabase.from('found_reports').upsert(db.found_reports).select() : Promise.resolve({ error: null }),
                    db.claims && db.claims.length ? supabase.from('claims').upsert(db.claims).select() : Promise.resolve({ error: null }),
                ]);
                if (itemsRes?.error)
                    console.error("Items upsert error:", itemsRes.error);
                if (reportsRes?.error)
                    console.error("Reports upsert error:", reportsRes.error);
                if (claimsRes?.error)
                    console.error("Claims upsert error:", claimsRes.error);
            }
            catch (err) {
                console.error("Supabase bulk upsert failed:", err);
            }
        }
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        return true;
    },
    async addClaim(claimData) {
        const supabase = getSupabase();
        const newClaim = {
            id: "claim-" + Date.now(),
            ...claimData,
            status: "pending_pickup",
            createdAt: Date.now()
        };
        if (supabase) {
            const { data, error } = await supabase.from('claims').insert([newClaim]).select().single();
            if (error)
                throw error;
            return data || newClaim;
        }
        const db = await this.getDb();
        db.claims = db.claims || [];
        db.claims.push(newClaim);
        await this.updateDb(db);
        return newClaim;
    },
    async addItem(itemData) {
        const supabase = getSupabase();
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
        const supabase = getSupabase();
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
        const supabase = getSupabase();
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
        const supabase = getSupabase();
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
        const supabase = getSupabase();
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
        const supabase = getSupabase();
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
