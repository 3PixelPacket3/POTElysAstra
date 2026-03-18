// lineage.js
import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {}, encounters: [], pins: [], routes: [], lineage: [] };
let currentLineageId = null;
let activeTab = 'tree'; 

// Temporary State for Modals
let editingMemberId = null; 
let dyingMemberId = null; 
let trophyMemberId = null; 

// --- DOM Elements ---
const elements = {
  list: document.getElementById('lineageList'),
  search: document.getElementById('lineageSearch'),
  createBtn: document.getElementById('createLineageBtn'),
  deleteBtn: document.getElementById('deleteLineageBtn'),
  placeholder: document.getElementById('lineagePlaceholder'),
  workspace: document.getElementById('lineageWorkspace'),
  
  packNameDisplay: document.getElementById('packNameDisplay'),
  speciesDisplay: document.getElementById('speciesDisplay'),
  statTotal: document.getElementById('statTotal'),
  statAlive: document.getElementById('statAlive'),
  statDead: document.getElementById('statDead'),
  
  tabs: document.querySelectorAll('.lineage-tab'),
  treeContainer: document.getElementById('treeContainer'),
  treeNodes: document.getElementById('treeNodes'),
  treeLines: document.getElementById('treeLines'),
  memorialContainer: document.getElementById('memorialContainer'),
  
  // Pack Modal
  packModal: document.getElementById('packModal'),
  packNameInput: document.getElementById('newPackName'),
  packSpeciesInput: document.getElementById('newPackSpecies'),
  savePackBtn: document.getElementById('savePackBtn'),
  cancelPackBtn: document.getElementById('cancelPackBtn'),

  // Member Modal
  memberModal: document.getElementById('memberModal'),
  memberModalTitle: document.getElementById('memberModalTitle'),
  memberNameInput: document.getElementById('newMemberName'),
  memberGenInput: document.getElementById('newMemberGen'),
  memberRoleInput: document.getElementById('newMemberRole'),
  memberSireInput: document.getElementById('newMemberSire'),
  memberDamInput: document.getElementById('newMemberDam'),
  memberNotesInput: document.getElementById('newMemberNotes'),
  saveMemberBtn: document.getElementById('saveMemberBtn'),
  cancelMemberBtn: document.getElementById('cancelMemberBtn'),

  // Trophy Modal
  trophyModal: document.getElementById('trophyModal'),
  newTrophyName: document.getElementById('newTrophyName'),
  saveTrophyBtn: document.getElementById('saveTrophyBtn'),
  cancelTrophyBtn: document.getElementById('cancelTrophyBtn'),

  // Death Modal
  deathModal: document.getElementById('deathModal'),
  deathCauseInput: document.getElementById('deathCauseInput'),
  deathLocInput: document.getElementById('deathLocInput'),
  confirmDeathBtn: document.getElementById('confirmDeathBtn'),
  cancelDeathBtn: document.getElementById('cancelDeathBtn')
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

// --- JARVIS UPGRADE: Advanced Visual Node Tree Engine ---
const drawConnections = () => {
    const svg = elements.treeLines;
    svg.innerHTML = '';
    
    const pack = db.lineage.find(l => l.id === currentLineageId);
    if (!pack || activeTab !== 'tree') return;

    const container = elements.treeNodes;
    const containerRect = container.getBoundingClientRect();
    
    // Scale SVG to match the full scrollable area
    svg.style.width = container.scrollWidth + 'px';
    svg.style.height = container.scrollHeight + 'px';

    pack.members.forEach(member => {
        if (member.status !== 'Alive') return; 

        const childNode = document.getElementById(`node-${member.id}`);
        if (!childNode) return;
        const childRect = childNode.getBoundingClientRect();
        
        // Calculate absolute position within the scrollable container
        const childX = (childRect.left - containerRect.left) + container.scrollLeft + (childRect.width / 2);
        const childY = (childRect.top - containerRect.top) + container.scrollTop;

        const drawLineToParent = (parentId, strokeColor) => {
            if (!parentId) return;
            const parentNode = document.getElementById(`node-${parentId}`);
            if (!parentNode) return;

            const parentRect = parentNode.getBoundingClientRect();
            const parentX = (parentRect.left - containerRect.left) + container.scrollLeft + (parentRect.width / 2);
            const parentY = (parentRect.bottom - containerRect.top) + container.scrollTop;

            // Draw a curved bezier line 
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${parentX} ${parentY} C ${parentX} ${parentY + 30}, ${childX} ${childY - 30}, ${childX} ${childY}`;
            
            path.setAttribute('d', d);
            path.setAttribute('stroke', strokeColor);
            path.setAttribute('stroke-width', '2.5');
            path.setAttribute('fill', 'none');
            path.setAttribute('opacity', '0.6');
            
            svg.appendChild(path);
        };

        drawLineToParent(member.sireId, '#3b82f6'); // Blue for Sire
        drawLineToParent(member.damId, '#ec4899');  // Pink for Dam
    });
};

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
  const aliveMembers = pack.members.filter(m => m.status === 'Alive');
  const deadMembers = pack.members.filter(m => m.status !== 'Alive');

  elements.statTotal.textContent = total;
  elements.statAlive.textContent = aliveMembers.length;
  elements.statDead.textContent = deadMembers.length;

  if (activeTab === 'tree') {
      elements.memorialContainer.classList.add('is-hidden');
      elements.treeContainer.classList.remove('is-hidden');
      elements.treeNodes.innerHTML = '';
      elements.treeLines.innerHTML = '';

      if (aliveMembers.length === 0) {
        elements.treeNodes.innerHTML = '<div class="muted" style="text-align:center; padding: 40px; width: 100%;">No living members. Add a Founder to begin the family tree.</div>';
        return;
      }

      // Group by generation
      const generations = {};
      aliveMembers.forEach(m => {
        const gen = m.generation || 1;
        if (!generations[gen]) generations[gen] = [];
        generations[gen].push(m);
      });

      // Sort Alpha to top of generation
      Object.keys(generations).forEach(gen => {
          generations[gen].sort((a, b) => {
              if (a.packRole === 'Alpha' && b.packRole !== 'Alpha') return -1;
              if (b.packRole === 'Alpha' && a.packRole !== 'Alpha') return 1;
              return 0;
          });
      });

      const sortedGens = Object.keys(generations).sort((a, b) => a - b);

      sortedGens.forEach(gen => {
        const row = document.createElement('div');
        row.className = 'generation-row';
        row.innerHTML = `<div class="gen-label">Generation ${gen}</div>`;

        generations[gen].forEach(member => {
          const card = document.createElement('div');
          const isAlpha = member.packRole === 'Alpha';
          card.className = `lineage-card ${isAlpha ? 'role-alpha' : ''}`;
          card.id = `node-${member.id}`;
          
          let trophiesHtml = (member.titles || []).map(t => `<span class="trophy-chip">${t}</span>`).join('');
          if (isAlpha) trophiesHtml = `<span class="trophy-chip alpha-badge">👑 Alpha</span>` + trophiesHtml;

          // Expanded Suite of Card Actions
          card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn" title="Edit Details" onclick="window.EAHA_EditMember('${member.id}')">✎</button>
                <button class="action-btn" title="Award Trophy" onclick="window.EAHA_TriggerTrophy('${member.id}')">🏅</button>
                <button class="action-btn" title="Send to Memorial" onclick="window.EAHA_TriggerDeath('${member.id}')">☠️</button>
                <button class="action-btn" title="Delete Permanently" onclick="window.EAHA_DeleteMember('${member.id}')" style="color: var(--danger);">✕</button>
            </div>
            <strong style="color: var(--text); font-size: 1.1em; display:block;">${member.name}</strong>
            <div style="font-size: 0.8em; color: var(--primary); font-weight: bold;">${member.packRole || 'Subordinate'}</div>
            ${member.notes ? `<p class="muted" style="font-size: 0.8em; margin-top: 5px;">${member.notes}</p>` : ''}
            <div class="trophy-container">${trophiesHtml}</div>
          `;
          row.appendChild(card);
        });

        elements.treeNodes.appendChild(row);
      });

      // Draw lines after layout recalculates
      setTimeout(drawConnections, 50);

  } else {
      // Memorial Hall Render
      elements.treeContainer.classList.add('is-hidden');
      elements.memorialContainer.classList.remove('is-hidden');
      elements.memorialContainer.innerHTML = '';

      if (deadMembers.length === 0) {
        elements.memorialContainer.innerHTML = '<div class="muted" style="text-align:center; padding: 40px; width: 100%;">The archive is empty. No casualties recorded.</div>';
        return;
      }

      deadMembers.sort((a, b) => b.deathDate - a.deathDate).forEach(member => {
          const card = document.createElement('div');
          card.className = 'lineage-card is-dead';
          card.style.width = '100%'; 

          let trophiesHtml = (member.titles || []).map(t => `<span class="trophy-chip">${t}</span>`).join('');
          
          card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn" title="Revive / Correct Error" onclick="window.EAHA_Revive('${member.id}')">❤️‍🩹</button>
                <button class="action-btn" title="Delete Permanently" onclick="window.EAHA_DeleteMember('${member.id}')" style="color: var(--danger);">✕</button>
            </div>
            <strong style="color: var(--danger); font-size: 1.2em; display:block;">${member.name}</strong>
            <div style="font-size: 0.8em; color: var(--muted); margin-bottom: 10px;">Former ${member.packRole || 'Member'} • Gen ${member.generation}</div>
            
            <div style="font-size: 0.85em; margin-bottom: 5px;"><strong>Cause of Death:</strong> ${member.deathCause || 'Unknown'}</div>
            <div style="font-size: 0.85em; margin-bottom: 10px;"><strong>Fell at:</strong> ${member.deathLocation || 'Unknown'}</div>
            
            <div class="trophy-container">${trophiesHtml}</div>
            <div style="font-size: 0.75em; color: var(--muted); margin-top: 10px; border-top: 1px solid var(--border); padding-top: 5px;">
                Archived: ${member.deathDate ? new Date(member.deathDate).toLocaleDateString() : 'Unknown'}
            </div>
          `;
          elements.memorialContainer.appendChild(card);
      });
  }
};

window.addEventListener('resize', drawConnections);
elements.treeContainer.addEventListener('scroll', drawConnections); // Ensure lines stay attached while scrolling

// Tab Listeners
elements.tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        elements.tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        activeTab = e.target.dataset.tab;
        renderWorkspace();
    });
});

// Dropdowns
const populateSpeciesDropdown = () => {
  elements.packSpeciesInput.innerHTML = '<option value="Unknown">Select Species...</option>';
  const defaultSpecies = [
    "Acrocanthosaurus", "Albertosaurus", "Alioramus", "Amargasaurus", "Ano", 
    "Barsboldia", "Camptosaurus", "Ceratosaurus", "Concavenator", "Daspletosaurus", 
    "Deinocheirus", "Deinonychus", "Eotriceratops", "Eurhinosaurus", "Hatzegopteryx", 
    "Iguanodon", "Kaiwhekea", "Kentrosaurus", "Latenivenatrix", "Megalo", 
    "Megalania", "Metriacanthosaurus", "Pachycephalosaurus", "Pycnonemosaurus", 
    "Sarcosuchus", "Spinosaurus", "Stegosaurus", "Styracosaurus", "Suchomimus", 
    "Thalassodromeus", "Tyrannosaurus", "Triceratops"
  ];
  const speciesSet = new Set(defaultSpecies);
  if (db.creatures && db.creatures.length > 0) {
    db.creatures.forEach(c => { if (c.name) speciesSet.add(c.name); });
  }
  Array.from(speciesSet).sort((a, b) => a.localeCompare(b)).forEach(speciesName => {
    elements.packSpeciesInput.appendChild(new Option(speciesName, speciesName));
  });
};

const populateParentDropdowns = (pack, excludeId = null) => {
    elements.memberSireInput.innerHTML = '<option value="">Unknown / None</option>';
    elements.memberDamInput.innerHTML = '<option value="">Unknown / None</option>';
    
    if(!pack) return;
    const living = pack.members.filter(m => m.status === 'Alive' && m.id !== excludeId);
    
    living.forEach(m => {
        elements.memberSireInput.appendChild(new Option(`${m.name} (Gen ${m.generation})`, m.id));
        elements.memberDamInput.appendChild(new Option(`${m.name} (Gen ${m.generation})`, m.id));
    });
};

// --- Modals & Data Entry ---
elements.createBtn.addEventListener('click', () => {
  elements.packNameInput.value = '';
  populateSpeciesDropdown();
  elements.packSpeciesInput.value = 'Unknown';
  elements.packModal.classList.remove('is-hidden');
});
elements.cancelPackBtn.addEventListener('click', () => elements.packModal.classList.add('is-hidden'));
elements.savePackBtn.addEventListener('click', async () => {
  const name = elements.packNameInput.value.trim();
  const species = elements.packSpeciesInput.value.trim();
  if (!name) return showToast('Pack name is required.', 'error');

  const newPack = { id: generateId(), packName: name, species: species, members: [], timestamp: Date.now() };
  if (!db.lineage) db.lineage = [];
  db.lineage.push(newPack);
  
  await window.EAHADataStore.saveData(db);
  currentLineageId = newPack.id;
  elements.packModal.classList.add('is-hidden');
  renderList();
  renderWorkspace();
  showToast('New Bloodline established.');
});

// Add / Edit Member
document.getElementById('addMemberBtn').addEventListener('click', () => {
  const pack = db.lineage.find(l => l.id === currentLineageId);
  editingMemberId = null;
  populateParentDropdowns(pack);
  
  elements.memberModalTitle.textContent = 'Add Family Member';
  elements.saveMemberBtn.textContent = 'Save to Lineage';
  
  elements.memberNameInput.value = '';
  elements.memberGenInput.value = '1';
  elements.memberRoleInput.value = 'Subordinate';
  elements.memberSireInput.value = '';
  elements.memberDamInput.value = '';
  elements.memberNotesInput.value = '';
  
  elements.memberModal.classList.remove('is-hidden');
  elements.memberNameInput.focus();
});

// Editor Initialization
window.EAHA_EditMember = (memberId) => {
    const pack = db.lineage.find(l => l.id === currentLineageId);
    const member = pack?.members.find(m => m.id === memberId);
    if(!member) return;

    editingMemberId = memberId;
    populateParentDropdowns(pack, memberId); // Exclude self from parent options
    
    elements.memberModalTitle.textContent = 'Edit Member Profile';
    elements.saveMemberBtn.textContent = 'Update Record';
    
    elements.memberNameInput.value = member.name;
    elements.memberGenInput.value = member.generation || 1;
    elements.memberRoleInput.value = member.packRole || 'Subordinate';
    elements.memberSireInput.value = member.sireId || '';
    elements.memberDamInput.value = member.damId || '';
    elements.memberNotesInput.value = member.notes || '';
    
    elements.memberModal.classList.remove('is-hidden');
};

elements.cancelMemberBtn.addEventListener('click', () => {
    elements.memberModal.classList.add('is-hidden');
    editingMemberId = null;
});

elements.saveMemberBtn.addEventListener('click', async () => {
  const pack = db.lineage.find(l => l.id === currentLineageId);
  if (!pack) return;

  const name = elements.memberNameInput.value.trim();
  if (!name) return showToast('Member name is required.', 'error');

  if (editingMemberId) {
      // Update Mode
      const member = pack.members.find(m => m.id === editingMemberId);
      if(member) {
          member.name = name;
          member.generation = parseInt(elements.memberGenInput.value, 10) || 1;
          member.packRole = elements.memberRoleInput.value;
          member.sireId = elements.memberSireInput.value || null;
          member.damId = elements.memberDamInput.value || null;
          member.notes = elements.memberNotesInput.value.trim();
      }
      showToast(`${name}'s profile updated.`);
  } else {
      // Create Mode
      pack.members.push({
        id: generateId(),
        name: name,
        generation: parseInt(elements.memberGenInput.value, 10) || 1,
        packRole: elements.memberRoleInput.value,
        sireId: elements.memberSireInput.value || null,
        damId: elements.memberDamInput.value || null,
        notes: elements.memberNotesInput.value.trim(),
        titles: [],
        status: 'Alive',
        dateAdded: Date.now()
      });
      showToast(`${name} added to the family tree.`);
  }

  await window.EAHADataStore.saveData(db);
  elements.memberModal.classList.add('is-hidden');
  editingMemberId = null;
  renderWorkspace();
  renderList();
});

