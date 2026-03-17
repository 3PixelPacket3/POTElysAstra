// creatures.js
import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {} };
let currentCreatureId = null;
let currentMode = 'view';

// --- DOM Elements ---
const elements = {
  list: document.getElementById('creatureList'),
  search: document.getElementById('creatureSearch'),
  tierFilter: document.getElementById('creatureTier'),
  addBtn: document.getElementById('addCreature'),
  saveBtn: document.getElementById('saveCreature'),
  duplicateBtn: document.getElementById('duplicateCreature'),
  deleteBtn: document.getElementById('deleteCreature'),
  viewPane: document.getElementById('creatureView'),
  formPane: document.getElementById('creatureForm'),
  modeButtons: document.querySelectorAll('.mode-toggle button'),
  tabs: document.querySelectorAll('.tab'),
  panels: document.querySelectorAll('.panel'),
  
  ocrDropZone: document.getElementById('ocrDropZone'),
  ocrInput: document.getElementById('ocrInput'),

  rawStatImportArea: document.getElementById('rawStatImportArea'),
  processRawStatsBtn: document.getElementById('processRawStatsBtn'),

  core: {
    name: document.getElementById('creatureName'),
    tier: document.getElementById('creatureTierInput'),
    group: document.getElementById('creatureGroup'),
    image: document.getElementById('creatureImage'),
    imageUpload: document.getElementById('creatureImageUpload'),
    imageDropZone: document.getElementById('profileImageDropZone'),
    modded: document.getElementById('creatureModded'),
    critter: document.getElementById('creatureCritter')
  },
  // Modifiers Inputs
  modifiers: {
    role: document.getElementById('creatureRole'),
    mutation: document.getElementById('creatureMutation'),
    genetics: document.querySelectorAll('.creatureGeneticSelect')
  },
  stats: {
    health: document.getElementById('statHealth'),
    weight: document.getElementById('statCombatWeight'),
    armor: document.getElementById('statArmor'),
    carry: document.getElementById('statCarryCapacity'),
    stamina: document.getElementById('statStamina'),
    speed: document.getElementById('statSpeed')
  },
  narrative: {
    habitat: document.getElementById('creatureHabitat'),
    foods: document.getElementById('creatureFoods'),
    upkeep: document.getElementById('creatureUpkeep'),
    behaviors: document.getElementById('creatureBehaviors'),
    body: document.getElementById('creatureBody')
  },
  addCustomStatBtn: document.getElementById('addCustomStatBtn'),
  customStatsContainer: document.getElementById('customStatsContainer')
};

// --- Utilities ---
const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  if (type === 'error') toast.style.backgroundColor = 'var(--danger)';
  else if (type === 'info') toast.style.backgroundColor = 'var(--info)';
  else toast.style.backgroundColor = 'var(--primary)';
  setTimeout(() => toast.className = 'toast', 3000);
};

const formatList = (text) => text.split(',').map(item => item.trim()).filter(Boolean);
const formatLines = (text) => text.split('\n').map(item => item.trim()).filter(Boolean);
const generateId = () => 'crea_' + Math.random().toString(36).substr(2, 9);

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

// Advanced Arsenal & Mechanics Parsers
const getCustomStageStat = (dino, statNameSubstring, stageIndex = 4) => {
  const stat = dino.stats?.custom?.find(s => s.name.toLowerCase() === statNameSubstring.toLowerCase() || s.name.toLowerCase().includes(statNameSubstring.toLowerCase()));
  return stat ? getStatArray(stat.value)[stageIndex] : 0;
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

// --- Modifiers Engine Initialization ---
const populateModifiersDropdowns = () => {
  if (!window.EAHAModifiers) return;

  elements.modifiers.role.innerHTML = '';
  Object.keys(window.EAHAModifiers.roles).forEach(role => {
    elements.modifiers.role.appendChild(new Option(role, role));
  });

  elements.modifiers.mutation.innerHTML = '';
  Object.keys(window.EAHAModifiers.mutations).forEach(mut => {
    elements.modifiers.mutation.appendChild(new Option(mut, mut));
  });

  elements.modifiers.genetics.forEach(select => {
    select.innerHTML = '<option value="None">None</option>';
    Object.keys(window.EAHAModifiers.genetics).forEach(gen => {
      if (gen !== 'None') {
        select.appendChild(new Option(gen, gen));
      }
    });
  });
};

// --- Base64 Image Compression Engine ---
const compressAndLoadImage = (file) => {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new Image();
    img.src = event.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const SIZE = 400; 
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');

      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, SIZE, SIZE);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      elements.core.image.value = dataUrl;
      showToast('Profile image auto-cropped and loaded.');
    };
  };
};

