// home.js

// --- Persistent Storage Keys ---
const TIME_ZONE_KEY = 'eahaTimeZone';
const COMMANDS_KEY = 'eahaCommands';
const LIFELINES_KEY = 'eahaLifelines'; 
const ACTIVE_CREA_KEY = 'eahaActiveCreature';

// --- Global State ---
let db = { creatures: [] };
let activeCreatureId = null;
let isEditMode = false;

// Decay Timer State
let decayTimerInterval = null;
let decayEndTime = null;
let exactVitals = { comfort: null, hygiene: null, satiation: null };
let drainRates = { comfort: 0, hygiene: 0, satiation: 0 };

// Default Quick Commands
const defaultCommands = ['!sleep', '!clean', '!bless', '!tasty', '!migrationbuff', '!migrationgrowth', '!info', '!sniff', '!tp'];
let commands = JSON.parse(localStorage.getItem(COMMANDS_KEY)) || defaultCommands;

// Default Lifeline Template
const generateDefaultLifeline = () => ({
  comfort: 100, hygiene: 100, satiation: 100,
  migrations: 0,
  rebirths: { 1: 'none', 2: 'none', 3: 'none' }
});

// Load all saved lifelines (keyed by creature ID)
let lifelines = JSON.parse(localStorage.getItem(LIFELINES_KEY)) || {};

// --- Utilities ---
const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  if (type === 'error') toast.style.backgroundColor = 'var(--danger)';
  else toast.style.backgroundColor = 'var(--primary)';
  setTimeout(() => toast.className = 'toast', 3000);
};

const saveLifelines = () => localStorage.setItem(LIFELINES_KEY, JSON.stringify(lifelines));
const saveCommands = () => localStorage.setItem(COMMANDS_KEY, JSON.stringify(commands));

// Matrix Helpers
const getStatArray = (valStr) => {
  if (!valStr) return [0, 0, 0, 0, 0];
  const parts = String(valStr).split(',').map(s => parseFloat(s.trim()));
  while (parts.length < 5) parts.push(parts[parts.length - 1] || 0);
  return parts;
};

const getAdultStat = (valStr) => {
  if (!valStr) return '-';
  const parts = String(valStr).split(',');
  return parts[parts.length - 1].trim(); 
};

// Arsenal Parser for Dashboard
const getAllAttacks = (dino, stageIndex = 4) => {
  const attacks = [];
  const customStats = dino.stats?.custom || [];

  customStats.forEach(stat => {
    const lowerName = stat.name.toLowerCase();
    if (lowerName.includes('damage') && !lowerName.includes('debuff') && !lowerName.includes('multiplier') && !lowerName.includes('buff')) {
      const baseDmg = getStatArray(stat.value)[stageIndex];
      if (baseDmg > 0) {
        const prefix = stat.name.replace('Damage', '');
        const cdStat = customStats.find(s => s.name.toLowerCase() === `${prefix.toLowerCase()}cooldown`);
        const cd = cdStat ? getStatArray(cdStat.value)[stageIndex] : 1.5; 

        const dps = (baseDmg / cd).toFixed(1);
        const displayName = stat.name.replace('Damage', '') || 'Base Attack';

        attacks.push({ name: displayName, baseDmg, cd, dps });
      }
    }
  });
  
  return attacks.sort((a, b) => parseFloat(b.dps) - parseFloat(a.dps));
};

// Get the currently active lifeline, or create one if it doesn't exist
const getActiveLifeline = () => {
  const targetId = activeCreatureId && activeCreatureId !== 'none' ? activeCreatureId : 'default_lifeline';
  
  if (!lifelines[targetId]) {
    lifelines[targetId] = generateDefaultLifeline();
    saveLifelines();
  }
  return lifelines[targetId];
};

const syncExactVitals = () => {
  const currentLife = getActiveLifeline();
  exactVitals.comfort = currentLife.comfort;
  exactVitals.hygiene = currentLife.hygiene;
  exactVitals.satiation = currentLife.satiation;
};

