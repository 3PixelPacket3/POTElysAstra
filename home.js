// home.js
import { auth, db as firestoreDb } from './data-store.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"; 

// --- Persistent Storage Keys ---
const TIME_ZONE_KEY = 'eahaTimeZone';
const COMMANDS_KEY = 'eahaCommands';
const LIFELINES_KEY = 'eahaLifelines'; 
const ACTIVE_CREA_KEY = 'eahaActiveCreature';
const WIDGET_PREFS_KEY = 'eaha_widgets'; 

// --- Global State ---
let db = { creatures: [], encounters: [], system_settings: {}, activeGroupId: null }; 
let activeCreatureId = null;
let isEditMode = false;

// Decay Timer State
let decayTimerInterval = null;
let decayEndTime = null;
let exactVitals = { comfort: null, hygiene: null, satiation: null };
let drainRates = { comfort: 0, hygiene: 0, satiation: 0 };

// Live Telemetry State
let activeTelemetryListener = null;
let deathCauseChartInstance = null;

// Default Quick Commands
const defaultCommands = ['!sleep', '!clean', '!bless', '!tasty', '!migrationbuff', '!migrationgrowth', '!info', '!sniff', '!tp'];
let commands = JSON.parse(localStorage.getItem(COMMANDS_KEY)) || defaultCommands;

// Default Lifeline Template
const generateDefaultLifeline = () => ({
  comfort: 100, hygiene: 100, satiation: 100,
  migrations: 0,
  rebirths: { 1: 'none', 2: 'none', 3: 'none' }
});

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

const runQuickThreat = () => {
    const outputEl = document.getElementById('quickThreatOutput');
    const targetSelect = document.getElementById('quickTargetSelect');
    if (!outputEl || !targetSelect) return;

    if (activeCreatureId === 'none' || targetSelect.value === 'none') {
        outputEl.innerHTML = '<span class="muted">Select an active dinosaur and target to run scan.</span>';
        return;
    }

    const activeCrea = db.creatures.find(c => c.id === activeCreatureId);
    const targetCrea = db.creatures.find(c => c.id === targetSelect.value);

    if (!activeCrea || !targetCrea) return;

    const weightA = parseFloat(getAdultStat(activeCrea.stats?.base?.combatWeight)) || 1;
    const weightB = parseFloat(getAdultStat(targetCrea.stats?.base?.combatWeight)) || 1;
    const armorA = parseFloat(getAdultStat(activeCrea.stats?.base?.armor)) || 1;
    const armorB = parseFloat(getAdultStat(targetCrea.stats?.base?.armor)) || 1;

    const multiA = weightB > 0 ? (weightA / weightB) / armorB : 1;
    const multiB = weightA > 0 ? (weightB / weightA) / armorA : 1;

    const arsenalA = getAllAttacks(activeCrea, 4);
    const arsenalB = getAllAttacks(targetCrea, 4);

    const dpsA = arsenalA.length > 0 ? (arsenalA[0].baseDmg * multiA) / arsenalA[0].cd : 0;
    const dpsB = arsenalB.length > 0 ? (arsenalB[0].baseDmg * multiB) / arsenalB[0].cd : 0;

    let advice = "";
    let color = "var(--text)";
    if (weightA > weightB && dpsA > dpsB) {
        advice = "👑 OVERWHELMING ADVANTAGE"; color = "var(--success)";
    } else if (weightA > weightB && dpsA <= dpsB) {
        advice = "⚠️ WEIGHT ADVANTAGE (CAUTION)"; color = "var(--info)";
    } else if (weightA < weightB) {
        advice = "💀 LETHAL THREAT"; color = "var(--danger)";
    } else {
        advice = "⚔️ EVEN MATCHUP"; color = "var(--info)";
    }

    outputEl.innerHTML = `
        <div style="font-size: 1.1em; font-weight: bold; color: ${color}; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px; width: 100%; text-align: center;">${advice}</div>
        <div style="display: flex; width: 100%; justify-content: space-around; font-size: 0.95em;">
            <div style="text-align: center;">
                <strong style="color: var(--primary); display: block; margin-bottom: 4px;">You</strong>
                Weight: ${weightA}<br>
                Est. DPS: <span style="color: var(--success); font-weight: bold;">${dpsA.toFixed(1)}</span>
            </div>
            <div style="display: flex; align-items: center; font-weight: bold; color: var(--muted); font-size: 1.2em;">VS</div>
            <div style="text-align: center;">
                <strong style="color: var(--danger); display: block; margin-bottom: 4px;">Target</strong>
                Weight: ${weightB}<br>
                Est. DPS: <span style="color: var(--danger); font-weight: bold;">${dpsB.toFixed(1)}</span>
            </div>
        </div>
        <p class="muted" style="margin-top: 12px; font-size: 0.75em; text-transform: uppercase;">*Raw Adult Stats Used</p>
    `;
};

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

