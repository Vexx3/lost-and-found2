const API_BASE = '/api';

export const api = {
  async request(endpoint: string, method: string = 'GET', data: any = null): Promise<any> {
    const options: RequestInit = {
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
    } catch (error) {
      console.error(`Error with ${method} ${endpoint}:`, error);
      throw error;
    }
  },

  async getDb(): Promise<any> {
    return this.request('/db');
  },

  async updateDb(db: any): Promise<any> {
    return this.request('/db', 'PUT', db);
  },

  async addItem(itemData: any): Promise<any> {
    return this.request('/items', 'POST', itemData);
  },

  async getItem(id: string): Promise<any> {
    const db = await this.getDb();
    return db.items.find((x: any) => x.id === id) || null;
  },

  async listItemsByStudent(studentId: string): Promise<any[]> {
    const db = await this.getDb();
    return db.items
      .filter((item: any) => item.studentId === studentId)
      .sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async listLostItems(): Promise<any[]> {
    const db = await this.getDb();
    return db.items
      .filter((item: any) => item.status === "lost")
      .sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async addFoundReport(reportData: any): Promise<any> {
    return this.request('/found-reports', 'POST', reportData);
  }
};
