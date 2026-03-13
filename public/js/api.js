const API_BASE = '/api';
export const api = {
    async request(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, options);
            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error(`Error with ${method} ${endpoint}:`, error);
            throw error;
        }
    },
    async getDb() {
        return this.request('/db');
    },
    async updateDb(db) {
        return this.request('/db', 'PUT', db);
    },
    async addItem(itemData) {
        return this.request('/items', 'POST', itemData);
    },
    async getItem(id) {
        const db = await this.getDb();
        return db.items.find((x) => x.id === id) || null;
    },
    async listItemsByStudent(studentId) {
        const db = await this.getDb();
        return db.items
            .filter((item) => item.studentId === studentId)
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    async listLostItems() {
        const db = await this.getDb();
        return db.items
            .filter((item) => item.status === "lost")
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    async addFoundReport(reportData) {
        return this.request('/found-reports', 'POST', reportData);
    }
};
