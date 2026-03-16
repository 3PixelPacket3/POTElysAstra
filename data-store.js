// data-store.js

// --- EAHA GLOBAL MODIFIERS DICTIONARY ---
// Centralized stats for Roles, Mutations, Genetics, and Eldering
window.EAHAModifiers = {
  roles: {
    "None": { description: "No role equipped." },
    "Alpha": { turn: 0.15, description: "turn radius +0.15" },
    "Banshee": { weight: 375, stamina: 50, health: -100, description: "weight +375, max stamina +50, max health -100" },
    "Fallen": { speed: 0.25, turn: 0.2, weight: -200, description: "speed +0.25, turn radius +0.2, weight -200" },
    "Matriarch": { description: "Group size defender buffs. No direct stat changes." },
    "Repterus": { weight: 150, speed: 0.05, armor: -0.025, description: "weight +150, speed +0.05, armor -0.025" },
    "Roamer": { weight: 400, armor: 0.1, stamina: 60, health: -150, description: "weight +400, armor +0.1, max stamina +60, max health -150" },
    "Shepherd": { description: "Increases herd defense size. No direct stat changes." },
    "Albino": { staminaRegen: 0.2, turn: 0.15, health: -75, armor: -0.05, description: "stamina regen +0.2, turn radius +0.15, max health -75, armor -0.05" },
    "Melanistic": { knockback: 0.3, armor: 0.05, stamina: -75, description: "knockback +0.3, armor +0.05, max stamina -75" },
    "Ashen": { speed: 0.1, stamina: 45, carry: 500, description: "speed +0.1, fall resistance +650, max stamina +45, carry capacity +500" },
    "Cursed": { weight: 100, health: 100, turn: 0.3, description: "weight +100, max health +100, turn radius +0.3" },
    "Frostbitten": { health: 300, armor: 0.1, speed: 0.1, weight: -400, jump: -0.6, description: "max health +300, armor +0.1, speed +0.1, weight -400, jump -0.6" },
    "Infested": { health: 175, turn: 0.15, armor: -0.05, speed: -0.05, description: "max health +175, turn radius +0.15, armor -0.05, speed -0.05" },
    "Nomad": { speed: 0.3, weight: -500, health: -50, description: "speed +0.3, fall resistance +300, weight -500, max health -50" },
    "Protector": { health: 350, healRate: 0.3, description: "max health +350, health regen +0.3" },
    "Repterus Mutatus (RMT)": { weight: 300, speed: 0.07, health: -100, armor: -0.05, description: "weight +300, speed +0.07, max health -100, armor -0.05" },
    "Zephyrion": { weight: 150, speed: 0.25, turn: 0.1, description: "weight +150, speed +0.25, turn radius +0.1" },
    "Apex": { speed: 0.25, description: "speed +0.25" },
    "Splicer": { weight: 575, description: "weight +575" },
    "Vanguard": { armor: 0.25, description: "armor +0.25" },
    "Bounty Hunter (BH)": { weight: 350, speed: 0.15, turn: 0.2, description: "weight +350, speed +0.15, turn radius +0.2" },
    "Cannibal": { weight: 395, speed: 0.19, turn: 0.19, description: "combat weight +395, speed +0.19, turn radius +0.19" },
    "Dark Urge (DU)": { speed: 0.1, turn: 0.25, description: "speed +0.1, turn radius +0.25" },
    "Gluttony": { carry: 750, armor: 0.15, stamina: 150, speed: -0.3, description: "carry capacity +750, armor +0.15, max stamina +150, speed -0.3" },
    "Ice Breaker (IB)": { weight: 380, health: 150, armor: 0.2, description: "weight +380, max health +150, armor +0.2" },
    "Kryptic Plague (KP)": { weight: 300, speed: 0.07, description: "weight +300, speed +0.07" },
    "Mimic": { health: 150, stamina: 50, armor: 0.01, weight: -150, description: "max health +150, max stamina +50, armor +0.01, weight -150" },
    "Rabies": { weight: 400, speed: 0.01, turn: 0.01, health: -100, description: "weight +400, speed +0.01, turn radius +0.01, max health -100" },
    "Ravenous": { speed: 0.25, weight: 250, stamina: -50, description: "speed +0.25, acceleration speed +0.25, weight +250, max stamina -50" },
    "Sentinel": { turn: 0.25, armor: 0.2, knockback: 0.1, description: "turn radius +0.25, armor +0.2, knockback +0.1" }
  },
  mutations: {
    "None": { description: "No mutation equipped." },
    "Weight Mutation": { weight: 100, description: "+100 Weight" },
    "Stamina Mutation": { stamina: 35, description: "+35 Stamina" },
    "Speed Mutation": { speed: 0.06, description: "+0.06 Speed" },
    "Armor Mutation": { armor: 0.035, description: "+0.035 Armor" },
    "Turn Mutation": { turn: 0.035, description: "+0.035 Turn Radius" },
    "Weight x Stamina": { weight: 150, stamina: 50, description: "+150 Weight, +50 Stamina" },
    "Weight x Health": { weight: 150, health: 75, description: "+150 Weight, +75 Health" },
    "Armor x Stamina": { armor: 0.05, stamina: 50, description: "+0.05 Armor, +50 Stamina" },
    "Armor x Health": { armor: 0.05, health: 50, description: "+0.05 Armor, +50 Health" }
  },
  genetics: {
    "Speed Genetic": { speed: 0.075, description: "+0.075 Speed" },
    "Turn Genetic": { turn: 0.075, description: "+0.075 Turn Radius" },
    "Survival Genetic": { staminaRegen: 0.1, healRate: 0.1, description: "+0.1 Stamina/Heal Rate" },
    "Oxygen Genetic": { oxygen: 15, description: "+15 Oxygen" },
    "Jump Genetic": { jump: 0.75, description: "+0.75 Jump Height" },
    "Buff/Nerf Genetic": { buffDuration: 0.25, description: "+0.25 Buff/Nerf Duration" }
  },
  eldering: {
    0: { name: "Stage 0: Pre-Elder", description: "No extra buffs.", health: 0, weight: 0, speed: 0, turn: 0 },
    1: { name: "Stage 1: Young Elder", description: "+125 health, +350 weight, -0.125 speed, +0.25 turn", health: 125, weight: 350, speed: -0.125, turn: 0.25 },
    2: { name: "Stage 2: Inexperienced Elder", description: "+125 health, +350 weight, -0.125 speed, +0.25 turn", health: 125, weight: 350, speed: -0.125, turn: 0.25 },
    3: { name: "Stage 3: Experienced Elder", description: "+250 health, +350 weight, -0.16 speed, +0.25 turn", health: 250, weight: 350, speed: -0.16, turn: 0.25 },
    4: { name: "Stage 4: Withering Elder", description: "+250 health, +350 weight, -0.195 speed, +0.25 turn (Slow decay active)", health: 250, weight: 350, speed: -0.195, turn: 0.25 }
  }
};