// --- Navigation & Modes ---
const initTabs = () => {
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      elements.tabs.forEach(t => {
        t.classList.remove('active');
        t.style.color = 'var(--muted)';
      });
      elements.panels.forEach(p => p.classList.add('hidden'));
      
      e.target.classList.add('active');
      e.target.style.color = 'var(--primary)';
      document.querySelector(`.panel[data-panel="${e.target.dataset.tab}"]`).classList.remove('hidden');
    });
  });
};

const setMode = (mode) => {
  currentMode = mode;
  elements.modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
    if (btn.dataset.mode === mode) {
      btn.classList.remove('btn-ghost');
      btn.classList.add('btn');
    } else {
      btn.classList.remove('btn');
      btn.classList.add('btn-ghost');
    }
  });
  
  if (mode === 'edit') {
    elements.viewPane.classList.add('is-hidden');
    elements.formPane.classList.remove('is-hidden');
  } else {
    elements.formPane.classList.add('is-hidden');
    elements.viewPane.classList.remove('is-hidden');
  }
};

// --- Custom Stats Engine ---
const renderCustomStatRow = (name = '', value = '') => {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '10px';
  row.style.marginBottom = '10px';
  row.style.alignItems = 'center';
  row.className = 'custom-stat-row';
  
  row.innerHTML = `
    <input type="text" class="stat-name" placeholder="Stat Name" value="${name}" style="flex: 1;">
    <input type="text" class="stat-value" placeholder="v1, v2, v3, v4, v5" value="${value}" style="flex: 2;">
    <button type="button" class="btn btn-ghost delete-stat-btn" style="color: var(--danger); border-color: transparent; padding: 10px;">✕</button>
  `;
  
  row.querySelector('.delete-stat-btn').addEventListener('click', () => row.remove());
  elements.customStatsContainer.appendChild(row);
};

// --- RAW MATRIX PARSER ---
if(elements.processRawStatsBtn) {
  elements.processRawStatsBtn.addEventListener('click', () => {
    const rawText = elements.rawStatImportArea.value;
    if (!rawText.trim()) {
      showToast('Please paste raw attribute or combat data first.', 'error');
      return;
    }

    const regex = /([A-Za-z0-9_.]+)",Values=\(([^)]+)\)/g;
    let match;
    let customAddedCount = 0;

    while ((match = regex.exec(rawText)) !== null) {
      const statKey = match[1].trim();
      const statValues = match[2].trim();

      if (statKey === 'Core.MaxHealth') elements.stats.health.value = statValues;
      else if (statKey === 'Core.CombatWeight') elements.stats.weight.value = statValues;
      else if (statKey === 'Core.Armor') elements.stats.armor.value = statValues;
      else if (statKey === 'Core.MaxStamina') elements.stats.stamina.value = statValues;
      else if (statKey === 'Core.SprintingSpeedMultiplier' || statKey === 'Core.MovementSpeedMultiplier') {
        if (statKey === 'Core.SprintingSpeedMultiplier' || !elements.stats.speed.value) {
          elements.stats.speed.value = statValues;
        }
      } 
      else if (statKey.includes('Core.BodyFoodCorpseThreshold') || statKey.includes('Core.LimpHealthThreshold') || statKey.includes('Core.BodyFoodAmount')) {
        continue;
      }
      else {
        const displayName = statKey.replace('Core.', '');
        let existingRow = null;
        elements.customStatsContainer.querySelectorAll('.custom-stat-row').forEach(row => {
          if (row.querySelector('.stat-name').value === displayName) {
            existingRow = row;
          }
        });

        if (existingRow) {
          existingRow.querySelector('.stat-value').value = statValues;
        } else {
          renderCustomStatRow(displayName, statValues);
          customAddedCount++;
        }
      }
    }

    showToast(`Data Matrix Processed. ${customAddedCount} custom mechanics extracted or updated.`);
    elements.rawStatImportArea.value = '';
  });
}