// --- Active Creature Management & Briefing Panel ---
const populateCreatureDropdown = () => {
  const select = document.getElementById('activeCreatureSelect');
  select.innerHTML = '';
  
  if (!db.creatures || db.creatures.length === 0) {
    select.appendChild(new Option("No Creatures in Database", "none"));
    select.disabled = true;
    activeCreatureId = 'none'; 
    updateBriefingPanel();
    updateVitalsUI();
    updateElderingUI();
    syncExactVitals();
    return;
  }

  select.disabled = false;
  select.appendChild(new Option("-- Select Active Dinosaur --", "none"));
  
  // Sort alphabetically for easy finding
  const sorted = [...db.creatures].sort((a,b) => a.name.localeCompare(b.name));
  sorted.forEach(c => select.appendChild(new Option(c.name, c.id)));
  
  const savedActive = localStorage.getItem(ACTIVE_CREA_KEY);
  if (savedActive && db.creatures.find(c => c.id === savedActive)) {
    activeCreatureId = savedActive;
  } else {
    activeCreatureId = 'none';
  }
  
  select.value = activeCreatureId;
  
  updateBriefingPanel();
  updateVitalsUI();
  updateElderingUI();
  syncExactVitals();
  
  select.addEventListener('change', (e) => {
    activeCreatureId = e.target.value;
    localStorage.setItem(ACTIVE_CREA_KEY, activeCreatureId);
    updateBriefingPanel();
    updateVitalsUI();
    updateElderingUI();
    syncExactVitals(); 
    if(activeCreatureId !== 'none') {
      showToast(`Lifeline Sync Engaged: Tracking ${select.options[select.selectedIndex].text}`);
    }
  });
};

const updateBriefingPanel = () => {
  const nameEl = document.getElementById('briefingName');
  const statsEl = document.getElementById('briefingStats');
  const tasksEl = document.getElementById('briefingTasks');
  
  const creature = db.creatures.find(c => c.id === activeCreatureId);
  
  if (!creature) {
    nameEl.textContent = "General Survival Mode";
    statsEl.innerHTML = '<span class="muted">Select a creature in the dropdown or add one in the Profiles tab to track specific stats, diets, and habitats.</span>';
    tasksEl.innerHTML = '<strong>Upkeep Guide:</strong> Once Satiation, Comfort, or Hygiene reach 0%, use !tasty, !sleep, or !clean. Perform the physical task associated with your dinosaur.';
    return;
  }

  nameEl.textContent = creature.name;
  
  // Extract Clean Adult Stats
  const health = getAdultStat(creature.stats?.base?.health);
  const weight = getAdultStat(creature.stats?.base?.combatWeight);
  const speed = getAdultStat(creature.stats?.base?.speed);
  const armor = getAdultStat(creature.stats?.base?.armor) || 1;
  
  // Extract Arsenal
  const arsenal = getAllAttacks(creature, 4);
  let arsenalHtml = '';
  if (arsenal.length > 0) {
    const primaryAtk = arsenal[0];
    arsenalHtml = `
      <div style="background: color-mix(in srgb, var(--danger) 10%, transparent); padding: 8px; border-radius: 8px; border: 1px solid var(--danger); margin-top: 10px; font-size: 0.9em;">
        <strong style="color: var(--danger); display: block; margin-bottom: 2px;">Primary Arsenal (Adult)</strong>
        <span style="color: var(--text);"><strong>${primaryAtk.name}:</strong> ${primaryAtk.baseDmg} Base Dmg | <span style="color: #10b981;">${primaryAtk.dps} DPS</span></span>
      </div>
    `;
  }

  const diet = (creature.foods && creature.foods.length > 0) ? creature.foods.join(', ') : "Unknown Diet";
  const habitat = (creature.habitat && creature.habitat.length > 0) ? creature.habitat.join(', ') : "Unknown Habitat";
  
  statsEl.innerHTML = `
    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
      <span style="background: var(--bg); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600; border: 1px solid var(--border);" title="Adult Health">HP: ${health}</span>
      <span style="background: var(--bg); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600; border: 1px solid var(--border);" title="Adult Combat Weight">CW: ${weight}</span>
      <span style="background: var(--bg); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600; border: 1px solid var(--border);" title="Adult Armor">Armor: ${armor}</span>
      <span style="background: var(--bg); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600; border: 1px solid var(--border);" title="Adult Speed">Speed: ${speed}</span>
      <span style="background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600; border: 1px solid var(--primary);">${creature.tier || 'Unknown Tier'}</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 5px; font-size: 0.95em; width: 100%;">
      <div><strong style="color: var(--muted);">Diet:</strong> ${diet}</div>
      <div><strong style="color: var(--muted);">Habitats:</strong> ${habitat}</div>
    </div>
    ${arsenalHtml}
  `;

  const upkeepText = creature.upkeep ? creature.upkeep : "No specific upkeep tasks documented for this creature. Perform standard shaking/mud rolling to avoid command abuse.";
  tasksEl.innerHTML = `<strong style="color: var(--primary);">Required Tasks at 0%:</strong> ${upkeepText}`;
};