const EAHADataStore = {
  DB_NAME: 'EAHADatabase',
  STORE_NAME: 'eaha_store',
  MASTER_KEY: 'eaha_master_db',

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

  async getData() {
    try {
      const data = await this.getIndexedData(this.MASTER_KEY);
      if (data) return data;

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
            cleanCreature.role = cleanCreature.role || 'None';
            cleanCreature.mutation = cleanCreature.mutation || 'None';
            // Array Migration for Genetics
            cleanCreature.genetics = cleanCreature.genetics || (cleanCreature.genetic && cleanCreature.genetic !== 'None' ? [cleanCreature.genetic] : []);
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
              cleanCreature.role = jsonCrea.role || 'None';
              cleanCreature.mutation = jsonCrea.mutation || 'None';
              // Array Migration for Genetics
              cleanCreature.genetics = jsonCrea.genetics || (jsonCrea.genetic && jsonCrea.genetic !== 'None' ? [jsonCrea.genetic] : []);
              localDb.creatures.push(cleanCreature);
              addedCount++;
            } else {
              const existingCustom = localDb.creatures[existingIndex].stats?.custom || [];
              localDb.creatures[existingIndex] = {
                ...jsonCrea,
                stats: {
                  base: jsonCrea.stats?.base || {},
                  custom: existingCustom
                },
                role: localDb.creatures[existingIndex].role || 'None',
                mutation: localDb.creatures[existingIndex].mutation || 'None',
                genetics: localDb.creatures[existingIndex].genetics || (localDb.creatures[existingIndex].genetic && localDb.creatures[existingIndex].genetic !== 'None' ? [localDb.creatures[existingIndex].genetic] : [])
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

  async saveData(dataObj) {
    try {
      await this.setIndexedData(this.MASTER_KEY, dataObj);
      return true;
    } catch (error) {
      console.error("Jarvis Error: Storage limit reached or blocked.", error);
      return false;
    }
  },

  async resetToBase() {
    localStorage.removeItem(this.MASTER_KEY);
    localStorage.removeItem('eahaPostPresets');
    localStorage.removeItem('eahaLifelines');
    localStorage.removeItem('eahaCommands');
    localStorage.removeItem('eahaActiveCreature');
    localStorage.removeItem('eahaTimeZone');
    
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      transaction.objectStore(this.STORE_NAME).delete(this.MASTER_KEY);
    } catch(e) {}
    
    return await this.loadBaseJSON();
  }
};
