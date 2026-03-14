// js/data-store.js

const EAHADataStore = {
  DB_KEY: 'eaha_master_db',

  async getData() {
    // 1. Check if we already have saved data in the browser
    const localData = localStorage.getItem(this.DB_KEY);
    if (localData) {
      return JSON.parse(localData);
    }

    // 2. If no local data exists, fetch the base-data.json you uploaded
    try {
      const response = await fetch('data/base-data.json');
      if (!response.ok) throw new Error('Network response was not ok');
      const baseData = await response.json();
      
      // Save it locally so we don't have to fetch it every time
      this.saveData(baseData);
      return baseData;
    } catch (error) {
      console.error("Jarvis Error: Failed to load base data.", error);
      // Return a safe, empty structure if the fetch fails
      return { creatures: [], rules: [], stats: [], customPresets: {} };
    }
  },

  async saveData(dataObj) {
    try {
      localStorage.setItem(this.DB_KEY, JSON.stringify(dataObj));
      return true;
    } catch (error) {
      console.error("Jarvis Error: LocalStorage limit reached or blocked.", error);
      return false;
    }
  },

  async resetToBase() {
    localStorage.removeItem(this.DB_KEY);
    return await this.getData();
  }
};
