// js/post-builder.js

const PRESETS_KEY = 'eahaPostPresets';

// --- Default Templates & Themes ---
const templates = {
  event: {
    name: 'Event Setup',
    data: {
      title: '✧ Skyfire Rally ✧', channel: '#events', tag: 'Event', roles: '@here @Rangers', prefix: '>',
      sections: [
        { id: generateId(), title: 'Event Overview', subheading: 'Aerial scouting and treasure hunt', body: 'Gather at the Sunspire and follow the signal flares across the canyon.', bulletMode: 'none', enabled: true, dividerAbove: true, dividerBelow: false },
        { id: generateId(), title: 'Requirements', subheading: '', body: 'Bring a flyer or glide-capable companion.\nStay within visual range of the host.', bulletMode: 'bullet', enabled: true, dividerAbove: false, dividerBelow: false },
        { id: generateId(), title: 'Rewards', subheading: '', body: 'Cosmetic badge\nPriority nesting slot', bulletMode: 'emoji', enabled: true, dividerAbove: false, dividerBelow: true }
      ],
      checklist: { enabled: true, include: true, items: 'Confirm date/time\nAssign staff watch\nPost final reminder', questions: 'Start time?\nMax attendance?\nRequired roles?' }
    }
  },
  group: {
    name: 'Group Finder',
    data: {
      title: 'Looking for a Hunting Pack', channel: '#group-finder', tag: 'Group Finder', roles: '@Hunters', prefix: '',
      sections: [
        { id: generateId(), title: 'About Me', subheading: '', body: 'Main: T2 Allo\nPlaytime: 7-10 PM EST', bulletMode: 'bullet', enabled: true, dividerAbove: true, dividerBelow: false },
        { id: generateId(), title: 'Looking For', subheading: '', body: 'Small to mid pack\nRegular voice comms\nChill vibes', bulletMode: 'emoji', enabled: true, dividerAbove: false, dividerBelow: true }
      ],
      checklist: { enabled: true, include: false, items: 'Add timezone\nList preferred map', questions: 'Preferred playstyle?\nPreferred creatures?' }
    }
  }
};

const themes = {
  minimal: { name: 'Minimal', divider: '— — —', heading: (text) => `**${text}**`, bullet: '•', emojiBullet: '•' },
  fancy: { name: 'Fancy dividers & emojis', divider: '꒷︶꒷꒥꒷︶✧꒷︶꒷꒥꒷︶', heading: (text) => `✦ ${text.toUpperCase()} ✦`, bullet: '•', emojiBullet: '✨' },
  compact: { name: 'Compact', divider: '• • •', heading: (text) => `__${text}__`, bullet: '-', emojiBullet: '-' },
  rulebook: { name: 'Rulebook / Documentation', divider: '━━━━━━━━━━━━━━', heading: (text) => `### ${text}`, bullet: '•', emojiBullet: '➤' }
};

const emojiLibrary = {
  status: ['✅', '❌', '🟡', '🟢', '🔴', '📌', '✨'],
  food: ['🍖', '🥩', '🍓', '🥭', '🐟', '🪴', '🛡️'],
  server: ['🐉', '🪽', '🌙', '🗺️', '⚔️', '🏹', '🜂']
};

const dividerLibrary = ['꒷︶꒷꒥꒷︶✧꒷︶꒷꒥꒷︶', '━━━━━━༺༻━━━━━━', '•────────────────•', '✦･ﾟ: *✦*:･ﾟ✦', '— — —'];

// --- Application State ---
let state = {
  currentPresetId: null,
  title: '', channel: '', tag: '', roles: '', prefix: '', sections: [],
  checklist: { enabled: false, include: false, items: '', questions: '' },
  theme: 'fancy'
};

let activeTextarea = null;
let sortableInstance = null;

// --- DOM Elements ---
const elements = {
  templateSelect: document.getElementById('templateSelect'),
  themeSelect: document.getElementById('themeSelect'),
  sectionsEl: document.getElementById('sections'),
  previewEl: document.getElementById('postPreview'),
  presetListEl: document.getElementById('presetList'),
  updatePresetBtn: document.getElementById('updatePreset')
};

