// data-store.js

const EAHADataStore = {
  DB_KEY: 'eaha_master_db',

  async getData() {
    const localData = localStorage.getItem(this.DB_KEY);
    if (localData) {
      return JSON.parse(localData);
    }
    return await this.loadBaseJSON();
  },

  async loadBaseJSON() {
    try {
      const response = await fetch('JSON.json');
      if (!response.ok) throw new Error('Network response was not ok');
      const fullBackup = await response.json();
      
      // Added lineage and routes to the base array structure
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
      // Added lineage and routes to the base array structure fallback
      return { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [], lineage: [], routes: [] };
    }
  },

  // NEW: Update App Data (Merge Logic)
  async mergeWithBase() {
    try {
      const response = await fetch('JSON.json');
      if (!response.ok) throw new Error('Network response was not ok');
      const fullBackup = await response.json();
      
      let localDb = await this.getData();
      let addedCount = 0;

      // Ensure older databases get the new arrays patched in
      if (!localDb.lineage) localDb.lineage = [];
      if (!localDb.routes) localDb.routes = [];

      if (fullBackup.database) {
        // 1. Merge Rules (Official overrides local, adds new)
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

        // 2. Merge Creatures (Updates core info, PRESERVES custom stats)
        if (fullBackup.database.creatures) {
          fullBackup.database.creatures.forEach(jsonCrea => {
            const existingIndex = localDb.creatures.findIndex(c => c.id === jsonCrea.id);
            if (existingIndex === -1) {
              // It's a brand new dinosaur!
              const cleanCreature = { ...jsonCrea };
              cleanCreature.stats = { base: jsonCrea.stats?.base || {}, custom: [] };
              localDb.creatures.push(cleanCreature);
              addedCount++;
            } else {
              // It exists. Update base stats/info, but keep their custom mechanics intact.
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

      // 3. Merge Commands (Filters duplicates)
      if (fullBackup.eahaCommands) {
        const localCommands = JSON.parse(localStorage.getItem('eahaCommands')) || [];
        // Use Set to prevent duplicating existing commands
        const mergedCommands = [...new Set([...localCommands, ...fullBackup.eahaCommands])];
        localStorage.setItem('eahaCommands', JSON.stringify(mergedCommands));
      }

      // 4. Merge Presets (Preserves local tweaks if keys match)
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
    localStorage.removeItem('eahaPostPresets');
    localStorage.removeItem('eahaLifelines');
    localStorage.removeItem('eahaCommands');
    localStorage.removeItem('eahaActiveCreature');
    localStorage.removeItem('eahaTimeZone');
    
    return await this.loadBaseJSON();
  }
};
