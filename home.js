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
  setTimeout(() => toast.className = 'toast', 3000);
};

const saveLifelines = () => localStorage.setItem(LIFELINES_KEY, JSON.stringify(lifelines));
const saveCommands = () => localStorage.setItem(COMMANDS_KEY, JSON.stringify(commands));

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
  
  // Add default placeholder option
  select.appendChild(new Option("-- Select Active Dinosaur --", "none"));
  
  db.creatures.forEach(c => select.appendChild(new Option(c.name, c.id)));
  
  // Restore last active, or default to the placeholder
  const savedActive = localStorage.getItem(ACTIVE_CREA_KEY);
  if (savedActive && db.creatures.find(c => c.id === savedActive)) {
    activeCreatureId = savedActive;
  } else {
    activeCreatureId = 'none';
  }
  
  select.value = activeCreatureId;
  
  // Force a UI update on initial load to match the selection
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
      showToast(`Switched tracking to ${select.options[select.selectedIndex].text}`);
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
  
  const health = creature.stats?.base?.health || "N/A";
  const weight = creature.stats?.base?.combatWeight || "N/A";
  const speed = creature.stats?.base?.speed || "N/A";
  
  // Extracting Diet and Habitat directly from the creature's profile
  const diet = (creature.foods && creature.foods.length > 0) ? creature.foods.join(', ') : "Unknown Diet";
  const habitat = (creature.habitat && creature.habitat.length > 0) ? creature.habitat.join(', ') : "Unknown Habitat";
  
  statsEl.innerHTML = `
    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
      <span style="background: var(--bg); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600; border: 1px solid var(--border);">Health: ${health}</span>
      <span style="background: var(--bg); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600; border: 1px solid var(--border);">Weight: ${weight}</span>
      <span style="background: var(--bg); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600; border: 1px solid var(--border);">Speed: ${speed}</span>
      <span style="background: var(--bg); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600; border: 1px solid var(--border);">${creature.tier || 'Unknown Tier'}</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 5px; font-size: 0.95em; width: 100%;">
      <div><strong style="color: var(--muted);">Diet:</strong> ${diet}</div>
      <div><strong style="color: var(--muted);">Habitats:</strong> ${habitat}</div>
    </div>
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
  
  // Dynamic proportional drain based on snapshot values
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
      new Notification("Elys Astra Helper", { body: "Your Upkeep Decay Timer has reached zero. Check your vitals!" });
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
  
  // Calculate unique drain rate for each vital so they all hit 0 exactly when the timer ends
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

// --- Boot Sequence ---
const init = async () => {
  if (typeof EAHADataStore !== 'undefined') {
    db = await EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing or not loaded.");
  }

  // Populate UI before setting up listeners
  populateCreatureDropdown();
  
  populateTimeZones();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  setupLifelineListeners();
  
  setupCommandListeners();
  renderCommands();
};

document.addEventListener('DOMContentLoaded', init);