const populateCreatureDropdown = () => {
  const select = document.getElementById('activeCreatureSelect');
  const targetSelect = document.getElementById('quickTargetSelect');
  
  select.innerHTML = '';
  if (targetSelect) targetSelect.innerHTML = '<option value="none">-- Awaiting Target --</option>';
  
  if (!db.creatures || db.creatures.length === 0) {
    select.appendChild(new Option("No Creatures in Database", "none"));
    select.disabled = true;
    activeCreatureId = 'none'; 
    updateBriefingPanel();
    updateVitalsUI();
    updateElderingUI();
    syncExactVitals();
    updateCombatAnalytics(); 
    return;
  }

  select.disabled = false;
  select.appendChild(new Option("-- Select Active Dinosaur --", "none"));
  
  const sorted = [...db.creatures].sort((a,b) => a.name.localeCompare(b.name));
  sorted.forEach(c => {
      select.appendChild(new Option(c.name, c.id));
      if (targetSelect) targetSelect.appendChild(new Option(c.name, c.id));
  });
  
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
  updateCombatAnalytics(); 
  runQuickThreat(); 
  
  select.addEventListener('change', (e) => {
    activeCreatureId = e.target.value;
    localStorage.setItem(ACTIVE_CREA_KEY, activeCreatureId);
    updateBriefingPanel();
    updateVitalsUI();
    updateElderingUI();
    syncExactVitals(); 
    updateCombatAnalytics(); 
    runQuickThreat();
    if(activeCreatureId !== 'none') {
      showToast(`Lifeline Sync Engaged: Tracking ${select.options[select.selectedIndex].text}`);
    }
  });

  if (targetSelect) targetSelect.addEventListener('change', runQuickThreat);
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
  
  const health = getAdultStat(creature.stats?.base?.health);
  const weight = getAdultStat(creature.stats?.base?.combatWeight);
  const speed = getAdultStat(creature.stats?.base?.speed);
  const armor = getAdultStat(creature.stats?.base?.armor) || 1;
  
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

  const role = creature.role || 'None';
  const mutation = creature.mutation || 'None';
  const genetics = creature.genetics || (creature.genetic && creature.genetic !== 'None' ? [creature.genetic] : []);
  
  const roleDesc = window.EAHAModifiers?.roles?.[role]?.description || '';
  const mutDesc = window.EAHAModifiers?.mutations?.[mutation]?.description || '';
  
  const currentLife = getActiveLifeline();
  const migrations = currentLife.migrations || 0;
  let stage = 0;
  if (migrations >= 16) stage = 4;
  else if (migrations >= 12) stage = 3;
  else if (migrations >= 8) stage = 2;
  else if (migrations >= 4) stage = 1;
  
  const elderDesc = window.EAHAModifiers?.eldering?.[stage]?.description || '';
  const stageName = window.EAHAModifiers?.eldering?.[stage]?.name || 'Pre-Elder';

  let modifiersHtml = `<div style="margin-top: 15px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; width: 100%;">`;
  
  if (role !== 'None') {
    modifiersHtml += `<div style="background: color-mix(in srgb, var(--accent) 15%, transparent); padding: 10px; border-radius: 8px; border: 1px solid var(--accent); font-size: 0.85em;"><strong style="color: var(--accent); display:block; margin-bottom: 3px;">Role: ${role}</strong><span class="muted">${roleDesc}</span></div>`;
  }
  
  if (mutation !== 'None') {
    modifiersHtml += `<div style="background: color-mix(in srgb, var(--info) 15%, transparent); padding: 10px; border-radius: 8px; border: 1px solid var(--info); font-size: 0.85em;"><strong style="color: var(--info); display:block; margin-bottom: 3px;">Mutation: ${mutation}</strong><span class="muted">${mutDesc}</span></div>`;
  }
  
  genetics.forEach(gen => {
    if (gen !== 'None') {
      const genDesc = window.EAHAModifiers?.genetics?.[gen]?.description || '';
      modifiersHtml += `<div style="background: color-mix(in srgb, var(--success) 15%, transparent); padding: 10px; border-radius: 8px; border: 1px solid var(--success); font-size: 0.85em;"><strong style="color: var(--success); display:block; margin-bottom: 3px;">Genetic: ${gen}</strong><span class="muted">${genDesc}</span></div>`;
    }
  });
  
  modifiersHtml += `<div style="background: color-mix(in srgb, var(--primary) 15%, transparent); padding: 10px; border-radius: 8px; border: 1px solid var(--primary); font-size: 0.85em;"><strong style="color: var(--primary); display:block; margin-bottom: 3px;">${stageName}</strong><span class="muted">${elderDesc}</span></div>`;
  modifiersHtml += `</div>`;
  
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
    ${modifiersHtml}
  `;

  const upkeepText = creature.upkeep ? creature.upkeep : "No specific upkeep tasks documented for this creature. Perform standard shaking/mud rolling to avoid command abuse.";
  tasksEl.innerHTML = `<strong style="color: var(--primary);">Required Tasks at 0%:</strong> ${upkeepText}`;
};

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
    if(activeCreatureId && activeCreatureId !== 'none') updateBriefingPanel();
    saveLifelines();
  });

  document.getElementById('subMigrationBtn').addEventListener('click', () => {
    const currentLife = getActiveLifeline();
    if (currentLife.migrations > 0) {
      currentLife.migrations--;
      updateElderingUI();
      if(activeCreatureId && activeCreatureId !== 'none') updateBriefingPanel();
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
      if(activeCreatureId && activeCreatureId !== 'none') updateBriefingPanel();
      showToast('Lifeline reset to base values.');
    }
  });
};

const updateElderingUI = () => {
  const currentLife = getActiveLifeline();
  document.getElementById('migrationCount').textContent = currentLife.migrations;
  const stageDisplay = document.getElementById('elderingStageDisplay');
  const rebirthSelects = document.querySelectorAll('.rebirth-select');
  
  let stageHtml = '';
  let isWithering = false;

  if (currentLife.migrations < 4) {
    stageHtml = `<strong style="color: var(--text);">${window.EAHAModifiers?.eldering?.[0]?.name || 'Stage 0: Pre-Elder'}</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">Requires 4 migrations to reach Tier 1.</p>`;
  } else if (currentLife.migrations >= 4 && currentLife.migrations < 8) {
    stageHtml = `<strong style="color: var(--success);">${window.EAHAModifiers?.eldering?.[1]?.name || 'Stage 1'}</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">${window.EAHAModifiers?.eldering?.[1]?.description}</p>`;
  } else if (currentLife.migrations >= 8 && currentLife.migrations < 12) {
    stageHtml = `<strong style="color: var(--info);">${window.EAHAModifiers?.eldering?.[2]?.name || 'Stage 2'}</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">${window.EAHAModifiers?.eldering?.[2]?.description}</p>`;
  } else if (currentLife.migrations >= 12 && currentLife.migrations < 16) {
    stageHtml = `<strong style="color: #a855f7;">${window.EAHAModifiers?.eldering?.[3]?.name || 'Stage 3'}</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">${window.EAHAModifiers?.eldering?.[3]?.description}</p>`;
  } else if (currentLife.migrations >= 16) {
    isWithering = true;
    stageHtml = `<strong style="color: var(--danger);">${window.EAHAModifiers?.eldering?.[4]?.name || 'Stage 4'}</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">${window.EAHAModifiers?.eldering?.[4]?.description} Rebirth unlocked.</p>`;
  }

  stageDisplay.innerHTML = stageHtml;

  rebirthSelects.forEach(select => {
    select.disabled = !isWithering;
    select.value = currentLife.rebirths[select.dataset.token];
  });
};

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
      commands.push(newCmd); 
      input.value = '';
      saveCommands();
      renderCommands();
      showToast('Command added.');
    }
  });
};

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

