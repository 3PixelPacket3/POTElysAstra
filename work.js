// work.js
import { auth } from './data-store.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- Global State ---
let db = { creatures: [], rules: [], stats: [], customPresets: {} };
let currentRuleId = null;
let currentMode = 'view';

// --- DOM Elements ---
const elements = {
  list: document.getElementById('ruleList'),
  search: document.getElementById('ruleSearch'),
  categoryFilter: document.getElementById('ruleCategoryFilter'),
  addBtn: document.getElementById('addRuleBtn'),
  saveBtn: document.getElementById('saveRule'),
  duplicateBtn: document.getElementById('duplicateRule'),
  deleteBtn: document.getElementById('deleteRule'),
  viewPane: document.getElementById('ruleView'),
  formPane: document.getElementById('ruleForm'),
  modeButtons: document.querySelectorAll('.mode-toggle button'),
  
  // Form Inputs
  title: document.getElementById('ruleTitle'),
  category: document.getElementById('ruleCategory'),
  author: document.getElementById('ruleAuthor'),
  tags: document.getElementById('ruleTags'),
  body: document.getElementById('ruleBody'),
  updatedDate: document.getElementById('ruleUpdatedDate'),
  toolbar: document.getElementById('ruleToolbar')
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

const generateId = () => 'rule_' + Math.random().toString(36).substr(2, 9);
const formatTags = (text) => text.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);

// --- Navigation & Modes ---
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

// --- Form Syncing ---
const syncForm = (rule) => {
  elements.title.value = rule.title || '';
  elements.category.value = rule.category || '';
  elements.author.value = rule.author || '';
  elements.tags.value = (rule.tags || []).join(', ');
  elements.body.innerHTML = rule.bodyHtml || '';
  
  const dateStr = rule.updated ? new Date(rule.updated).toLocaleDateString() : 'New Rule';
  elements.updatedDate.textContent = `Last Updated: ${dateStr}`;
};

const gatherForm = () => {
  return {
    id: currentRuleId || generateId(),
    title: elements.title.value.trim() || 'Untitled Rule',
    category: elements.category.value.trim() || 'General',
    author: elements.author.value.trim(),
    tags: formatTags(elements.tags.value),
    updated: new Date().toISOString(), 
    bodyHtml: elements.body.innerHTML.trim()
  };
};

// --- View Renderer ---
const setView = (rule) => {
  if (!rule) {
    elements.viewPane.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: var(--muted); font-size: 1.1em; font-weight: 500;">Select a rule from the directory to view its details.</div>';
    return;
  }

  const dateStr = rule.updated ? new Date(rule.updated).toLocaleDateString() : 'Unknown';
  const tagChips = (rule.tags || []).map(tag => `<span style="background: var(--bg-alt); border: 1px solid var(--border); padding: 4px 10px; border-radius: 50px; font-size: 0.8em; color: var(--muted);">#${tag}</span>`).join('');

  elements.viewPane.innerHTML = `
    <div style="margin-bottom: 25px; border-bottom: 2px solid var(--border); padding-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <h2 style="margin: 0 0 10px 0; font-size: 2.2em; color: var(--primary);">${rule.title}</h2>
        <span style="background: color-mix(in srgb, var(--info) 15%, transparent); color: var(--info); padding: 6px 14px; border-radius: 50px; font-weight: bold; font-size: 0.9em; border: 1px solid var(--info);">${rule.category || 'General'}</span>
      </div>
      
      <div style="display: flex; gap: 15px; margin-top: 10px; font-size: 0.9em; color: var(--muted);">
        <span><strong>Author:</strong> ${rule.author || 'Server Staff'}</span>
        <span>•</span>
        <span><strong>Updated:</strong> ${dateStr}</span>
      </div>
      
      ${tagChips ? `<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 15px;">${tagChips}</div>` : ''}
    </div>

    <div style="line-height: 1.8; font-size: 1.05em; background: var(--bg); padding: 25px; border-radius: 16px; border: 1px solid var(--border); color: var(--text);">
      ${rule.bodyHtml || '<p class="muted" style="text-align:center;">No rule content provided.</p>'}
    </div>
  `;
};

// --- Roster Logic ---
const updateCategoryOptions = () => {
  const categories = new Set(['All Categories']);
  if (db.rules) {
    db.rules.forEach((r) => { if (r.category) categories.add(r.category); });
  }
  
  elements.categoryFilter.innerHTML = '';
  Array.from(categories).forEach(cat => {
    elements.categoryFilter.appendChild(new Option(cat, cat === 'All Categories' ? 'all' : cat));
  });
};

const renderList = () => {
  const searchTerm = elements.search.value.toLowerCase();
  const categoryFilter = elements.categoryFilter.value;
  
  elements.list.innerHTML = '';
  
  if (!db.rules) return;

  const filtered = db.rules.filter(r => {
    const textToSearch = `${r.title} ${r.tags ? r.tags.join(' ') : ''}`.toLowerCase();
    const matchesSearch = textToSearch.includes(searchTerm);
    const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length === 0) {
    elements.list.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">No rules match your search.</p>';
    return;
  }

  filtered.forEach(rule => {
    const item = document.createElement('div');
    item.className = `list-item ${currentRuleId === rule.id ? 'active' : ''}`;
    // Force Pointer CSS and disable text selection for cleaner UI
    item.style.cursor = 'pointer';
    item.style.userSelect = 'none';
    item.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%; pointer-events: none;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 1.1em; color: ${currentRuleId === rule.id ? 'var(--primary)' : 'var(--text)'};">${rule.title}</strong>
          <span style="font-size: 0.8em; color: var(--muted); background: var(--bg-alt); padding: 2px 8px; border-radius: 12px;">${rule.category || 'General'}</span>
        </div>
      </div>
    `;
    item.addEventListener('click', () => {
      currentRuleId = rule.id;
      syncForm(rule);
      setView(rule);
      setMode('view'); // Enforce view mode when clicking the list
      renderList(); 
    });
    elements.list.appendChild(item);
  });
};