// --- Elysian Lifeline: Vitals Monitor ---
const updateVitalsUI = () => {
  const currentLife = getActiveLifeline();
  
  document.getElementById('comfortValue').textContent = `${currentLife.comfort}%`;
  document.getElementById('hygieneValue').textContent = `${currentLife.hygiene}%`;
  document.getElementById('satiationValue').textContent = `${currentLife.satiation}%`;
  
  document.getElementById('comfortSlider').value = currentLife.comfort;
  document.getElementById('hygieneSlider').value = currentLife.hygiene;
  document.getElementById('satiationSlider').value = currentLife.satiation;

  const comfortStatus = document.getElementById('comfortStatus');
  if (currentLife.comfort <= 0) {
    comfortStatus.textContent = '⚠️ Armor Nerf Active!';
    comfortStatus.style.color = 'var(--danger)';
  } else if (currentLife.comfort > 70) {
    comfortStatus.textContent = '+ Health Regen Active';
    comfortStatus.style.color = 'var(--success)';
  } else {
    comfortStatus.textContent = 'Status Normal';
    comfortStatus.style.color = 'var(--muted)';
  }
};

const setupLifelineListeners = () => {
  ['comfort', 'hygiene', 'satiation'].forEach(vital => {
    const slider = document.getElementById(`${vital}Slider`);
    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      const currentLife = getActiveLifeline();
      currentLife[vital] = val;
      exactVitals[vital] = val; 
      updateVitalsUI();
      saveLifelines();
    });
  });

  document.getElementById('addMigrationBtn').addEventListener('click', () => {
    const currentLife = getActiveLifeline();
    currentLife.migrations++;
    updateElderingUI();
    saveLifelines();
  });

  document.getElementById('subMigrationBtn').addEventListener('click', () => {
    const currentLife = getActiveLifeline();
    if (currentLife.migrations > 0) {
      currentLife.migrations--;
      updateElderingUI();
      saveLifelines();
    }
  });

  document.querySelectorAll('.rebirth-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const currentLife = getActiveLifeline();
      currentLife.rebirths[e.target.dataset.token] = e.target.value;
      saveLifelines();
    });
  });

  document.getElementById('resetLifelineBtn').addEventListener('click', () => {
    if(confirm('Are you sure you want to reset the current lifeline to 100%?')) {
      const targetId = activeCreatureId && activeCreatureId !== 'none' ? activeCreatureId : 'default_lifeline';
      lifelines[targetId] = generateDefaultLifeline();
      updateVitalsUI();
      updateElderingUI();
      syncExactVitals();
      saveLifelines();
      showToast('Lifeline reset to base values.');
    }
  });
};