const saveEncounter = async (type) => {
  if (!db.encounters) db.encounters = [];
  
  let outcomeText = 'Unknown';
  if (type === 'win') outcomeText = 'Victory (Kill)';
  if (type === 'loss') outcomeText = 'Defeat (PvP)';
  if (type === 'starved') outcomeText = 'Defeat (Environment)';
  
  const activeCrea = db.creatures.find(c => c.id === activeCreatureId);
  const creaName = activeCrea ? activeCrea.name : 'Unknown';

  const targetSelect = document.getElementById('quickTargetSelect');
  let oppName = 'Unknown';
  if (targetSelect && targetSelect.value !== 'none') {
      const oppCrea = db.creatures.find(c => c.id === targetSelect.value);
      if (oppCrea) oppName = oppCrea.name;
  }

  const event = {
    id: 'enc_' + Math.random().toString(36).substr(2, 9),
    outcome: outcomeText,
    myCreature: creaName,
    date: new Date().toISOString().split('T')[0],
    opponent: oppName,
    location: 'Logged via Quick Dashboard',
    notes: 'Quick logged from home screen.',
    timestamp: Date.now()
  };
  
  db.encounters.push(event);
  await window.EAHADataStore.saveData(db);
  showToast(`${outcomeText} logged successfully against ${oppName}.`);
  updateCombatAnalytics(); 
  
  // JARVIS UPGRADE: Re-render the new widgets if they are active
  renderDashboardWidgets();

  if (targetSelect) {
      targetSelect.value = 'none';
      runQuickThreat();
  }
};

