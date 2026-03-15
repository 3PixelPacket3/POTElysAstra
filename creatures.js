// creatures.js

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
  
  // Magic Auto-Fill
  ocrDropZone: document.getElementById('ocrDropZone'),
  ocrInput: document.getElementById('ocrInput'),

  // Form Inputs - Core
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
  // Form Inputs - Stats
  stats: {
    health: document.getElementById('statHealth'),
    weight: document.getElementById('statCombatWeight'),
    armor: document.getElementById('statArmor'),
    carry: document.getElementById('statCarryCapacity'),
    stamina: document.getElementById('statStamina'),
    speed: document.getElementById('statSpeed')
  },
  // Form Inputs - Narrative
  narrative: {
    habitat: document.getElementById('creatureHabitat'),
    foods: document.getElementById('creatureFoods'),
    upkeep: document.getElementById('creatureUpkeep'),
    behaviors: document.getElementById('creatureBehaviors'),
    body: document.getElementById('creatureBody')
  },
  
  // Custom Stats
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

const formatList = (text) => text.split(',').map((item) => item.trim()).filter(Boolean);
const formatLines = (text) => text.split('\n').map((item) => item.trim()).filter(Boolean);
const generateId = () => 'crea_' + Math.random().toString(36).substr(2, 9);

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
      const SIZE = 400; // Optimal UI display size
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');

      // Calculate 1:1 Center Crop
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      // Draw the cropped center into the 400x400 canvas
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, SIZE, SIZE);
      
      // Compress to high-quality JPEG Base64
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
    <input type="text" class="stat-name" placeholder="Stat Name (e.g., Bleed Heal)" value="${name}" style="flex: 1;">
    <input type="text" class="stat-value" placeholder="Value" value="${value}" style="flex: 1;">
    <button type="button" class="btn btn-ghost delete-stat-btn" style="color: var(--danger); border-color: transparent; padding: 10px;">✕</button>
  `;
  
  row.querySelector('.delete-stat-btn').addEventListener('click', () => row.remove());
  elements.customStatsContainer.appendChild(row);
};

// --- OCR Parsing Engine ---
const processImage = async (file) => {
  if(!file || !file.type.startsWith('image/')) return;
  showToast("Scanning image... This may take a few seconds.", "info");

  try {
    const result = await Tesseract.recognize(file, 'eng');
    
    // Clean out emojis, bot artifacts, non-ASCII symbols, and tildes (~~)
    const cleanText = result.data.text.replace(/[^\x00-\x7F]/g, "").replace(/~/g, "");
    
    parseOCRText(cleanText);
    showToast("Auto-fill complete! Please review the extracted data.");
  } catch(err) {
    console.error("Jarvis Error: OCR failed.", err);
    showToast("Failed to read image.", "error");
  }
};

const parseOCRText = (text) => {
  // 1. Name (Look for first word before Tier, Carnivore, Herbivore, etc)
  const nameMatch = text.match(/^\s*([A-Za-z\s]+?)(?:Tier|Carnivore|Herbivore|Land|Semi-Aquatic|Group)/i);
  if (nameMatch && nameMatch[1].trim().length > 1) {
    elements.core.name.value = nameMatch[1].trim();
  } else {
    // Fallback if specific words aren't present
    const firstWord = text.match(/^\s*([A-Za-z]+)/);
    if (firstWord) elements.core.name.value = firstWord[1];
  }

  // 2. Tier (Handles "Tier 1", "Tier I", "Tier1")
  const tierMatch = text.match(/Tier\s*([1-5Iil]+)/i);
  if (tierMatch) {
    let tVal = tierMatch[1].toUpperCase().replace(/[IL]/g, '1');
    elements.core.tier.value = 'T' + tVal;
  } else if (text.match(/Apex/i)) {
    elements.core.tier.value = 'Apex';
  }

  // 3. Group Size
  const groupMatch = text.match(/Group:\s*(\d+)/i);
  if (groupMatch) elements.core.group.value = groupMatch[1];

  // 4. Habitats (Comma separated cleanup)
  const habitatMatch = text.match(/HABITATS?\s*([\s\S]*?)(?:PREFERRED FOODS|Active Time|Upkeep|Nesting|Food|BEHAVIORS)/i);
  if (habitatMatch) {
    let habs = habitatMatch[1].replace(/RIPARIA|GONDWA|PANJURA|HABITATS/ig, '');
    // Split by 2+ spaces or newlines to isolate the pills, strip trailing punctuation
    let habArr = habs.split(/[\n]+|\s{2,}/).map(s => s.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, ''));
    elements.narrative.habitat.value = habArr.filter(s => s.length > 2).join(', ');
  }

  // 5. Foods (Comma separated cleanup)
  const foodMatch = text.match(/PREFERRED FOODS?\s*([\s\S]*?)(?:Active Time|Upkeep|Nesting|Food|BEHAVIORS)/i);
  if (foodMatch) {
    let foodArr = foodMatch[1].split(/[\n]+|\s{2,}/).map(s => s.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z)]+$/g, ''));
    elements.narrative.foods.value = foodArr.filter(s => s.length > 2).join(', ');
  }

  // 6. Upkeep / Active Time combined
  const upkeepMatch = text.match(/(?:Upkeep|Active Time)\s*([\s\S]*?)(?:Nesting|Food|BEHAVIORS)/i);
  if (upkeepMatch) {
    let uTxt = upkeepMatch[1].replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
    elements.narrative.upkeep.value = uTxt;
  } else {
    elements.narrative.upkeep.value = "";
  }

  // 7. Blank out the rich description and behaviors as requested
  elements.narrative.behaviors.value = '';
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

  return {
    id: currentCreatureId || generateId(),
    name: elements.core.name.value.trim() || 'Unnamed Creature',
    tier: elements.core.tier.value.trim(),
    groupSize: elements.core.group.value.trim(),
    imagePath: elements.core.image.value.trim(),
    modded: elements.core.modded.checked,
    critter: elements.core.critter.checked,
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
  
  let customStatsHtml = customStats.map(stat => `
    <div class="stat-card" style="background: var(--bg-alt); border: none;">
      <strong style="color: var(--primary);">${stat.name}</strong><br>
      <span style="font-size: 1.1em; font-weight: 600;">${stat.value}</span>
    </div>
  `).join('');

  elements.viewPane.innerHTML = `
    <div style="display: flex; gap: 25px; align-items: flex-start; margin-bottom: 30px; padding: 20px; background: var(--bg); border-radius: 16px; border: 1px solid var(--border);">
      ${creature.imagePath ? `<img src="${creature.imagePath}" alt="${creature.name}" style="width: 140px; height: 140px; object-fit: cover; border-radius: 12px; border: 2px solid var(--primary);">` : ''}
      <div>
        <h2 style="margin: 0 0 5px 0; font-size: 2.2em; color: var(--text);">${creature.name}</h2>
        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
          <span style="background: var(--bg-alt); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600;">${creature.tier || 'Unknown Tier'}</span>
          <span style="background: var(--bg-alt); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600;">${creature.groupSize || 'Unknown Group'}</span>
          ${creature.modded ? '<span style="background: color-mix(in srgb, var(--info) 20%, transparent); color: var(--info); padding: 5px 12px; border-radius: 50px; font-size: 0.85em; font-weight: 600;">Modded</span>' : ''}
        </div>
        <p class="muted" style="margin-bottom: 5px;"><strong>Habitat:</strong> ${(creature.habitat || []).join(', ') || 'Unknown'}</p>
        <p class="muted"><strong>Diet:</strong> ${(creature.foods || []).join(', ') || 'Unknown'}</p>
      </div>
    </div>

    <h3 style="color: var(--primary); margin-bottom: 15px; border-bottom: 1px solid var(--border); padding-bottom: 5px;">Core Statistics</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 15px; margin-bottom: 30px;">
      <div class="stat-card" style="background: var(--bg);"><strong style="color: var(--muted);">Health</strong><br><span style="font-size: 1.2em; font-weight: bold;">${baseStats.health || '-'}</span></div>
      <div class="stat-card" style="background: var(--bg);"><strong style="color: var(--muted);">Weight</strong><br><span style="font-size: 1.2em; font-weight: bold;">${baseStats.combatWeight || '-'}</span></div>
      <div class="stat-card" style="background: var(--bg);"><strong style="color: var(--muted);">Armor</strong><br><span style="font-size: 1.2em; font-weight: bold;">${baseStats.armor || '-'}</span></div>
      <div class="stat-card" style="background: var(--bg);"><strong style="color: var(--muted);">Capacity</strong><br><span style="font-size: 1.2em; font-weight: bold;">${baseStats.carryCapacity || '-'}</span></div>
      <div class="stat-card" style="background: var(--bg);"><strong style="color: var(--muted);">Stamina</strong><br><span style="font-size: 1.2em; font-weight: bold;">${baseStats.stamina || '-'}</span></div>
      <div class="stat-card" style="background: var(--bg);"><strong style="color: var(--muted);">Speed</strong><br><span style="font-size: 1.2em; font-weight: bold;">${baseStats.speed || '-'}</span></div>
    </div>
    
    ${customStats.length > 0 ? `
      <div style="margin-bottom: 30px; background: var(--bg); padding: 20px; border-radius: 16px; border: 1px solid var(--border);">
        <h4 style="margin-bottom: 15px; color: var(--muted);">Custom Mechanics</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px;">
          ${customStatsHtml}
        </div>
      </div>
    ` : ''}

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

  filtered.forEach(creature => {
    const item = document.createElement('div');
    item.className = `list-item ${currentCreatureId === creature.id ? 'active' : ''}`;
    // Force Pointer CSS and disable text selection for cleaner UI
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
  
  await EAHADataStore.saveData(db);
  
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
  await EAHADataStore.saveData(db);
  
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
  await EAHADataStore.saveData(db);
  
  currentCreatureId = data.id;
  syncForm(data);
  updateTierOptions();
  renderList();
  setView(data);
  showToast('Profile Duplicated.');
};

// --- Initialization ---
const init = async () => {
  if (typeof EAHADataStore !== 'undefined') {
    db = await EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing.");
  }

  initTabs();
  updateTierOptions();
  renderList();

  // Bind Listeners
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

  // --- Image Upload Bindings (Profile Avatar) ---
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

  // --- OCR Input Bindings (Magic Auto-Fill) ---
  // 1. Manual Upload
  elements.ocrInput.addEventListener('change', (e) => {
    if(e.target.files.length > 0) processImage(e.target.files[0]);
    e.target.value = ''; 
  });

  // 2. Drag and Drop
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

  // 3. Ctrl+V Paste (Handles both Avatar and OCR depending on focus/target)
  window.addEventListener('paste', (e) => {
    if (currentMode === 'edit') {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          // If they are specifically focused on the image URL input, assume avatar upload
          if (document.activeElement === elements.core.image) {
            compressAndLoadImage(item.getAsFile());
          } else {
            // Otherwise default to the OCR magic scanner
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

  // Rich Text Editor Toolbar
  document.getElementById('creatureToolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    document.execCommand(btn.dataset.command, false, null);
    elements.narrative.body.focus();
  });

  // Initial Boot State
  if (db.creatures && db.creatures.length > 0) {
    currentCreatureId = db.creatures[0].id;
    syncForm(db.creatures[0]);
    setView(db.creatures[0]);
  } else {
    setView(null);
  }
};

document.addEventListener('DOMContentLoaded', init);
