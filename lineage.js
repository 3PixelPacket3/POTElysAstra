// lineage.js
import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [], routes: [], lineage: [] };
let currentLineageId = null;

// --- DOM Elements ---
const elements = {
  list: document.getElementById('lineageList'),
  search: document.getElementById('lineageSearch'),
  
  createBtn: document.getElementById('createLineageBtn'),
  deleteBtn: document.getElementById('deleteLineageBtn'),
  
  placeholder: document.getElementById('lineagePlaceholder'),
  workspace: document.getElementById('lineageWorkspace'),
  
  // Header Info
  packNameDisplay: document.getElementById('packNameDisplay'),
  speciesDisplay: document.getElementById('speciesDisplay'),
  statTotal: document.getElementById('statTotal'),
  statAlive: document.getElementById('statAlive'),
  statDead: document.getElementById('statDead'),
  
  // Tree View
  treeContainer: document.getElementById('treeContainer'),
  
  // Modals
  packModal: document.getElementById('packModal'),
  packNameInput: document.getElementById('newPackName'),
  packSpeciesInput: document.getElementById('newPackSpecies'),
  savePackBtn: document.getElementById('savePackBtn'),
  cancelPackBtn: document.getElementById('cancelPackBtn'),

  memberModal: document.getElementById('memberModal'),
  memberNameInput: document.getElementById('newMemberName'),
  memberGenInput: document.getElementById('newMemberGen'),
  memberNotesInput: document.getElementById('newMemberNotes'),
  saveMemberBtn: document.getElementById('saveMemberBtn'),
  cancelMemberBtn: document.getElementById('cancelMemberBtn')
};

// --- Utilities ---
const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  if (type === 'error') toast.style.backgroundColor = 'var(--danger)';
  else toast.style.backgroundColor = 'var(--primary)';
  setTimeout(() => toast.className = 'toast', 3000);
};

const generateId = () => 'lin_' + Math.random().toString(36).substr(2, 9);

// --- Roster Management ---
const renderList = () => {
  const searchTerm = elements.search.value.toLowerCase();
  elements.list.innerHTML = '';
  
  if (!db.lineage) db.lineage = [];

  const filtered = db.lineage.filter(l => l.packName.toLowerCase().includes(searchTerm) || l.species.toLowerCase().includes(searchTerm));

  if (filtered.length === 0) {
    elements.list.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">No bloodlines recorded.</p>';
    return;
  }

  filtered.forEach(pack => {
    const item = document.createElement('div');
    item.className = `list-item ${currentLineageId === pack.id ? 'active' : ''}`;
    item.style.cursor = 'pointer';
    item.style.userSelect = 'none';
    
    const aliveCount = pack.members.filter(m => m.status === 'Alive').length;
    
    item.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%; pointer-events: none;">
        <strong style="font-size: 1.1em; color: ${currentLineageId === pack.id ? 'var(--primary)' : 'var(--text)'};">${pack.packName}</strong>
        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          <span class="muted" style="font-size: 0.85em;">${pack.species}</span>
          <span style="font-size: 0.85em; color: ${aliveCount > 0 ? 'var(--success)' : 'var(--danger)'};">${aliveCount} Alive</span>
        </div>
      </div>
    `;
    
    item.addEventListener('click', () => {
      currentLineageId = pack.id;
      renderList(); 
      renderWorkspace();
    });
    
    elements.list.appendChild(item);
  });
};

// --- Tree Rendering Engine ---
const renderWorkspace = () => {
  if (!currentLineageId) {
    elements.workspace.classList.add('is-hidden');
    elements.placeholder.classList.remove('is-hidden');
    elements.deleteBtn.style.display = 'none';
    return;
  }

  const pack = db.lineage.find(l => l.id === currentLineageId);
  if (!pack) return;

  elements.placeholder.classList.add('is-hidden');
  elements.workspace.classList.remove('is-hidden');
  elements.deleteBtn.style.display = 'block';

  elements.packNameDisplay.textContent = pack.packName;
  elements.speciesDisplay.textContent = pack.species;

  const total = pack.members.length;
  const alive = pack.members.filter(m => m.status === 'Alive').length;
  const dead = total - alive;

  elements.statTotal.textContent = total;
  elements.statAlive.textContent = alive;
  elements.statDead.textContent = dead;

  // Render the members grouped by Generation
  elements.treeContainer.innerHTML = '';
  
  if (total === 0) {
    elements.treeContainer.innerHTML = '<div class="muted" style="text-align:center; padding: 40px;">No members in this bloodline yet. Add a Founder to begin.</div>';
    return;
  }

  // Group by generation
  const generations = {};
  pack.members.forEach(m => {
    const gen = m.generation || 1;
    if (!generations[gen]) generations[gen] = [];
    generations[gen].push(m);
  });

  const sortedGens = Object.keys(generations).sort((a, b) => a - b);

  sortedGens.forEach(gen => {
    const genBlock = document.createElement('div');
    genBlock.style.marginBottom = '25px';
    
    const genHeader = document.createElement('h3');
    genHeader.style.color = 'var(--primary)';
    genHeader.style.marginBottom = '15px';
    genHeader.style.borderBottom = '1px solid var(--border)';
    genHeader.style.paddingBottom = '5px';
    genHeader.textContent = gen == 1 ? 'Generation 1 (Founders)' : `Generation ${gen}`;
    genBlock.appendChild(genHeader);

    const membersGrid = document.createElement('div');
    membersGrid.style.display = 'grid';
    membersGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    membersGrid.style.gap = '15px';

    generations[gen].forEach(member => {
      const card = document.createElement('div');
      const isDead = member.status === 'Deceased';
      
      card.className = 'stat-card';
      card.style.background = isDead ? 'color-mix(in srgb, var(--danger) 10%, var(--bg))' : 'var(--bg-alt)';
      card.style.borderColor = isDead ? 'var(--danger)' : 'var(--border)';
      card.style.cursor = 'pointer';
      card.title = "Click to toggle Alive/Deceased status";
      
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <strong style="color: ${isDead ? 'var(--danger)' : 'var(--text)'}; font-size: 1.1em; text-decoration: ${isDead ? 'line-through' : 'none'};">${member.name}</strong>
          <span style="font-size: 1.2em;">${isDead ? '💀' : '🌿'}</span>
        </div>
        ${member.notes ? `<p class="muted" style="font-size: 0.85em; margin-top: 8px;">${member.notes}</p>` : ''}
        <div style="font-size: 0.75em; color: var(--muted); margin-top: 10px;">Added: ${new Date(member.dateAdded).toLocaleDateString()}</div>
      `;

      // Toggle Status on Click
      card.addEventListener('click', async () => {
        member.status = member.status === 'Alive' ? 'Deceased' : 'Alive';
        await window.EAHADataStore.saveData(db);
        renderWorkspace();
        renderList();
      });

      membersGrid.appendChild(card);
    });

    genBlock.appendChild(membersGrid);
    elements.treeContainer.appendChild(genBlock);
  });
};