// --- Utilities ---
function generateId() { return 'sec_' + Math.random().toString(36).substr(2, 9); }

const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.className = 'toast', 3000);
};

const insertAtCursor = (text) => {
  if (!activeTextarea) return;
  const start = activeTextarea.selectionStart;
  const end = activeTextarea.selectionEnd;
  const value = activeTextarea.value;
  activeTextarea.value = value.slice(0, start) + text + value.slice(end);
  activeTextarea.selectionStart = activeTextarea.selectionEnd = start + text.length;
  activeTextarea.dispatchEvent(new Event('input'));
  activeTextarea.focus();
};

const sectionTemplate = () => ({
  id: generateId(), title: 'New Section', subheading: '', body: '', bulletMode: 'none', enabled: true, dividerAbove: false, dividerBelow: false
});

// --- Rendering & Logic ---
const renderSections = () => {
  elements.sectionsEl.innerHTML = '';
  state.sections.forEach((section, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'card drag-item';
    wrapper.style.marginBottom = '15px';
    wrapper.dataset.id = section.id;
    wrapper.innerHTML = `
      <div class="drag-handle">
        <h3 style="margin:0; font-size:1.1em;"><span class="muted" style="margin-right:10px;">⋮⋮</span> Section ${index + 1}</h3>
        <button class="btn btn-ghost btn-sm" data-action="remove" style="color: var(--danger); border-color: transparent;">X</button>
      </div>
      <div class="form-grid" style="padding: 15px;">
        <label class="field"><span>Title</span><input type="text" data-field="title" value="${section.title}"></label>
        <label class="field"><span>Subheading</span><input type="text" data-field="subheading" value="${section.subheading}"></label>
        <label class="field"><span>Body Text</span><textarea rows="3" data-field="body">${section.body}</textarea></label>
        
        <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap; margin-top: 5px;">
          <label class="field" style="flex: 1; min-width: 150px;">
            <span>Bullet Style</span>
            <select data-field="bulletMode">
              <option value="none" ${section.bulletMode === 'none' ? 'selected' : ''}>None</option>
              <option value="bullet" ${section.bulletMode === 'bullet' ? 'selected' : ''}>Plain Bullets</option>
              <option value="emoji" ${section.bulletMode === 'emoji' ? 'selected' : ''}>Emoji Bullets</option>
            </select>
          </label>
          <label class="toggle"><input type="checkbox" data-field="enabled" ${section.enabled ? 'checked' : ''}><span>Include</span></label>
          <label class="toggle"><input type="checkbox" data-field="dividerAbove" ${section.dividerAbove ? 'checked' : ''}><span>Divider Above</span></label>
          <label class="toggle"><input type="checkbox" data-field="dividerBelow" ${section.dividerBelow ? 'checked' : ''}><span>Divider Below</span></label>
        </div>
      </div>
    `;

    wrapper.querySelectorAll('input, textarea, select').forEach((input) => {
      input.addEventListener('focus', () => activeTextarea = input);
      input.addEventListener('change', (e) => {
        section[e.target.dataset.field] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        updatePreview();
      });
      input.addEventListener('input', (e) => {
        if(e.target.type !== 'checkbox') { section[e.target.dataset.field] = e.target.value; updatePreview(); }
      });
    });

    wrapper.querySelector('button[data-action="remove"]').addEventListener('click', () => {
      state.sections = state.sections.filter(s => s.id !== section.id);
      renderSections();
      updatePreview();
    });

    elements.sectionsEl.appendChild(wrapper);
  });

  if (sortableInstance) sortableInstance.destroy();
  if (typeof Sortable !== 'undefined') {
    sortableInstance = new Sortable(elements.sectionsEl, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: function (evt) {
        const movedItem = state.sections.splice(evt.oldIndex, 1)[0];
        state.sections.splice(evt.newIndex, 0, movedItem);
        renderSections(); 
        updatePreview();
      }
    });
  }
};