// Total Deletion Logic
window.EAHA_DeleteMember = async (memberId) => {
    if(!confirm("WARNING: This will completely erase this member from the database, not archive them. Proceed?")) return;
    
    const pack = db.lineage.find(l => l.id === currentLineageId);
    if(pack) {
        pack.members = pack.members.filter(m => m.id !== memberId);
        
        // Remove this member as a parent from any offspring to prevent corrupt lines
        pack.members.forEach(m => {
            if (m.sireId === memberId) m.sireId = null;
            if (m.damId === memberId) m.damId = null;
        });

        await window.EAHADataStore.saveData(db);
        renderWorkspace();
        renderList();
        showToast('Member data purged.', 'error');
    }
};

// Trophy Modal Logic
window.EAHA_TriggerTrophy = (memberId) => {
    trophyMemberId = memberId;
    elements.newTrophyName.value = '';
    elements.trophyModal.classList.remove('is-hidden');
    elements.newTrophyName.focus();
};
elements.cancelTrophyBtn.addEventListener('click', () => elements.trophyModal.classList.add('is-hidden'));
elements.saveTrophyBtn.addEventListener('click', async () => {
    const pack = db.lineage.find(l => l.id === currentLineageId);
    const member = pack?.members.find(m => m.id === trophyMemberId);
    const trophy = elements.newTrophyName.value.trim();
    
    if (member && trophy) {
        if (!member.titles) member.titles = [];
        member.titles.push(trophy);
        await window.EAHADataStore.saveData(db);
        renderWorkspace();
        showToast(`Milestone Awarded: ${trophy}`);
    }
    elements.trophyModal.classList.add('is-hidden');
});