// --- Elysian Lifeline: Eldering Tracker ---
const updateElderingUI = () => {
  const currentLife = getActiveLifeline();
  document.getElementById('migrationCount').textContent = currentLife.migrations;
  const stageDisplay = document.getElementById('elderingStageDisplay');
  const rebirthSelects = document.querySelectorAll('.rebirth-select');
  
  let stageHtml = '';
  let isWithering = false;

  if (currentLife.migrations < 4) {
    stageHtml = `<strong style="color: var(--text);">Stage 0: Pre-Elder</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">Requires 4 migrations to reach Tier 1.</p>`;
  } else if (currentLife.migrations >= 4 && currentLife.migrations < 8) {
    stageHtml = `<strong style="color: var(--success);">Stage 1: Young Elder</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">+125 Health, +350 Weight. Slight speed debuff.</p>`;
  } else if (currentLife.migrations >= 8 && currentLife.migrations < 12) {
    stageHtml = `<strong style="color: var(--info);">Stage 2: Inexperienced Elder</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">No extra buffs yet. Keep pushing.</p>`;
  } else if (currentLife.migrations >= 12 && currentLife.migrations < 16) {
    stageHtml = `<strong style="color: #a855f7;">Stage 3: Experienced Elder</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">+125 Health (Stacks). Required: Dull skin, lead pack, eat first.</p>`;
  } else if (currentLife.migrations >= 16) {
    isWithering = true;
    stageHtml = `<strong style="color: var(--danger);">Stage 4: Withering Elder</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">Speed debuff stacks. Slow damage active until death. Rebirth unlocked.</p>`;
  }

  stageDisplay.innerHTML = stageHtml;

  rebirthSelects.forEach(select => {
    select.disabled = !isWithering;
    select.value = currentLife.rebirths[select.dataset.token];
  });
};

// --- Decay Timer Logic ---
const updateTimerDisplay = () => {
  const display = document.getElementById('timerDisplay');
  
  if (decayEndTime && exactVitals.comfort !== null) {
    exactVitals.comfort = Math.max(0, exactVitals.comfort - drainRates.comfort);
    exactVitals.hygiene = Math.max(0, exactVitals.hygiene - drainRates.hygiene);
    exactVitals.satiation = Math.max(0, exactVitals.satiation - drainRates.satiation);

    const currentLife = getActiveLifeline();
    currentLife.comfort = Math.round(exactVitals.comfort);
    currentLife.hygiene = Math.round(exactVitals.hygiene);
    currentLife.satiation = Math.round(exactVitals.satiation);
    
    updateVitalsUI();
    saveLifelines();
  }

  if (!decayEndTime) {
    display.textContent = "00:00";
    display.style.color = "var(--primary)";
    return;
  }
  
  const now = Date.now();
  const remaining = Math.max(0, decayEndTime - now);
  
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  if (remaining <= 0) {
    clearInterval(decayTimerInterval);
    decayEndTime = null;
    drainRates = { comfort: 0, hygiene: 0, satiation: 0 };
    display.style.color = "var(--danger)";
    showToast("⚠️ Decay Timer Complete! Check your Vitals.", "error");
    if (Notification.permission === "granted") {
      new Notification("EAHA Tactical Alert", { body: "Your Upkeep Decay Timer has reached zero. Check your vitals immediately!" });
    }
  }
};

document.getElementById('startTimerBtn').addEventListener('click', () => {
  const mins = parseInt(document.getElementById('timerMinutes').value, 10);
  if (isNaN(mins) || mins <= 0) {
    showToast("Please enter a valid number of minutes.", "error");
    return;
  }
  
  const totalSeconds = mins * 60;
  syncExactVitals(); 
  
  drainRates = {
    comfort: exactVitals.comfort / totalSeconds,
    hygiene: exactVitals.hygiene / totalSeconds,
    satiation: exactVitals.satiation / totalSeconds
  };

  decayEndTime = Date.now() + (mins * 60000);
  if (decayTimerInterval) clearInterval(decayTimerInterval);
  
  document.getElementById('timerDisplay').style.color = "var(--primary)";
  decayTimerInterval = setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();
  
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
});

document.getElementById('resetTimerBtn').addEventListener('click', () => {
  if (decayTimerInterval) clearInterval(decayTimerInterval);
  decayEndTime = null;
  drainRates = { comfort: 0, hygiene: 0, satiation: 0 };
  
  const display = document.getElementById('timerDisplay');
  display.textContent = "00:00";
  display.style.color = "var(--primary)";
  document.getElementById('timerMinutes').value = '';
  
  showToast("Decay timer aborted and reset.");
});