// --- OCR Parsing Engine ---
const processImage = async (file) => {
  if(!file || !file.type.startsWith('image/')) return;
  showToast("Scanning image... This may take a few seconds.", "info");

  try {
    const result = await Tesseract.recognize(file, 'eng');
    const cleanText = result.data.text.replace(/[^\x00-\x7F]/g, "").replace(/[~@]/g, "");
    parseOCRText(cleanText);
    showToast("Auto-fill complete! Please review the extracted data.");
  } catch(err) {
    showToast("Failed to read image.", "error");
  }
};

const parseOCRText = (text) => {
  const nameMatch = text.match(/^\s*([A-Za-z\s]+?)(?:Tier|Carnivore|Herbivore|Land|Semi-Aquatic|Group)/i);
  if (nameMatch && nameMatch[1].trim().length > 1) {
    elements.core.name.value = nameMatch[1].trim();
  } else {
    const firstWord = text.match(/^\s*([A-Za-z]+)/);
    if (firstWord) elements.core.name.value = firstWord[1];
  }

  const tierMatch = text.match(/Tier\s*([1-5Iil]+)/i);
  if (tierMatch) {
    let tVal = tierMatch[1].toUpperCase().replace(/[IL]/g, '1');
    elements.core.tier.value = 'T' + tVal;
  } else if (text.match(/Apex/i)) {
    elements.core.tier.value = 'Apex';
  }

  const groupMatch = text.match(/Group:\s*(\d+)/i);
  if (groupMatch) elements.core.group.value = groupMatch[1];

  const habitatMatch = text.match(/HABITATS?\s*([\s\S]*?)(?:PREFERRED FOODS|Active Time|Upkeep|Nesting|Food|BEHAVIORS)/i);
  if (habitatMatch) {
    let habs = habitatMatch[1].replace(/RIPARIA|GONDWA|PANJURA|HABITATS/ig, '');
    let habArr = habs.split(/[\n]+|\s{2,}/).map(s => s.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, ''));
    elements.narrative.habitat.value = habArr.filter(s => s.length > 2).join(', ');
  }

  const foodMatch = text.match(/PREFERRED FOODS?\s*([\s\S]*?)(?:Active Time|Upkeep|Nesting|Food|BEHAVIORS)/i);
  if (foodMatch) {
    let foodArr = foodMatch[1].split(/[\n]+|\s{2,}/).map(s => s.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z)]+$/g, ''));
    elements.narrative.foods.value = foodArr.filter(s => s.length > 2).join(', ');
  }

  const upkeepMatch = text.match(/(?:Upkeep|Active Time)\s*([\s\S]*?)(?:Nesting|Food|BEHAVIORS)/i);
  if (upkeepMatch) {
    let uTxt = upkeepMatch[1].replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
    elements.narrative.upkeep.value = uTxt;
  } else {
    elements.narrative.upkeep.value = "";
  }

  const behaviorMatch = text.match(/BEHAVIORS([\s\S]*)/i);
  if (behaviorMatch) {
    let bText = behaviorMatch[1].split(/(?:May be considered a rulebreak|Basic Info|Can Symbiote|Elysian)/i)[0].trim();
    let lines = bText.split('\n').map(l => l.trim()).filter(l => l);
    let bNames = [];
    lines.forEach(line => {
      if (line.length > 2 && line.length < 55 && !line.match(/[.!?]$/)) bNames.push(line);
    });
    elements.narrative.behaviors.value = bNames.join('\n');
  } else {
    elements.narrative.behaviors.value = '';
  }

  elements.narrative.body.innerHTML = '';
};