// --- Database Operations ---
const saveRule = async () => {
  const data = gatherForm();
  if(!db.rules) db.rules = [];
  const index = db.rules.findIndex(r => r.id === data.id);
  
  if (index >= 0) db.rules[index] = data;
  else db.rules.push(data);
  
  // JARVIS FIX: Explicitly target the window object for global save
  await window.EAHADataStore.saveData(db);
  
  currentRuleId = data.id;
  updateCategoryOptions();
  renderList();
  setView(data);
  setMode('view');
  showToast('Rule Document Saved.');
};

const deleteRule = async () => {
  if (!currentRuleId || !confirm('Are you certain you want to delete this rule? This cannot be undone.')) return;
  
  db.rules = db.rules.filter(r => r.id !== currentRuleId);
  // JARVIS FIX: Explicitly target the window object for global save
  await window.EAHADataStore.saveData(db);
  
  currentRuleId = null;
  updateCategoryOptions();
  renderList();
  setView(null);
  setMode('view');
  showToast('Rule Erased.', 'error');
};

const duplicateRule = async () => {
  if (!currentRuleId) return;
  const data = gatherForm();
  data.id = generateId();
  data.title = data.title + ' (Copy)';
  data.updated = new Date().toISOString();
  
  db.rules.push(data);
  // JARVIS FIX: Explicitly target the window object for global save
  await window.EAHADataStore.saveData(db);
  
  currentRuleId = data.id;
  syncForm(data);
  updateCategoryOptions();
  renderList();
  setView(data);
  showToast('Rule Duplicated.');
};

// --- Initialization ---
const init = async () => {
  // JARVIS FIX: Ensuring the window object is correctly read
  if (typeof window.EAHADataStore !== 'undefined') {
    db = await window.EAHADataStore.getData();
  } else {
    console.error("Jarvis Alert: data-store.js is missing or restricted by module scope.");
  }

  updateCategoryOptions();
  renderList();

  // Bind Listeners
  elements.search.addEventListener('input', renderList);
  elements.categoryFilter.addEventListener('change', renderList);
  
  elements.modeButtons.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  elements.addBtn.addEventListener('click', () => {
    currentRuleId = null;
    syncForm({ tags: [] });
    setMode('edit');
  });

  elements.saveBtn.addEventListener('click', saveRule);
  elements.deleteBtn.addEventListener('click', deleteRule);
  elements.duplicateBtn.addEventListener('click', duplicateRule);

  // Rich Text Editor Toolbar
  elements.toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    document.execCommand(btn.dataset.command, false, null);
    elements.body.focus();
  });

  // Initial Boot State
  if (db.rules && db.rules.length > 0) {
    currentRuleId = db.rules[0].id;
    syncForm(db.rules[0]);
    setView(db.rules[0]);
  } else {
    setView(null);
  }
};

// JARVIS UPGRADE: The Auth Guard Pipeline
let hasInitialized = false;
onAuthStateChanged(auth, async (user) => {
    if (user && !hasInitialized) {
        hasInitialized = true;
        await init();
    }
});