// --- Quick Commands Logic ---
const renderCommands = () => {
  const grid = document.getElementById('commandGrid');
  grid.innerHTML = '';
  
  commands.forEach((command, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    
    if (isEditMode) {
      btn.innerHTML = `${command} <span style="color: var(--danger); margin-left: 8px; font-weight: bold;">✕</span>`;
      btn.style.borderColor = 'var(--danger)';
      btn.addEventListener('click', () => {
        commands.splice(index, 1);
        saveCommands();
        renderCommands();
      });
    } else {
      btn.textContent = command;
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(command);
          document.getElementById('commandStatus').textContent = `Copied: ${command}`;
          document.getElementById('commandStatus').style.color = 'var(--success)';
        } catch (error) {
          document.getElementById('commandStatus').textContent = 'Clipboard access failed.';
        }
      });
    }
    grid.appendChild(btn);
  });
};

const setupCommandListeners = () => {
  document.getElementById('editCommandsToggle').addEventListener('change', (e) => {
    isEditMode = e.target.checked;
    document.getElementById('addCommandForm').classList.toggle('is-hidden', !isEditMode);
    document.getElementById('commandStatus').textContent = isEditMode ? 'Click a command to delete it.' : 'Ready.';
    document.getElementById('commandStatus').style.color = 'var(--muted)';
    renderCommands();
  });

  document.getElementById('saveNewCommandBtn').addEventListener('click', () => {
    const input = document.getElementById('newCommandInput');
    const newCmd = input.value.trim();
    if (newCmd) {
      commands.push(newCmd.startsWith('!') ? newCmd : `!${newCmd}`);
      input.value = '';
      saveCommands();
      renderCommands();
      showToast('Command added.');
    }
  });
};

// --- Time & Clock Logic ---
const timeZones = [
  { label: 'Local Time', value: 'local' },
  { label: 'UTC', value: 'UTC' },
  { label: 'US/Eastern', value: 'America/New_York' },
  { label: 'US/Central', value: 'America/Chicago' },
  { label: 'US/Mountain', value: 'America/Denver' },
  { label: 'US/Pacific', value: 'America/Los_Angeles' }
];

const populateTimeZones = () => {
  const select = document.getElementById('timeZoneSelect');
  timeZones.forEach(zone => select.appendChild(new Option(zone.label, zone.value)));
  select.value = localStorage.getItem(TIME_ZONE_KEY) || 'local';
  select.addEventListener('change', () => {
    localStorage.setItem(TIME_ZONE_KEY, select.value);
    updateDateTime();
  });
};

const updateDateTime = () => {
  const timeZone = document.getElementById('timeZoneSelect').value || 'local';
  const now = new Date();
  
  const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
  const optionsDate = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  
  if (timeZone !== 'local') {
    optionsTime.timeZone = timeZone;
    optionsDate.timeZone = timeZone;
  }
  
  document.getElementById('homeTime').textContent = new Intl.DateTimeFormat(undefined, optionsTime).format(now);
  document.getElementById('homeDate').textContent = new Intl.DateTimeFormat(undefined, optionsDate).format(now);
};

// --- Quick Logger (Combat) Logic ---
const saveEncounter = async (type) => {
  if (!db.encounters) db.encounters = [];
  
  const event = {
    id: 'enc_' + Math.random().toString(36).substr(2, 9),
    type: type,
    creatureId: activeCreatureId,
    timestamp: Date.now()
  };
  
  db.encounters.push(event);
  await EAHADataStore.saveData(db);
  showToast(`${type} logged successfully.`);
};

// --- Boot Sequence ---
const init = async () => {
  if (typeof EAHADataStore !== 'undefined') {
    db = await EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing or not loaded.");
  }

  // Bind Quick Log Buttons
  const logWinBtn = document.getElementById('logWinBtn');
  const logLossBtn = document.getElementById('logLossBtn');
  const logStarveBtn = document.getElementById('logStarveBtn');
  
  if (logWinBtn) logWinBtn.addEventListener('click', () => saveEncounter('win'));
  if (logLossBtn) logLossBtn.addEventListener('click', () => saveEncounter('loss'));
  if (logStarveBtn) logStarveBtn.addEventListener('click', () => saveEncounter('starved'));

  populateCreatureDropdown();
  
  populateTimeZones();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  setupLifelineListeners();
  
  setupCommandListeners();
  renderCommands();
};

document.addEventListener('DOMContentLoaded', init);