// --- Form Syncing ---
const syncForm = (creature) => {
  elements.core.name.value = creature.name || '';
  elements.core.tier.value = creature.tier || '';
  elements.core.group.value = creature.groupSize || '';
  elements.core.image.value = creature.imagePath || '';
  elements.core.modded.checked = Boolean(creature.modded);
  elements.core.critter.checked = Boolean(creature.critter);
  
  if (window.EAHAModifiers) {
    elements.modifiers.role.value = creature.role || 'None';
    elements.modifiers.mutation.value = creature.mutation || 'None';
    
    const savedGenetics = creature.genetics || [];
    elements.modifiers.genetics.forEach((select, index) => {
      select.value = savedGenetics[index] || 'None';
    });
  }
  
  const baseStats = creature.stats?.base || {};
  elements.stats.health.value = baseStats.health || '';
  elements.stats.weight.value = baseStats.combatWeight || '';
  elements.stats.armor.value = baseStats.armor || '';
  elements.stats.carry.value = baseStats.carryCapacity || '';
  elements.stats.stamina.value = baseStats.stamina || '';
  elements.stats.speed.value = baseStats.speed || '';
  
  elements.customStatsContainer.innerHTML = '';
  const customStats = creature.stats?.custom || [];
  customStats.forEach(stat => renderCustomStatRow(stat.name, stat.value));
  
  elements.narrative.habitat.value = (creature.habitat || []).join(', ');
  elements.narrative.foods.value = (creature.foods || []).join(', ');
  elements.narrative.upkeep.value = creature.upkeep || '';
  elements.narrative.behaviors.value = (creature.behaviors || []).join('\n');
  elements.narrative.body.innerHTML = creature.profileHtml || '';
};

const gatherForm = () => {
  const customStats = [];
  elements.customStatsContainer.querySelectorAll('.custom-stat-row').forEach(row => {
    const name = row.querySelector('.stat-name').value.trim();
    const value = row.querySelector('.stat-value').value.trim();
    if (name) customStats.push({ name, value });
  });

  const activeGenetics = Array.from(elements.modifiers.genetics).map(sel => sel.value);

  return {
    id: currentCreatureId || generateId(),
    name: elements.core.name.value.trim() || 'Unnamed Creature',
    tier: elements.core.tier.value.trim(),
    groupSize: elements.core.group.value.trim(),
    imagePath: elements.core.image.value.trim(),
    modded: elements.core.modded.checked,
    critter: elements.core.critter.checked,
    
    role: elements.modifiers.role.value,
    mutation: elements.modifiers.mutation.value,
    genetics: activeGenetics,

    stats: {
      base: {
        health: elements.stats.health.value,
        combatWeight: elements.stats.weight.value,
        armor: elements.stats.armor.value,
        carryCapacity: elements.stats.carry.value,
        stamina: elements.stats.stamina.value,
        speed: elements.stats.speed.value
      },
      custom: customStats
    },
    habitat: formatList(elements.narrative.habitat.value),
    foods: formatList(elements.narrative.foods.value),
    upkeep: elements.narrative.upkeep.value.trim(),
    behaviors: formatLines(elements.narrative.behaviors.value),
    profileHtml: elements.narrative.body.innerHTML.trim()
  };
};

