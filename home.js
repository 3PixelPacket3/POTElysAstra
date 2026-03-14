// js/home.js

// --- Persistent Storage Keys ---
const TIME_ZONE_KEY = 'eahaTimeZone';
const COMMANDS_KEY = 'eahaCommands';
const LIFELINE_KEY = 'eahaLifeline';

// --- Default Data Initialization ---
const defaultCommands = ['!sleep', '!clean', '!bless', '!tasty', '!migrationbuff', '!migrationgrowth', '!info', '!sniff', '!tp'];
let commands = JSON.parse(localStorage.getItem(COMMANDS_KEY)) || defaultCommands;

const defaultLifeline = {
  comfort: 100, hygiene: 100, satiation: 100,
  migrations: 0,
  rebirths: { 1: 'none', 2: 'none', 3: 'none' }
};
let lifeline = JSON.parse(localStorage.getItem(LIFELINE_KEY)) || { ...defaultLifeline };

let isEditMode = false;

// --- Utility Functions ---
const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.className = 'toast', 3000);
};

const saveLifeline = () => localStorage.setItem(LIFELINE_KEY, JSON.stringify(lifeline));
const saveCommands = () => localStorage.setItem(COMMANDS_KEY, JSON.stringify(commands));

// --- Elysian Lifeline: Vitals Monitor ---
const updateVitalsUI = () => {
  document.getElementById('comfortValue').textContent = `${lifeline.comfort}%`;
  document.getElementById('hygieneValue').textContent = `${lifeline.hygiene}%`;
  document.getElementById('satiationValue').textContent = `${lifeline.satiation}%`;

  const comfortStatus = document.getElementById('comfortStatus');
  if (lifeline.comfort <= 0) {
    comfortStatus.textContent = '⚠️ Armor Nerf Active!';
    comfortStatus.style.color = 'var(--danger)';
  } else if (lifeline.comfort > 70) {
    comfortStatus.textContent = '+ Health Regen Active';
    comfortStatus.style.color = 'var(--success)';
  } else {
    comfortStatus.textContent = 'Status Normal';
    comfortStatus.style.color = 'var(--muted)';
  }
};

// --- Elysian Lifeline: Eldering Tracker ---
const updateElderingUI = () => {
  document.getElementById('migrationCount').textContent = lifeline.migrations;
  const stageDisplay = document.getElementById('elderingStageDisplay');
  const rebirthSelects = document.querySelectorAll('.rebirth-select');
  
  let stageHtml = '';
  let isWithering = false;

  if (lifeline.migrations < 4) {
    stageHtml = `<strong style="color: var(--text);">Stage 0: Pre-Elder</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">Requires 4 migrations to reach Tier 1.</p>`;
  } else if (lifeline.migrations >= 4 && lifeline.migrations < 8) {
    stageHtml = `<strong style="color: var(--success);">Stage 1: Young Elder</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">+125 Health, +350 Weight. Slight speed debuff.</p>`;
  } else if (lifeline.migrations >= 8 && lifeline.migrations < 12) {
    stageHtml = `<strong style="color: var(--info);">Stage 2: Inexperienced Elder</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">No extra buffs yet. Keep pushing.</p>`;
  } else if (lifeline.migrations >= 12 && lifeline.migrations < 16) {
    stageHtml = `<strong style="color: #9C27B0;">Stage 3: Experienced Elder</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">+125 Health (Stacks). Required: Dull skin, lead pack, eat first.</p>`;
  } else if (lifeline.migrations >= 16) {
    isWithering = true;
    stageHtml = `<strong style="color: var(--danger);">Stage 4: Withering Elder</strong><p class="muted" style="margin-top: 5px; font-size: 0.9em;">Speed debuff stacks. Slow damage active until death. Rebirth unlocked.</p>`;
  }

  stageDisplay.innerHTML = stageHtml;

  // Handle Rebirth Dropdown Unlocks
  rebirthSelects.forEach(select => {
    select.disabled = !isWithering;
    select.value = lifeline.rebirths[select.dataset.token];
  });
};

const setupLifelineListeners = () => {
  ['comfort', 'hygiene', 'satiation'].forEach(vital => {
    const slider = document.getElementById(`${vital}Slider`);
    slider.value = lifeline[vital];
    slider.addEventListener('input', (e) => {
      lifeline[vital] = parseInt(e.target.value, 10);
      updateVitalsUI();
      saveLifeline();
    });
  });

  document.getElementById('addMigrationBtn').addEventListener('click', () => {
    lifeline.migrations++;
    updateElderingUI();
    saveLifeline();
  });

  document.getElementById('subMigrationBtn').addEventListener('click', () => {
    if (lifeline.migrations > 0) {
      lifeline.migrations--;
      updateElderingUI();
      saveLifeline();
    }
  });

  document.querySelectorAll('.rebirth-select').forEach(select => {
    select.addEventListener('change', (e) => {
      lifeline.rebirths[e.target.dataset.token] = e.target.value;
      saveLifeline();
    });
  });

  document.getElementById('resetLifelineBtn').addEventListener('click', () => {
    if(confirm('Are you sure you want to reset your active dinosaur lifeline?')) {
      lifeline = { ...defaultLifeline };
      ['comfort', 'hygiene', 'satiation'].forEach(vital => {
        document.getElementById(`${vital}Slider`).value = 100;
      });
      updateVitalsUI();
      updateElderingUI();
      saveLifeline();
      showToast('Lifeline reset to base values.');
    }
  });
};

// --- Quick Commands Logic ---
const renderCommands = () => {
  const grid = document.getElementById('commandGrid');
  grid.innerHTML = '';
  
  commands.forEach((command, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost';
    
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
    document.getElementById('commandStatus').textContent = isEditMode ? 'Click a command to delete it.' : 'Click a command to copy it.';
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
const init = () => {
  populateTimeZones();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  setupLifelineListeners();
  updateVitalsUI();
  updateElderingUI();
  
  setupCommandListeners();
  renderCommands();
};

document.addEventListener('DOMContentLoaded', init);