const updateCombatAnalytics = () => {
  if (!db.encounters) db.encounters = [];
  
  let overallKills = 0;
  let overallDeaths = 0;
  let activeKills = 0;
  let activeDeaths = 0;
  
  const deathCauses = {
    'PvP Combat': 0,
    'Starvation': 0,
    'Dehydration': 0,
    'Fall Damage': 0,
    'Drowning': 0,
    'Environment': 0,
    'Unknown': 0
  };

  const activeCrea = db.creatures.find(c => c.id === activeCreatureId);
  const activeName = activeCrea ? activeCrea.name : null;

  db.encounters.forEach(enc => {
    const isKill = enc.outcome.includes('Victory');
    const isDeath = enc.outcome.includes('Defeat');

    if (isKill) overallKills++;
    if (isDeath) {
      overallDeaths++;
      
      if (enc.outcome.includes('(PvP)')) deathCauses['PvP Combat']++;
      else if (enc.outcome.includes('(Starvation)')) deathCauses['Starvation']++;
      else if (enc.outcome.includes('(Dehydration)')) deathCauses['Dehydration']++;
      else if (enc.outcome.includes('(Fall)')) deathCauses['Fall Damage']++;
      else if (enc.outcome.includes('(Drowned)')) deathCauses['Drowning']++;
      else if (enc.outcome.includes('(Environment)')) deathCauses['Environment']++;
      else deathCauses['Unknown']++;
    }

    if (activeName && enc.myCreature === activeName) {
      if (isKill) activeKills++;
      if (isDeath) activeDeaths++;
    }
  });

  const calcKD = (k, d) => d === 0 ? k.toFixed(1) : (k / d).toFixed(2);
  document.getElementById('overall-kd').textContent = calcKD(overallKills, overallDeaths);
  document.getElementById('creature-kd').textContent = activeName ? calcKD(activeKills, activeDeaths) : '--';
  document.getElementById('creature-kd').style.color = activeName ? 'var(--primary)' : 'var(--text)';

  const totalEncounters = overallKills + overallDeaths;
  const winPercent = totalEncounters > 0 ? Math.round((overallKills / totalEncounters) * 100) : 0;
  const lossPercent = totalEncounters > 0 ? Math.round((overallDeaths / totalEncounters) * 100) : 0;

  const breakdownEl = document.getElementById('outcomeBreakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = `
      <div style="background: var(--bg-alt); padding: 15px; border-radius: 12px; border: 1px solid var(--border); height: 100%; display: flex; flex-direction: column; justify-content: center;">
        <strong style="color: var(--text); display: block; margin-bottom: 15px; border-bottom: 1px solid var(--border); padding-bottom: 8px; font-size: 1.1em;">Engagement Split</strong>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 1.05em;">
          <span style="color: #10b981;">👑 Victories</span>
          <span style="font-weight: bold;">${overallKills} <span class="muted" style="font-weight: normal; font-size: 0.85em;">(${winPercent}%)</span></span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 1.05em;">
          <span style="color: var(--danger);">💀 Defeats</span>
          <span style="font-weight: bold;">${overallDeaths} <span class="muted" style="font-weight: normal; font-size: 0.85em;">(${lossPercent}%)</span></span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px dashed var(--border); font-size: 1.1em;">
          <span style="color: var(--muted);">Total Logs</span>
          <span style="font-weight: 800; color: var(--primary);">${totalEncounters}</span>
        </div>
      </div>
    `;
  }

  renderDeathChart(deathCauses);
};

const renderDeathChart = (causesData) => {
  const ctx = document.getElementById('deathCauseChart');
  if (!ctx) return;

  const labels = [];
  const data = [];
  const bgColors = [];

  const colorMap = {
    'PvP Combat': '#ef4444',   
    'Starvation': '#f59e0b',   
    'Dehydration': '#3b82f6',  
    'Fall Damage': '#a855f7',  
    'Drowning': '#0ea5e9',
    'Environment': '#10b981',
    'Unknown': '#64748b'       
  };

  Object.entries(causesData).forEach(([cause, count]) => {
    if (count > 0) {
      labels.push(cause);
      data.push(count);
      bgColors.push(colorMap[cause]);
    }
  });

  if (deathCauseChartInstance) {
    deathCauseChartInstance.destroy();
  }

  if (data.length === 0) {
    ctx.style.display = 'none';
    const container = ctx.parentElement;
    if(!document.getElementById('emptyChartMsg')) {
      const msg = document.createElement('p');
      msg.id = 'emptyChartMsg';
      msg.className = 'muted';
      msg.style.textAlign = 'center';
      msg.style.marginTop = '80px';
      msg.textContent = 'No casualties reported. Perfect survival record.';
      container.appendChild(msg);
    }
    return;
  }

  ctx.style.display = 'block';
  const emptyMsg = document.getElementById('emptyChartMsg');
  if(emptyMsg) emptyMsg.remove();

  deathCauseChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: bgColors,
        borderWidth: 2,
        borderColor: '#0f172a' 
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#f8fafc', font: { family: 'Courier New' } }
        }
      }
    }
  });
};

// --- JARVIS UPGRADE: Pack Composition Chart Engine ---
const renderPackChart = (packData) => {
    const ctx = document.getElementById('packCompositionChart');
    const statusEl = document.getElementById('packChartStatus');
    if (!ctx) return;

    const labels = Object.keys(packData);
    const data = Object.values(packData);

    if (labels.length === 0) {
        ctx.style.display = 'none';
        if(statusEl) statusEl.textContent = "Awaiting pack telemetry...";
        return;
    }

    ctx.style.display = 'block';
    if(statusEl) statusEl.textContent = `Total Pack Members: ${data.reduce((a,b)=>a+b, 0)}`;

    if (window.EAHA_PackChartInstance) {
        window.EAHA_PackChartInstance.destroy();
    }

    // Dynamic tactical colors
    const colors = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#ec4899', '#8b5cf6'];

    window.EAHA_PackChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 1,
                borderColor: '#0f172a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'right', 
                    labels: { color: '#f8fafc', font: { family: 'Courier New', size: 11 } } 
                }
            }
        }
    });
};

// --- JARVIS UPGRADE: Widget Management & Telemetry Logic ---
const applyWidgetPreferences = () => {
    let activeWidgets = JSON.parse(localStorage.getItem(WIDGET_PREFS_KEY));
    if (!activeWidgets) {
        // Defaults if user hasn't touched the settings yet
        activeWidgets = ['widget-timers', 'widget-telemetry', 'widget-pack-chart', 'widget-roster', 'widget-encounters'];
        localStorage.setItem(WIDGET_PREFS_KEY, JSON.stringify(activeWidgets));
    }

    const checks = document.querySelectorAll('.widget-check');
    checks.forEach(check => {
        check.checked = activeWidgets.includes(check.value);
    });

    const containers = document.querySelectorAll('.widget-container');
    containers.forEach(container => {
        if (activeWidgets.includes(container.id)) {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    });
};

const setupWidgetCustomizer = () => {
    const toggleBtn = document.getElementById('widgetToggleBtn');
    const menu = document.getElementById('widgetMenu');
    const checks = document.querySelectorAll('.widget-check');

    if (!toggleBtn || !menu) return;

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('is-hidden');
    });

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== toggleBtn) {
            menu.classList.add('is-hidden');
        }
    });

    checks.forEach(check => {
        check.addEventListener('change', () => {
            const active = Array.from(checks).filter(c => c.checked).map(c => c.value);
            localStorage.setItem(WIDGET_PREFS_KEY, JSON.stringify(active));
            applyWidgetPreferences();
        });
    });
};

const startTacticalTimer = (elementId, secondsStr) => {
    const seconds = parseInt(secondsStr, 10);
    window.EAHA_ActiveTimers = window.EAHA_ActiveTimers || {};
    
    if (window.EAHA_ActiveTimers[elementId]) clearInterval(window.EAHA_ActiveTimers[elementId]);
    
    let remaining = seconds;
    const el = document.getElementById(elementId);
    if(!el) return;
    
    const updateDisplay = () => {
        const m = Math.floor(remaining / 60).toString().padStart(2, '0');
        const s = (remaining % 60).toString().padStart(2, '0');
        el.textContent = `${m}:${s}`;
    };
    
    updateDisplay();
    window.EAHA_ActiveTimers[elementId] = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(window.EAHA_ActiveTimers[elementId]);
            el.textContent = "READY";
            showToast(`${elementId.replace('timer','')} Timer Complete!`, 'success');
        } else {
            updateDisplay();
        }
    }, 1000);
};

const renderDashboardWidgets = () => {
    const rosterEl = document.getElementById('quickRoster');
    const encountersEl = document.getElementById('quickEncounters');
    const telemetryGrid = document.getElementById('packTelemetryGrid');

    if (rosterEl) {
        rosterEl.innerHTML = '';
        if (!db.creatures || db.creatures.length === 0) {
            rosterEl.innerHTML = '<p class="muted" style="text-align:center; padding: 10px;">Roster empty.</p>';
        } else {
            const sortedRoster = [...db.creatures].sort((a,b) => a.name.localeCompare(b.name));
            sortedRoster.forEach(c => {
                rosterEl.innerHTML += `
                    <div style="display: flex; justify-content: space-between; background: var(--bg-alt); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border);">
                        <strong style="color: var(--text);">${c.name}</strong>
                        <span style="color: var(--primary); font-size: 0.85em;">${c.tier || 'Unknown'}</span>
                    </div>
                `;
            });
        }
    }

    if (encountersEl) {
        encountersEl.innerHTML = '';
        if (!db.encounters || db.encounters.length === 0) {
            encountersEl.innerHTML = '<p class="muted" style="text-align:center; padding: 10px;">No encounters logged.</p>';
        } else {
            const sortedEncounters = [...db.encounters].sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 10);
            sortedEncounters.forEach(e => {
                const outcome = e.outcome || e.type || 'Unknown';
                let color = 'var(--text)';
                let icon = '⚔️';
                if (outcome.includes('Victory') || outcome === 'win') { color = 'var(--success)'; icon = '👑'; }
                else if (outcome.includes('Defeat') || outcome === 'loss' || outcome === 'starved') { color = 'var(--danger)'; icon = '💀'; }
                
                encountersEl.innerHTML += `
                    <div style="display: flex; justify-content: space-between; background: var(--bg-alt); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border);">
                        <strong style="color: ${color};">${icon} vs ${e.opponent || 'Unknown'}</strong>
                        <span style="color: var(--muted); font-size: 0.8em;">${e.location || 'Unknown'}</span>
                    </div>
                `;
            });
        }
    }

    if (telemetryGrid) {
        if (db.activeGroupId) {
            const membersRef = collection(firestoreDb, "groups", db.activeGroupId, "members");
            activeTelemetryListener = onSnapshot(membersRef, (snap) => {
                telemetryGrid.innerHTML = '';
                const packCounts = {}; // JARVIS UPGRADE: Aggregating pack data for chart
                
                if(snap.empty) {
                    telemetryGrid.innerHTML = '<p class="muted" style="text-align:center; padding: 10px;">No pack signals detected.</p>';
                    renderPackChart({});
                    return;
                }
                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    const isSelf = docSnap.id === auth.currentUser?.uid;
                    const dinoName = data.dinoName || 'Unknown';
                    
                    // Increment chart data
                    packCounts[dinoName] = (packCounts[dinoName] || 0) + 1;
                    
                    const timeDiff = Math.floor((Date.now() - (data.timestamp || Date.now())) / 60000);
                    let timeStr = `<span style="color:var(--success)">Live</span>`;
                    if (timeDiff > 10) timeStr = `<span style="color:var(--danger)">Offline</span>`;
                    else if (timeDiff > 2) timeStr = `<span style="color:var(--info)">Away</span>`;

                    telemetryGrid.innerHTML += `
                        <div style="background: ${isSelf ? 'color-mix(in srgb, var(--success) 10%, var(--bg))' : 'var(--bg-alt)'}; padding: 8px 12px; border-radius: 6px; border: 1px solid ${isSelf ? 'var(--success)' : 'var(--border)'};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <strong style="color: ${isSelf ? 'var(--success)' : 'var(--text)'}; font-size: 0.9em;">${data.displayName} ${isSelf ? '(You)' : ''}</strong>
                                <span style="font-size: 0.7em;">${timeStr}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: var(--muted);">
                                <span>${dinoName}</span>
                                <span><span style="color: var(--danger);">♥</span> ${data.health || '?'} | <span style="color: var(--info);">⚖</span> ${data.combatWeight || '?'}</span>
                            </div>
                        </div>
                    `;
                });
                renderPackChart(packCounts); // Feed the aggregated data to the chart
            });
        } else {
            telemetryGrid.innerHTML = '<p class="muted" style="text-align:center; padding: 10px;">Not connected to a Live Pack. Join via Lineage tab.</p>';
            renderPackChart({});
        }
    }
};

const init = async () => {
  if (typeof window.EAHADataStore !== 'undefined') {
    db = await window.EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing or restricted by module scope.");
  }

  // Apply user's widget preferences
  applyWidgetPreferences();
  setupWidgetCustomizer();

  const welcomeName = document.getElementById('welcomeName');
  if (welcomeName && auth.currentUser) welcomeName.textContent = auth.currentUser.displayName || 'Operator';

  const logWinBtn = document.getElementById('logWinBtn');
  const logLossBtn = document.getElementById('logLossBtn');
  const logStarveBtn = document.getElementById('logStarveBtn');
  
  if (logWinBtn) logWinBtn.addEventListener('click', () => saveEncounter('win'));
  if (logLossBtn) logLossBtn.addEventListener('click', () => saveEncounter('loss'));
  if (logStarveBtn) logStarveBtn.addEventListener('click', () => saveEncounter('starved'));

  // JARVIS UPGRADE: Load Timers from system settings
  const tSet = db.system_settings?.timers || { waystone: 1800, trophy: 600, growth: 2700 };
  
  const startWaystoneBtn = document.getElementById('startWaystoneBtn');
  const startTrophyBtn = document.getElementById('startTrophyBtn');
  const startGrowthBtn = document.getElementById('startGrowthBtn');
  
  if(startWaystoneBtn) {
      startWaystoneBtn.textContent = `Start ${Math.round(tSet.waystone/60)}m`;
      startWaystoneBtn.addEventListener('click', () => startTacticalTimer('timerWaystone', tSet.waystone));
  }
  if(startTrophyBtn) {
      startTrophyBtn.textContent = `Start ${Math.round(tSet.trophy/60)}m`;
      startTrophyBtn.addEventListener('click', () => startTacticalTimer('timerTrophy', tSet.trophy));
  }
  if(startGrowthBtn) {
      startGrowthBtn.textContent = `Start ${Math.round(tSet.growth/60)}m`;
      startGrowthBtn.addEventListener('click', () => startTacticalTimer('timerGrowth', tSet.growth));
  }

  renderDashboardWidgets();

  populateCreatureDropdown();
  
  populateTimeZones();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  setupLifelineListeners();
  
  setupCommandListeners();
  renderCommands();

  updateCombatAnalytics(); 
};

// JARVIS UPGRADE: The Direct Execution Guard
let hasInitialized = false;
onAuthStateChanged(auth, async (user) => {
    if (user && !hasInitialized) {
        hasInitialized = true;
        await init();
    }
});