// --- View Renderer ---
const setView = (creature) => {
  if (!creature) {
    elements.viewPane.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: var(--muted); font-size: 1.1em; font-weight: 500;">Select a creature from the roster to view its profile.</div>';
    return;
  }

  const baseStats = creature.stats?.base || {};
  const customStats = creature.stats?.custom || [];

  const arsenal = getAllAttacks(creature, 4);
  const stamina = getStatArray(baseStats.stamina)[4];
  const sprintCost = getCustomStageStat(creature, 'StaminaSprintCostPerSecond', 4);
  const maxSprint = sprintCost > 0 ? Math.floor(stamina / sprintCost) + ' seconds' : 'Unknown';

  let customStatsHtml = '';
  if (customStats.length > 0) {
    const primaryKeywords = ['damage', 'bleed', 'bonebreak', 'venom', 'poison', 'cooldown'];
    const primaryStats = [];
    const advancedStats = [];

    customStats.forEach(stat => {
      const lowerName = stat.name.toLowerCase();
      if (primaryKeywords.some(kw => lowerName.includes(kw))) {
        primaryStats.push(stat);
      } else {
        advancedStats.push(stat);
      }
    });

    if (primaryStats.length > 0) {
      customStatsHtml += `
        <details style="background: color-mix(in srgb, var(--danger) 5%, var(--bg)); padding: 15px; border-radius: 12px; border: 1px solid var(--danger); margin-bottom: 20px; margin-top: 20px;">
          <summary style="color: var(--danger); font-weight: bold; cursor: pointer; outline: none; user-select: none;">
            Primary Combat Mechanics (${primaryStats.length} variables)
          </summary>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px; margin-top: 15px;">
            ${primaryStats.map(stat => `
              <div class="stat-card" style="background: var(--bg); border-color: var(--danger);" title="Full Array: ${stat.value || '-'}">
                <strong style="color: var(--danger); font-size: 0.85em; display: block; overflow-wrap: anywhere; word-break: break-word;">${stat.name}</strong>
                <span style="display: block; font-size: 1.1em; font-weight: 800; color: var(--text); margin-top: 5px;">${getAdultStat(stat.value)}</span>
              </div>
            `).join('')}
          </div>
        </details>
      `;
    }

    if (advancedStats.length > 0) {
      customStatsHtml += `
        <details style="background: var(--bg-alt); padding: 15px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 30px;">
          <summary style="color: var(--primary); font-weight: bold; cursor: pointer; outline: none; user-select: none;">
            Advanced Matrix Variables (${advancedStats.length} hidden)
          </summary>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px; margin-top: 15px;">
            ${advancedStats.map(stat => `
              <div class="stat-card" style="background: var(--bg); border-color: var(--border);" title="Full Array: ${stat.value || '-'}">
                <strong style="color: var(--primary); font-size: 0.85em; display: block; overflow-wrap: anywhere; word-break: break-word;">${stat.name}</strong>
                <span style="display: block; font-size: 1.1em; font-weight: 800; color: var(--text); margin-top: 5px;">${getAdultStat(stat.value)}</span>
              </div>
            `).join('')}
          </div>
        </details>
      `;
    }
  }

  const role = creature.role || 'None';
  const mutation = creature.mutation || 'None';
  const genetics = creature.genetics || (creature.genetic && creature.genetic !== 'None' ? [creature.genetic] : []);
  
  let modifiersHtml = '';
  const hasGenetics = genetics.some(g => g !== 'None');

  if (role !== 'None' || mutation !== 'None' || hasGenetics) {
    modifiersHtml += `<div style="margin-top: 15px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; width: 100%;">`;
    
    if (role !== 'None') {
      const roleDesc = window.EAHAModifiers?.roles?.[role]?.description || '';
      modifiersHtml += `<div style="background: color-mix(in srgb, var(--accent) 15%, transparent); padding: 10px; border-radius: 8px; border: 1px solid var(--accent); font-size: 0.85em;"><strong style="color: var(--accent); display:block; margin-bottom: 3px;">Role: ${role}</strong><span class="muted">${roleDesc}</span></div>`;
    }
    
    if (mutation !== 'None') {
      const mutDesc = window.EAHAModifiers?.mutations?.[mutation]?.description || '';
      modifiersHtml += `<div style="background: color-mix(in srgb, var(--info) 15%, transparent); padding: 10px; border-radius: 8px; border: 1px solid var(--info); font-size: 0.85em;"><strong style="color: var(--info); display:block; margin-bottom: 3px;">Mutation: ${mutation}</strong><span class="muted">${mutDesc}</span></div>`;
    }
    
    genetics.forEach(gen => {
      if (gen !== 'None') {
        const genDesc = window.EAHAModifiers?.genetics?.[gen]?.description || '';
        modifiersHtml += `<div style="background: color-mix(in srgb, var(--success) 15%, transparent); padding: 10px; border-radius: 8px; border: 1px solid var(--success); font-size: 0.85em;"><strong style="color: var(--success); display:block; margin-bottom: 3px;">Genetic: ${gen}</strong><span class="muted">${genDesc}</span></div>`;
      }
    });

    modifiersHtml += `</div>`;
  }

  elements.viewPane.innerHTML = `
    <div style="display: flex; gap: 25px; align-items: flex-start; margin-bottom: 30px; padding: 20px; background: var(--bg); border-radius: 16px; border: 1px solid var(--border);">
      ${creature.imagePath ? `<img src="${creature.imagePath}" alt="${creature.name}" style="width: 140px; height: 140px; object-fit: cover; border-radius: 12px; border: 2px solid var(--primary);">` : ''}
      <div style="flex: 1;">
        <h2 style="margin: 0 0 5px 0; font-size: 2.2em; color: var(--text);">${creature.name}</h2>
        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
          <span style="background: var(--bg-alt); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600;">${creature.tier || 'Unknown Tier'}</span>
          <span style="background: var(--bg-alt); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600;">${creature.groupSize || 'Unknown Group'}</span>
          ${creature.modded ? '<span style="background: color-mix(in srgb, var(--info) 20%, transparent); color: var(--info); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600;">Modded</span>' : ''}
        </div>
        <p class="muted" style="margin-bottom: 5px;"><strong>Habitat:</strong> ${(creature.habitat || []).join(', ') || 'Unknown'}</p>
        <p class="muted"><strong>Diet:</strong> ${(creature.foods || []).join(', ') || 'Unknown'}</p>
        ${modifiersHtml}
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
      
      <div style="background: color-mix(in srgb, #10b981 5%, var(--bg)); padding: 20px; border-radius: 16px; border: 1px solid #10b981;">
        <h3 style="color: #10b981; margin-bottom: 15px; border-bottom: 1px solid #10b981; padding-bottom: 5px;">Adult Arsenal & Base DPS</h3>
        ${arsenal.length > 0 ? arsenal.map(atk => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <strong>${atk.name}:</strong> 
            <span style="color: var(--text);">Base: <span style="color: var(--danger); font-weight:bold;">${atk.baseDmg}</span> | DPS: <span style="color: #10b981; font-weight:bold;">${atk.dps}/s</span></span>
          </div>
        `).join('') : '<p class="muted">No primary damage stats found in matrix.</p>'}
      </div>

      <div style="background: color-mix(in srgb, var(--info) 5%, var(--bg)); padding: 20px; border-radius: 16px; border: 1px solid var(--info);">
        <h3 style="color: var(--info); margin-bottom: 15px; border-bottom: 1px solid var(--info); padding-bottom: 5px;">Endurance & Turn</h3>
        <div style="margin-bottom: 10px;">
          <strong>Max Adult Sprint:</strong> <span style="color: var(--text); float: right; font-weight: bold;">${maxSprint}</span>
        </div>
        <div style="margin-bottom: 10px;">
          <strong>Sprint Drain:</strong> <span style="color: var(--text); float: right;">${sprintCost}/s</span>
        </div>
        <div style="margin-bottom: 10px;">
          <strong>Turn Radius Mod:</strong> <span style="color: var(--text); float: right;">${getCustomStageStat(creature, 'TurnRadiusMultiplier', 4) || 1}</span>
        </div>
      </div>

    </div>

    <div style="background: var(--bg); padding: 20px; border-radius: 16px; border: 1px solid var(--border); margin-bottom: 30px;">
      <h3 style="color: var(--primary); margin-bottom: 15px; border-bottom: 1px solid var(--border); padding-bottom: 5px;">Core Statistics (Adult Matrix)</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 15px;">
        <div class="stat-card" style="background: var(--bg);" title="Full Array: ${baseStats.health || '-'}">
          <strong style="color: var(--muted); display: block; overflow-wrap: anywhere; word-break: break-word;">Health</strong>
          <span style="font-size: 1.2em; font-weight: bold; display: block; margin-top: 5px;">${getAdultStat(baseStats.health)}</span>
        </div>
        <div class="stat-card" style="background: var(--bg);" title="Full Array: ${baseStats.combatWeight || '-'}">
          <strong style="color: var(--muted); display: block; overflow-wrap: anywhere; word-break: break-word;">Weight</strong>
          <span style="font-size: 1.2em; font-weight: bold; display: block; margin-top: 5px;">${getAdultStat(baseStats.combatWeight)}</span>
        </div>
        <div class="stat-card" style="background: var(--bg);" title="Full Array: ${baseStats.armor || '-'}">
          <strong style="color: var(--muted); display: block; overflow-wrap: anywhere; word-break: break-word;">Armor</strong>
          <span style="font-size: 1.2em; font-weight: bold; display: block; margin-top: 5px;">${getAdultStat(baseStats.armor)}</span>
        </div>
        <div class="stat-card" style="background: var(--bg);" title="Full Array: ${baseStats.carryCapacity || '-'}">
          <strong style="color: var(--muted); display: block; overflow-wrap: anywhere; word-break: break-word;">Capacity</strong>
          <span style="font-size: 1.2em; font-weight: bold; display: block; margin-top: 5px;">${getAdultStat(baseStats.carryCapacity)}</span>
        </div>
        <div class="stat-card" style="background: var(--bg);" title="Full Array: ${baseStats.stamina || '-'}">
          <strong style="color: var(--muted); display: block; overflow-wrap: anywhere; word-break: break-word;">Stamina</strong>
          <span style="font-size: 1.2em; font-weight: bold; display: block; margin-top: 5px;">${getAdultStat(baseStats.stamina)}</span>
        </div>
        <div class="stat-card" style="background: var(--bg);" title="Full Array: ${baseStats.speed || '-'}">
          <strong style="color: var(--muted); display: block; overflow-wrap: anywhere; word-break: break-word;">Speed</strong>
          <span style="font-size: 1.2em; font-weight: bold; display: block; margin-top: 5px;">${getAdultStat(baseStats.speed)}</span>
        </div>
      </div>
      
      ${customStatsHtml}
    </div>

    ${creature.upkeep ? `
    <div style="margin-bottom: 30px; padding: 20px; border-radius: 16px; background: color-mix(in srgb, var(--primary) 10%, transparent); border: 1px solid var(--primary);">
      <h3 style="color: var(--primary); margin-bottom: 10px;">Activity & Upkeep</h3>
      <p style="margin: 0;">${creature.upkeep}</p>
    </div>` : ''}

    <h3 style="color: var(--primary); margin-bottom: 15px; border-bottom: 1px solid var(--border); padding-bottom: 5px;">Profile & Ecology</h3>
    <div style="line-height: 1.8; font-size: 1.05em; background: var(--bg); padding: 25px; border-radius: 16px; border: 1px solid var(--border);">
      ${creature.profileHtml || '<p class="muted" style="text-align:center;">No detailed profile written.</p>'}
    </div>
  `;
};

// --- Roster Logic ---
const updateTierOptions = () => {
  const tiers = new Set(['All Tiers']);
  if(db.creatures) {
      db.creatures.forEach((c) => { if (c.tier) tiers.add(c.tier); });
  }
  
  elements.tierFilter.innerHTML = '';
  Array.from(tiers).forEach(tier => {
    elements.tierFilter.appendChild(new Option(tier, tier === 'All Tiers' ? 'all' : tier));
  });
};

const renderList = () => {
  const searchTerm = elements.search.value.toLowerCase();
  const tierFilter = elements.tierFilter.value;
  
  elements.list.innerHTML = '';
  
  if(!db.creatures) return;

  const filtered = db.creatures.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm);
    const matchesTier = tierFilter === 'all' || c.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  if (filtered.length === 0) {
    elements.list.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">No creatures found.</p>';
    return;
  }

  const sorted = [...filtered].sort((a,b) => a.name.localeCompare(b.name));

  sorted.forEach(creature => {
    const item = document.createElement('div');
    item.className = `list-item ${currentCreatureId === creature.id ? 'active' : ''}`;
    item.style.cursor = 'pointer';
    item.style.userSelect = 'none'; 
    item.innerHTML = `
      <div style="display: flex; flex-direction: column; pointer-events: none;">
        <strong style="font-size: 1.1em; color: ${currentCreatureId === creature.id ? 'var(--primary)' : 'var(--text)'};">${creature.name}</strong>
        <span class="muted" style="font-size: 0.85em; font-weight: 500;">${creature.tier || 'Unknown'} ${creature.modded ? ' • Modded' : ''}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      currentCreatureId = creature.id;
      syncForm(creature);
      setView(creature);
      setMode('view'); 
      renderList(); 
    });
    elements.list.appendChild(item);
  });
};

