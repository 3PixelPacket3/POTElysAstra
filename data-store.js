// data-store.js

const EAHADataStore = {
  DB_NAME: 'EAHADatabase',
  STORE_NAME: 'eaha_store',
  MASTER_KEY: 'eaha_master_db',

  // 1. Initialize High-Capacity IndexedDB
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  async getIndexedData(key) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async setIndexedData(key, value) {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // 2. Main Retrieval Engine
  async getData() {
    try {
      // Step A: Try to load from the new high-capacity IndexedDB
      const data = await this.getIndexedData(this.MASTER_KEY);
      if (data) return data;

      // Step B: MIGRATION - If no IndexedDB data exists, check old LocalStorage and move it over
      const localData = localStorage.getItem(this.MASTER_KEY);
      if (localData) {
        console.log("Jarvis: Migrating legacy data to high-capacity storage.");
        const parsed = JSON.parse(localData);
        await this.setIndexedData(this.MASTER_KEY, parsed);
        return parsed;
      }
    } catch (e) {
      console.error("Jarvis Error: IndexedDB retrieval failed.", e);
    }

    // Step C: Fallback to Baseline JSON if completely empty
    return await this.loadBaseJSON();
  },

  async loadBaseJSON() {
    try {
      const response = await fetch('JSON.json');
      if (!response.ok) throw new Error('Network response was not ok');
      const fullBackup = await response.json();
      
      const strippedDb = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [], lineage: [], routes: [] };
      
      if (fullBackup.database) {
        if (fullBackup.database.rules) strippedDb.rules = fullBackup.database.rules;
        if (fullBackup.database.creatures) {
          strippedDb.creatures = fullBackup.database.creatures.map(c => {
            const cleanCreature = { ...c };
            cleanCreature.stats = { base: cleanCreature.stats?.base || {}, custom: [] };
            return cleanCreature;
          });
        }
      }

      if (fullBackup.eahaPostPresets) localStorage.setItem('eahaPostPresets', JSON.stringify(fullBackup.eahaPostPresets));
      if (fullBackup.eahaCommands) localStorage.setItem('eahaCommands', JSON.stringify(fullBackup.eahaCommands));

      localStorage.removeItem('eahaLifelines');
      localStorage.removeItem('eahaActiveCreature');

      await this.saveData(strippedDb);
      return strippedDb;

    } catch (error) {
      console.error("Jarvis Error: Failed to load baseline JSON.json.", error);
      return { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [], lineage: [], routes: [] };
    }
  },

  // 3. System Update Engine
  async mergeWithBase() {
    try {
      const response = await fetch('JSON.json');
      if (!response.ok) throw new Error('Network response was not ok');
      const fullBackup = await response.json();
      
      let localDb = await this.getData();
      let addedCount = 0;

      if (!localDb.lineage) localDb.lineage = [];
      if (!localDb.routes) localDb.routes = [];

      if (fullBackup.database) {
        if (fullBackup.database.rules) {
          fullBackup.database.rules.forEach(jsonRule => {
            const existingIndex = localDb.rules.findIndex(r => r.id === jsonRule.id);
            if (existingIndex === -1) {
              localDb.rules.push(jsonRule);
              addedCount++;
            } else {
              localDb.rules[existingIndex] = jsonRule; 
            }
          });
        }

        if (fullBackup.database.creatures) {
          fullBackup.database.creatures.forEach(jsonCrea => {
            const existingIndex = localDb.creatures.findIndex(c => c.id === jsonCrea.id);
            if (existingIndex === -1) {
              const cleanCreature = { ...jsonCrea };
              cleanCreature.stats = { base: jsonCrea.stats?.base || {}, custom: [] };
              localDb.creatures.push(cleanCreature);
              addedCount++;
            } else {
              const existingCustom = localDb.creatures[existingIndex].stats?.custom || [];
              localDb.creatures[existingIndex] = {
                ...jsonCrea,
                stats: {
                  base: jsonCrea.stats?.base || {},
                  custom: existingCustom
                }
              };
            }
          });
        }
      }

      if (fullBackup.eahaCommands) {
        const localCommands = JSON.parse(localStorage.getItem('eahaCommands')) || [];
        const mergedCommands = [...new Set([...localCommands, ...fullBackup.eahaCommands])];
        localStorage.setItem('eahaCommands', JSON.stringify(mergedCommands));
      }

      if (fullBackup.eahaPostPresets) {
        const localPresets = JSON.parse(localStorage.getItem('eahaPostPresets')) || {};
        const mergedPresets = { ...fullBackup.eahaPostPresets, ...localPresets };
        localStorage.setItem('eahaPostPresets', JSON.stringify(mergedPresets));
      }

      await this.saveData(localDb);
      return { success: true, changes: addedCount };

    } catch (error) {
      console.error("Jarvis Error: Merge failed.", error);
      return { success: false };
    }
  },

  // 4. Save to IndexedDB
  async saveData(dataObj) {
    try {
      await this.setIndexedData(this.MASTER_KEY, dataObj);
      return true;
    } catch (error) {
      console.error("Jarvis Error: Storage limit reached or blocked.", error);
      return false;
    }
  },

  // 5. Factory Reset
  async resetToBase() {
    // Clear LocalStorage fragments
    localStorage.removeItem(this.MASTER_KEY);
    localStorage.removeItem('eahaPostPresets');
    localStorage.removeItem('eahaLifelines');
    localStorage.removeItem('eahaCommands');
    localStorage.removeItem('eahaActiveCreature');
    localStorage.removeItem('eahaTimeZone');
    
    // Clear IndexedDB Master
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      transaction.objectStore(this.STORE_NAME).delete(this.MASTER_KEY);
    } catch(e) {}
    
    return await this.loadBaseJSON();
  }
};
