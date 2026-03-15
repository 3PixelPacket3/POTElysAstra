// data-store.js

const EAHADataStore = {
  DB_KEY: 'eaha_master_db',

  async getData() {
    // 1. Check if we already have saved data in the browser memory
    const localData = localStorage.getItem(this.DB_KEY);
    if (localData) {
      return JSON.parse(localData);
    }

    // 2. If no local data exists (first time loading the tool), load the base file
    return await this.loadBaseJSON();
  },

  async loadBaseJSON() {
    try {
      const response = await fetch('JSON.json');
      if (!response.ok) throw new Error('Network response was not ok');
      const fullBackup = await response.json();
      
      // Prepare a clean, stripped-down database
      const strippedDb = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [] };
      
      if (fullBackup.database) {
        // ALLOW: Rules and Guidelines
        if (fullBackup.database.rules) {
          strippedDb.rules = fullBackup.database.rules;
        }
        
        // ALLOW: Creature Profiles (STRIP: Stats)
        if (fullBackup.database.creatures) {
          strippedDb.creatures = fullBackup.database.creatures.map(c => {
            const cleanCreature = { ...c };
            // Wipe the stats out completely to leave a blank slate for the user
            cleanCreature.stats = { base: {}, custom: [] };
            return cleanCreature;
          });
        }
      }

      // ALLOW: Quick Commands and Post Builder Templates
      if (fullBackup.eahaPostPresets) {
         localStorage.setItem('eahaPostPresets', JSON.stringify(fullBackup.eahaPostPresets));
      }
      if (fullBackup.eahaCommands) {
         localStorage.setItem('eahaCommands', JSON.stringify(fullBackup.eahaCommands));
      }

      // STRIP: Ensure private personal keys are wiped so admin data doesn't leak to players
      localStorage.removeItem('eahaLifelines');
      localStorage.removeItem('eahaActiveCreature');

      // Save the sanitized baseline locally to the browser
      await this.saveData(strippedDb);
      return strippedDb;

    } catch (error) {
      console.error("Jarvis Error: Failed to load baseline JSON.json.", error);
      // Return a safe, empty structure if the fetch fails so the app doesn't crash
      return { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [] };
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
    // Completely wipe all existing local storage for the application
    localStorage.removeItem(this.DB_KEY);
    localStorage.removeItem('eahaPostPresets');
    localStorage.removeItem('eahaLifelines');
    localStorage.removeItem('eahaCommands');
    localStorage.removeItem('eahaActiveCreature');
    localStorage.removeItem('eahaTimeZone');
    
    // Reload the app from the pristine JSON.json baseline
    return await this.loadBaseJSON();
  }
};