// Death Archive Logic
window.EAHA_TriggerDeath = (memberId) => {
    dyingMemberId = memberId;
    elements.deathCauseInput.value = '';
    elements.deathLocInput.value = '';
    elements.deathModal.classList.remove('is-hidden');
    elements.deathCauseInput.focus();
};
elements.cancelDeathBtn.addEventListener('click', () => elements.deathModal.classList.add('is-hidden'));
elements.confirmDeathBtn.addEventListener('click', async () => {
    const pack = db.lineage.find(l => l.id === currentLineageId);
    const member = pack?.members.find(m => m.id === dyingMemberId);
    
    if (member) {
        member.status = 'Deceased';
        member.deathCause = elements.deathCauseInput.value.trim() || 'Unknown Causes';
        member.deathLocation = elements.deathLocInput.value.trim() || 'Unknown Location';
        member.deathDate = Date.now();
        await window.EAHADataStore.saveData(db);
        renderWorkspace();
        renderList();
        showToast(`${member.name} has been archived to the Memorial Hall.`, 'error');
    }
    elements.deathModal.classList.add('is-hidden');
});

// Revive Logic (Correcting mistakes)
window.EAHA_Revive = async (memberId) => {
    if(!confirm("Revive this member and return them to the active tree?")) return;
    const pack = db.lineage.find(l => l.id === currentLineageId);
    const member = pack?.members.find(m => m.id === memberId);
    if(member) {
        member.status = 'Alive';
        member.deathCause = null;
        member.deathLocation = null;
        member.deathDate = null;
        await window.EAHADataStore.saveData(db);
        renderWorkspace();
        renderList();
        showToast(`${member.name} has returned to the pack.`);
    }
};

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

elements.search.addEventListener('input', renderList);

window.addEventListener('eaha-sync-complete', () => { showToast('Bloodline Sync Confirmed.', 'success'); });

// --- Initialization ---
const init = async () => {
  if (typeof window.EAHADataStore !== 'undefined') { db = await window.EAHADataStore.getData(); }
  if (!db.lineage) db.lineage = [];
  renderList();
  renderWorkspace();
};

let hasInitialized = false;
onAuthStateChanged(auth, async (user) => {
    if (user && !hasInitialized) {
        hasInitialized = true;
        await init();
    }
});