// --- Modals & Data Entry ---
elements.createBtn.addEventListener('click', () => {
  elements.packNameInput.value = '';
  elements.packSpeciesInput.value = 'Unknown';
  populateSpeciesDropdown();
  elements.packModal.classList.remove('is-hidden');
});

elements.cancelPackBtn.addEventListener('click', () => {
  elements.packModal.classList.add('is-hidden');
});

elements.savePackBtn.addEventListener('click', async () => {
  const name = elements.packNameInput.value.trim();
  const species = elements.packSpeciesInput.value.trim();
  
  if (!name) return showToast('Pack name is required.', 'error');

  const newPack = {
    id: generateId(),
    packName: name,
    species: species,
    members: [],
    timestamp: Date.now()
  };

  if (!db.lineage) db.lineage = [];
  db.lineage.push(newPack);
  
  await window.EAHADataStore.saveData(db);
  currentLineageId = newPack.id;
  
  elements.packModal.classList.add('is-hidden');
  renderList();
  renderWorkspace();
  showToast('New Bloodline established.');
});

// Member Entry
document.getElementById('addMemberBtn').addEventListener('click', () => {
  elements.memberNameInput.value = '';
  elements.memberGenInput.value = '1';
  elements.memberNotesInput.value = '';
  elements.memberModal.classList.remove('is-hidden');
  elements.memberNameInput.focus();
});

elements.cancelMemberBtn.addEventListener('click', () => {
  elements.memberModal.classList.add('is-hidden');
});

elements.saveMemberBtn.addEventListener('click', async () => {
  const pack = db.lineage.find(l => l.id === currentLineageId);
  if (!pack) return;

  const name = elements.memberNameInput.value.trim();
  const gen = parseInt(elements.memberGenInput.value, 10) || 1;
  const notes = elements.memberNotesInput.value.trim();

  if (!name) return showToast('Member name is required.', 'error');

  pack.members.push({
    id: generateId(),
    name: name,
    generation: gen,
    notes: notes,
    status: 'Alive',
    dateAdded: Date.now()
  });

  await window.EAHADataStore.saveData(db);
  
  elements.memberModal.classList.add('is-hidden');
  renderWorkspace();
  renderList();
  showToast(`${name} added to the family tree.`);
});

elements.deleteBtn.addEventListener('click', async () => {
  if (!currentLineageId) return;
  const pack = db.lineage.find(l => l.id === currentLineageId);
  if (confirm(`WARNING: Are you sure you want to completely erase the ${pack.packName} bloodline?`)) {
    db.lineage = db.lineage.filter(l => l.id !== currentLineageId);
    await window.EAHADataStore.saveData(db);
    currentLineageId = null;
    renderList();
    renderWorkspace();
    showToast('Bloodline erased.', 'error');
  }
});

const populateSpeciesDropdown = () => {
  elements.packSpeciesInput.innerHTML = '<option value="Unknown">Select Species...</option>';
  if (db.creatures) {
    const sortedCreatures = [...db.creatures].sort((a, b) => a.name.localeCompare(b.name));
    sortedCreatures.forEach(c => {
      elements.packSpeciesInput.appendChild(new Option(c.name, c.name));
    });
  }
};

elements.search.addEventListener('input', renderList);

// --- Initialization ---
const init = async () => {
  if (typeof window.EAHADataStore !== 'undefined') {
    db = await window.EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing.");
  }

  if (!db.lineage) db.lineage = [];

  renderList();
  renderWorkspace();
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