// --- Database Operations ---
const saveCreature = async () => {
  const data = gatherForm();
  if(!db.creatures) db.creatures = [];
  const index = db.creatures.findIndex(c => c.id === data.id);
  
  if (index >= 0) db.creatures[index] = data;
  else db.creatures.push(data);
  
  await window.EAHADataStore.saveData(db);
  
  currentCreatureId = data.id;
  updateTierOptions();
  renderList();
  setView(data);
  setMode('view');
  showToast('Creature Profile Secured.');
};

const deleteCreature = async () => {
  if (!currentCreatureId || !confirm('Are you certain you want to delete this creature? This cannot be undone.')) return;
  
  db.creatures = db.creatures.filter(c => c.id !== currentCreatureId);
  await window.EAHADataStore.saveData(db);
  
  currentCreatureId = null;
  updateTierOptions();
  renderList();
  setView(null);
  setMode('view');
  showToast('Profile Erased.', 'error');
};

const duplicateCreature = async () => {
  if (!currentCreatureId) return;
  const data = gatherForm();
  data.id = generateId();
  data.name = data.name + ' (Copy)';
  
  db.creatures.push(data);
  await window.EAHADataStore.saveData(db);
  
  currentCreatureId = data.id;
  syncForm(data);
  updateTierOptions();
  renderList();
  setView(data);
  showToast('Profile Duplicated.');
};