const updatePreview = () => {
  const theme = themes[state.theme];
  const lines = [];
  const header = [state.roles, state.channel, state.tag].filter(Boolean).join(' · ');
  const title = state.title ? `${state.prefix ? `${state.prefix} ` : ''}${state.title}` : '';

  if (header) lines.push(header);
  if (title) lines.push(title);
  if (header || title) lines.push(theme.divider);

  state.sections.forEach((section) => {
    if (!section.enabled) return;
    if (section.dividerAbove) lines.push(theme.divider);
    lines.push(theme.heading(section.title));
    if (section.subheading) lines.push(`_${section.subheading}_`);
    
    const bodyLines = section.body.split('\n').filter(Boolean);
    if (section.bulletMode === 'none') {
      lines.push(bodyLines.join('\n'));
    } else {
      const bullet = section.bulletMode === 'emoji' ? theme.emojiBullet : theme.bullet;
      lines.push(bodyLines.map(line => `${bullet} ${line}`).join('\n'));
    }
    
    if (section.dividerBelow) lines.push(theme.divider);
  });

  if (state.checklist.enabled && state.checklist.include) {
    lines.push(theme.divider);
    lines.push(theme.heading('Checklist'));
    if (state.checklist.items) lines.push(state.checklist.items.split('\n').filter(Boolean).map(i => `${theme.emojiBullet} ${i}`).join('\n'));
    if (state.checklist.questions) {
      lines.push(theme.heading('Questions to Answer'));
      lines.push(state.checklist.questions.split('\n').filter(Boolean).map(i => `${theme.bullet} ${i}`).join('\n'));
    }
  }

  elements.previewEl.textContent = lines.filter(Boolean).join('\n');
};

// --- Custom Presets (LocalStorage) ---
const getSavedPresets = () => JSON.parse(localStorage.getItem(PRESETS_KEY)) || {};

const renderPresets = () => {
  const presets = getSavedPresets();
  elements.presetListEl.innerHTML = '';
  
  if (Object.keys(presets).length === 0) {
    elements.presetListEl.innerHTML = '<p class="muted">No presets saved.</p>';
    return;
  }

  Object.values(presets).forEach(preset => {
    const item = document.createElement('div');
    item.className = `list-item ${state.currentPresetId === preset.id ? 'active' : ''}`;
    item.innerHTML = `
      <div><strong>${preset.name}</strong></div>
      <div style="display:flex; gap:5px;">
        <button class="btn btn-ghost btn-sm" onclick="loadPreset('${preset.id}')">Load</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger); border-color:transparent;" onclick="deletePreset('${preset.id}')">X</button>
      </div>
    `;
    elements.presetListEl.appendChild(item);
  });
};

window.loadPreset = (id) => {
  const presets = getSavedPresets();
  if (!presets[id]) return;
  const data = presets[id].data;
  
  state.currentPresetId = id;
  Object.assign(state, { title: data.title, channel: data.channel, tag: data.tag, roles: data.roles, prefix: data.prefix, checklist: { ...data.checklist }, theme: data.theme || 'fancy' });
  state.sections = JSON.parse(JSON.stringify(data.sections)); 

  populateFormFromState();
  elements.updatePresetBtn.disabled = false;
  renderPresets();
  showToast(`Loaded: ${presets[id].name}`);
};

window.deletePreset = (id) => {
  if(!confirm('Delete this preset?')) return;
  const presets = getSavedPresets();
  delete presets[id];
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  if (state.currentPresetId === id) { state.currentPresetId = null; elements.updatePresetBtn.disabled = true; }
  renderPresets();
};

const saveNewPreset = () => {
  const name = prompt('Name this preset:', state.title || 'New Preset');
  if (!name) return;
  
  const id = 'preset_' + Date.now();
  const presets = getSavedPresets();
  presets[id] = { id, name, data: JSON.parse(JSON.stringify(state)) };
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  
  state.currentPresetId = id;
  elements.updatePresetBtn.disabled = false;
  renderPresets();
  showToast('Preset saved!');
};

document.getElementById('updatePreset').addEventListener('click', () => {
  if (!state.currentPresetId) return;
  const presets = getSavedPresets();
  if (presets[state.currentPresetId]) {
    presets[state.currentPresetId].data = JSON.parse(JSON.stringify(state));
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    showToast('Preset updated.');
  }
});