// --- Initialization ---
const init = async () => {
  if (typeof window.EAHADataStore !== 'undefined') {
    db = await window.EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing or restricted by module scope.");
  }

  populateModifiersDropdowns();

  initTabs();
  updateTierOptions();
  renderList();

  elements.search.addEventListener('input', renderList);
  elements.tierFilter.addEventListener('change', renderList);
  
  elements.modeButtons.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  elements.addBtn.addEventListener('click', () => {
    currentCreatureId = null;
    syncForm({ stats: { base: {}, custom: [] } });
    setMode('edit');
    elements.tabs[0].click(); 
  });

  elements.core.imageUpload.addEventListener('change', (e) => {
    if(e.target.files.length > 0) compressAndLoadImage(e.target.files[0]);
    e.target.value = ''; 
  });
  
  elements.core.imageDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.core.imageDropZone.style.opacity = '0.7';
  });
  elements.core.imageDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    elements.core.imageDropZone.style.opacity = '1';
  });
  elements.core.imageDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.core.imageDropZone.style.opacity = '1';
    if(e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      compressAndLoadImage(e.dataTransfer.files[0]);
    }
  });

  elements.ocrInput.addEventListener('change', (e) => {
    if(e.target.files.length > 0) processImage(e.target.files[0]);
    e.target.value = ''; 
  });

  elements.ocrDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.ocrDropZone.style.borderColor = 'var(--primary)';
    elements.ocrDropZone.style.backgroundColor = 'color-mix(in srgb, var(--primary) 20%, var(--bg))';
  });
  elements.ocrDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    elements.ocrDropZone.style.borderColor = 'var(--primary)';
    elements.ocrDropZone.style.backgroundColor = 'color-mix(in srgb, var(--primary) 10%, var(--bg))';
  });
  elements.ocrDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.ocrDropZone.style.borderColor = 'var(--primary)';
    elements.ocrDropZone.style.backgroundColor = 'color-mix(in srgb, var(--primary) 10%, var(--bg))';
    if(e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImage(e.dataTransfer.files[0]);
    }
  });

  window.addEventListener('paste', (e) => {
    if (currentMode === 'edit') {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          if (document.activeElement === elements.core.image) {
            compressAndLoadImage(item.getAsFile());
          } else {
            processImage(item.getAsFile());
          }
          break;
        }
      }
    }
  });

  elements.addCustomStatBtn.addEventListener('click', () => renderCustomStatRow());
  elements.saveBtn.addEventListener('click', saveCreature);
  elements.deleteBtn.addEventListener('click', deleteCreature);
  elements.duplicateBtn.addEventListener('click', duplicateCreature);

  document.getElementById('creatureToolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    document.execCommand(btn.dataset.command, false, null);
    elements.narrative.body.focus();
  });

  if (db.creatures && db.creatures.length > 0) {
    const sorted = [...db.creatures].sort((a,b) => a.name.localeCompare(b.name));
    currentCreatureId = sorted[0].id;
    syncForm(sorted[0]);
    setView(sorted[0]);
  } else {
    setView(null);
  }
};

// JARVIS UPGRADE: The Auth Guard Pipeline
let hasInitialized = false;
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user && !hasInitialized) {
            hasInitialized = true;
            await init();
        }
    });
});