// --- Base Form Handlers ---
const populateFormFromState = () => {
  ['postTitle', 'postChannel', 'postTag', 'postRoles', 'postPrefix'].forEach(id => {
    document.getElementById(id).value = state[id.replace('post', '').toLowerCase()];
  });
  document.getElementById('checklistEnabled').checked = state.checklist.enabled;
  document.getElementById('checklistInclude').checked = state.checklist.include;
  document.getElementById('checklistItems').value = state.checklist.items;
  document.getElementById('questionItems').value = state.checklist.questions;
  elements.themeSelect.value = state.theme;
  
  renderSections();
  updatePreview();
};

const loadBaseTemplate = (key) => {
  const template = templates[key];
  if (!template) return;
  state.currentPresetId = null; 
  elements.updatePresetBtn.disabled = true;
  
  const data = template.data;
  Object.assign(state, { title: data.title, channel: data.channel, tag: data.tag, roles: data.roles, prefix: data.prefix, checklist: { ...data.checklist } });
  state.sections = JSON.parse(JSON.stringify(data.sections));
  
  populateFormFromState();
  renderPresets();
};

// --- Initialization ---
const init = () => {
  Object.keys(templates).forEach(key => elements.templateSelect.appendChild(new Option(templates[key].name, key)));
  Object.keys(themes).forEach(key => elements.themeSelect.appendChild(new Option(themes[key].name, key)));

  // Bind core text inputs
  ['postTitle', 'postChannel', 'postTag', 'postRoles', 'postPrefix'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => { state[id.replace('post', '').toLowerCase()] = e.target.value; updatePreview(); });
    document.getElementById(id).addEventListener('focus', (e) => activeTextarea = e.target);
  });

  // Bind checklist inputs
  ['checklistEnabled', 'checklistInclude'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => { state.checklist[id.replace('checklist', '').toLowerCase()] = e.target.checked; updatePreview(); });
  });
  ['checklistItems', 'questionItems'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => { state.checklist[id === 'checklistItems' ? 'items' : 'questions'] = e.target.value; updatePreview(); });
    document.getElementById(id).addEventListener('focus', (e) => activeTextarea = e.target);
  });

  // Setup Emoji Libraries
  const renderChips = (containerId, items, isDivider) => {
    document.getElementById(containerId).innerHTML = items.map(item => 
      `<button type="button" class="chip" onclick="insertAtCursor('${isDivider ? '\\n'+item+'\\n' : item}')">${item}</button>`
    ).join('');
  };
  renderChips('emojiStatus', emojiLibrary.status, false);
  renderChips('emojiFood', emojiLibrary.food, false);
  renderChips('emojiServer', emojiLibrary.server, false);
  renderChips('dividerLibrary', dividerLibrary, true);

  // Buttons
  document.getElementById('addSection').addEventListener('click', () => { state.sections.push(sectionTemplate()); renderSections(); updatePreview(); });
  document.getElementById('saveNewPreset').addEventListener('click', saveNewPreset);
  document.getElementById('clearAll').addEventListener('click', () => {
    state = { currentPresetId: null, title: '', channel: '', tag: '', roles: '', prefix: '', sections: [sectionTemplate()], checklist: { enabled: false, include: false, items: '', questions: '' }, theme: 'fancy' };
    elements.updatePresetBtn.disabled = true;
    populateFormFromState();
    renderPresets();
  });
  document.getElementById('copyPost').addEventListener('click', () => navigator.clipboard.writeText(elements.previewEl.textContent).then(() => showToast('Copied to clipboard!')));
  document.getElementById('copyCode').addEventListener('click', () => navigator.clipboard.writeText(`\`\`\`\n${elements.previewEl.textContent}\n\`\`\``).then(() => showToast('Copied as Code Block!')));

  elements.templateSelect.addEventListener('change', () => loadBaseTemplate(elements.templateSelect.value));
  elements.themeSelect.addEventListener('change', () => { state.theme = elements.themeSelect.value; updatePreview(); });

  // Boot up
  renderPresets();
  loadBaseTemplate('event');
};

document.addEventListener('DOMContentLoaded', init);
