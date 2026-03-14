// post-builder.js

const PRESETS_KEY = 'eahaPostPresets';

// --- Expanded Cookie-Cutter Templates ---
const templates = {
  event: {
    name: 'Event: Standard Setup',
    data: {
      title: '✧ Server Event ✧', channel: '#events', tag: 'Event', roles: '@here @EventPing', prefix: '>',
      sections: [
        { id: generateId(), title: 'Event Overview', subheading: 'Brief description of the activity.', body: 'Gather at the specified location and await host instructions.', bulletMode: 'none', enabled: true, dividerAbove: true, dividerBelow: false },
        { id: generateId(), title: 'Requirements', subheading: '', body: 'Specific diet or tier required.\nStay within visual range.', bulletMode: 'bullet', enabled: true, dividerAbove: false, dividerBelow: false },
        { id: generateId(), title: 'Rewards', subheading: '', body: 'Cosmetic badge\nGrowth bump', bulletMode: 'emoji', enabled: true, dividerAbove: false, dividerBelow: true }
      ],
      checklist: { enabled: true, include: true, items: 'Confirm date/time\nAssign staff watch', questions: 'Start time?\nMax attendance?' }
    }
  },
  group: {
    name: 'Player: Group Finder',
    data: {
      title: 'Looking for a Hunting Pack', channel: '#group-finder', tag: 'LFG', roles: '@Hunters', prefix: '',
      sections: [
        { id: generateId(), title: 'About Me', subheading: '', body: 'Main: [Insert Dino]\nPlaytime: [Insert Time]', bulletMode: 'bullet', enabled: true, dividerAbove: true, dividerBelow: false },
        { id: generateId(), title: 'Looking For', subheading: '', body: 'Small to mid pack\nRegular voice comms\nChill vibes', bulletMode: 'emoji', enabled: true, dividerAbove: false, dividerBelow: true }
      ],
      checklist: { enabled: true, include: false, items: 'Add timezone', questions: 'Preferred playstyle?' }
    }
  },
  staff_announcement: {
    name: 'Admin: Official Announcement',
    data: {
      title: 'SERVER UPDATE', channel: '#announcements', tag: 'Update', roles: '@everyone', prefix: '🚨',
      sections: [
        { id: generateId(), title: 'Patch Notes', subheading: 'Changes effective immediately.', body: 'Adjusted global stamina drain.\nFixed collision issues at Great Lake.', bulletMode: 'bullet', enabled: true, dividerAbove: true, dividerBelow: false },
        { id: generateId(), title: 'Rule Adjustments', subheading: '', body: 'Updated Body Down rules. Please review the rulebook channel.', bulletMode: 'none', enabled: true, dividerAbove: false, dividerBelow: true }
      ],
      checklist: { enabled: false, include: false, items: '', questions: '' }
    }
  },
  character_profile: {
    name: 'Roleplay: Character Profile',
    data: {
      title: 'Character Record', channel: '#character-profiles', tag: 'RP', roles: '', prefix: '📜',
      sections: [
        { id: generateId(), title: 'Identity', subheading: '', body: 'Name: \nSpecies: \nGender: ', bulletMode: 'none', enabled: true, dividerAbove: true, dividerBelow: false },
        { id: generateId(), title: 'Physical Traits', subheading: '', body: 'Scars/Markings:\nMutation:\nSize:', bulletMode: 'none', enabled: true, dividerAbove: false, dividerBelow: false },
        { id: generateId(), title: 'Backstory', subheading: 'Brief history.', body: 'Write character lore here...', bulletMode: 'none', enabled: true, dividerAbove: false, dividerBelow: true }
      ],
      checklist: { enabled: false, include: false, items: '', questions: '' }
    }
  }
};

// --- Expanded Discord Themes ---
const themes = {
  minimal: { name: 'Minimal & Clean', divider: '— — —', heading: (text) => `**${text}**`, bullet: '•', emojiBullet: '•' },
  fancy: { name: 'Fantasy / Fancy', divider: '꒷︶꒷꒥꒷︶✧꒷︶꒷꒥꒷︶', heading: (text) => `✦ ${text.toUpperCase()} ✦`, bullet: '•', emojiBullet: '✨' },
  compact: { name: 'Compact / Data', divider: '• • •', heading: (text) => `__${text}__`, bullet: '-', emojiBullet: '-' },
  rulebook: { name: 'Admin Rulebook', divider: '━━━━━━━━━━━━━━', heading: (text) => `### ${text}`, bullet: '•', emojiBullet: '➤' },
  heavy: { name: 'Heavy Block', divider: '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬', heading: (text) => `**[ ${text.toUpperCase()} ]**`, bullet: '▪', emojiBullet: '🔹' }
};

// --- Expanded Design Libraries ---
const emojiLibrary = {
  status: ['✅', '❌', '🟡', '🟢', '🔴', '📌', '✨', '⚠️', '🚨', '🛠️', '🛑', '⏸️', '▶️', '⏳'],
  food: ['🍖', '🥩', '🍓', '🥭', '🐟', '🪴', '🛡️', '🌿', '🐾', '🦴', '🌧️', '🌙', '☀️'],
  server: ['🐉', '🪽', '🗺️', '⚔️', '🏹', '🜂', '👑', '🩸', '💀', '💎', '🔮', '🏰'],
  symbols: ['🔲', '🔳', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪', '🔹', '🔸', '➤', '✓']
};

const dividerLibrary = [
  '꒷︶꒷꒥꒷︶✧꒷︶꒷꒥꒷︶', 
  '━━━━━━༺༻━━━━━━', 
  '•────────────────•', 
  '✦･ﾟ: *✦*:･ﾟ✦', 
  '— — —', 
  '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
  '════════ ⋆★⋆ ════════'
];

// --- Unicode Font Mappings ---
const unicodeFonts = {
  gothic: {
    base:   'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    mapped: ['𝔞','𝔟','𝔠','𝔡','𝔢','𝔣','𝔤','𝔥','𝔦','𝔧','𝔨','𝔩','𝔪','𝔫','𝔬','𝔭','𝔮','𝔯','𝔰','𝔱','𝔲','𝔳','𝔴','𝔵','𝔶','𝔷','𝔄','𝔅','ℭ','𝔇','𝔈','𝔉','𝔊','ℌ','ℑ','𝔍','𝔎','𝔏','𝔐','𝔑','𝔒','𝔓','𝔔','ℜ','𝔖','𝔗','𝔘','𝔙','𝔚','𝔛','𝔜','ℨ','0','1','2','3','4','5','6','7','8','9']
  },
  script: {
    base:   'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    mapped: ['𝒶','𝒷','𝒸','𝒹','𝑒','𝒻','𝑔','𝒽','𝒾','𝒿','𝓀','𝓁','𝓂','𝓃','𝑜','𝓅','𝓆','𝓇','𝓈','𝓉','𝓊','𝓋','𝓌','𝓍','𝓎','𝓏','𝒜','𝐵','𝒞','𝒟','𝐸','𝐹','𝒢','𝐻','𝐼','𝒥','𝒦','𝐿','𝑀','𝒩','𝒪','𝒫','𝒬','𝑅','𝒮','𝒯','𝒰','𝒱','𝒲','𝒳','𝒴','𝒵','𝟢','𝟣','𝟤','𝟥','𝟦','𝟧','𝟨','𝟩','𝟪','𝟫']
  },
  double: {
    base:   'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    mapped: ['𝕒','𝕓','𝕔','𝕕','𝕖','𝕗','𝕘','𝕙','𝕚','𝕛','𝕜','𝕝','𝕞','𝕟','𝕠','𝕡','𝕢','𝕣','𝕤','𝕥','𝕦','𝕧','𝕨','𝕩','𝕪','𝕫','𝔸','𝔹','ℂ','𝔻','𝔼','𝔽','𝔾','ℍ','𝕀','𝕁','𝕂','𝕃','𝕄','ℕ','𝕆','ℙ','ℚ','ℝ','𝕊','𝕋','𝕌','𝕍','𝕎','𝕏','𝕐','ℤ','𝟘','𝟙','𝟚','𝟛','𝟜','𝟝','𝟞','𝟟','𝟠','𝟡']
  }
};

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
  if (type === 'error') toast.style.backgroundColor = 'var(--danger)';
  else toast.style.backgroundColor = 'var(--primary)';
  setTimeout(() => toast.className = 'toast', 3000);
};

// --- Cursor Tracking & Formatting Actions ---
const bindFocusTracking = (inputEl) => {
  inputEl.addEventListener('focus', (e) => activeTextarea = e.target);
};

const triggerInputUpdate = () => {
  if(activeTextarea) {
    activeTextarea.dispatchEvent(new Event('input'));
    activeTextarea.focus();
  }
};

const insertAtCursor = (text) => {
  if (!activeTextarea) {
    showToast("Click inside a text box first to insert design elements.", "error");
    return;
  }
  const start = activeTextarea.selectionStart;
  const end = activeTextarea.selectionEnd;
  const value = activeTextarea.value;
  activeTextarea.value = value.slice(0, start) + text + value.slice(end);
  activeTextarea.selectionStart = activeTextarea.selectionEnd = start + text.length;
  triggerInputUpdate();
};

const wrapTextForDiscord = (wrapper, prefix = null) => {
  if (!activeTextarea) return;
  const start = activeTextarea.selectionStart;
  const end = activeTextarea.selectionEnd;
  const value = activeTextarea.value;
  
  if (prefix) {
    // Adds > or # to the beginning of the selection
    activeTextarea.value = value.slice(0, start) + prefix + value.slice(start, end) + value.slice(end);
    activeTextarea.selectionStart = activeTextarea.selectionEnd = end + prefix.length;
  } else {
    // Wrap logic (e.g. **bold**)
    const selectedText = value.slice(start, end);
    activeTextarea.value = value.slice(0, start) + wrapper + selectedText + wrapper + value.slice(end);
    activeTextarea.selectionStart = activeTextarea.selectionEnd = end + (wrapper.length * 2);
  }
  triggerInputUpdate();
};

const applyUnicodeFont = (fontKey) => {
  if (!activeTextarea) return;
  const start = activeTextarea.selectionStart;
  const end = activeTextarea.selectionEnd;
  
  if (start === end) {
    showToast("Highlight text to apply a font.", "error");
    return;
  }

  const value = activeTextarea.value;
  const selectedText = value.slice(start, end);
  const fontObj = unicodeFonts[fontKey];
  let convertedText = '';

  for (let i = 0; i < selectedText.length; i++) {
    const char = selectedText[i];
    const index = fontObj.base.indexOf(char);
    if (index !== -1) {
      convertedText += fontObj.mapped[index];
    } else {
      convertedText += char;
    }
  }

  activeTextarea.value = value.slice(0, start) + convertedText + value.slice(end);
  activeTextarea.selectionStart = start;
  activeTextarea.selectionEnd = start + convertedText.length;
  triggerInputUpdate();
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
    wrapper.style.marginBottom = '20px';
    wrapper.style.boxShadow = 'none';
    wrapper.style.border = '2px solid var(--border)';
    wrapper.dataset.id = section.id;
    
    wrapper.innerHTML = `
      <div class="drag-handle">
        <h3 style="margin:0; font-size:1.1em; color: var(--primary);"><span class="muted" style="margin-right:10px;">⋮⋮</span> Section ${index + 1}</h3>
        <button class="btn btn-ghost btn-sm" data-action="remove" style="color: var(--danger); border-color: transparent;">✕ Remove</button>
      </div>
      <div class="form-grid" style="padding: 20px;">
        <label class="field"><span>Title</span><input type="text" data-field="title" value="${section.title}"></label>
        <label class="field"><span>Subheading (Optional)</span><input type="text" data-field="subheading" value="${section.subheading}"></label>
        <label class="field"><span>Body Text</span><textarea rows="4" data-field="body">${section.body}</textarea></label>
        
        <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap; margin-top: 10px; background: var(--bg); padding: 15px; border-radius: 12px; border: 1px solid var(--border);">
          <label class="field" style="flex: 1; min-width: 150px;">
            <span style="margin-bottom: 5px;">Bullet Style</span>
            <select data-field="bulletMode">
              <option value="none" ${section.bulletMode === 'none' ? 'selected' : ''}>None</option>
              <option value="bullet" ${section.bulletMode === 'bullet' ? 'selected' : ''}>Plain Bullets</option>
              <option value="emoji" ${section.bulletMode === 'emoji' ? 'selected' : ''}>Theme Emojis</option>
            </select>
          </label>
          <div style="display: flex; gap: 15px; flex-wrap: wrap;">
            <label class="toggle"><input type="checkbox" data-field="enabled" ${section.enabled ? 'checked' : ''}><span>Include</span></label>
            <label class="toggle"><input type="checkbox" data-field="dividerAbove" ${section.dividerAbove ? 'checked' : ''}><span>Divider Above</span></label>
            <label class="toggle"><input type="checkbox" data-field="dividerBelow" ${section.dividerBelow ? 'checked' : ''}><span>Divider Below</span></label>
          </div>
        </div>
      </div>
    `;

    // Bind inputs to state updates and active textarea tracking
    wrapper.querySelectorAll('input[type="text"], textarea').forEach(bindFocusTracking);

    wrapper.querySelectorAll('input, textarea, select').forEach((input) => {
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

  // Re-initialize Drag and Drop
  if (sortableInstance) sortableInstance.destroy();
  if (typeof Sortable !== 'undefined') {
    sortableInstance = new Sortable(elements.sectionsEl, {
      handle: '.drag-handle',
      animation: 200,
      ghostClass: 'sortable-ghost',
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
    
    const bodyLines = section.body.split('\n');
    if (section.bulletMode === 'none') {
      lines.push(bodyLines.join('\n'));
    } else {
      const bullet = section.bulletMode === 'emoji' ? theme.emojiBullet : theme.bullet;
      lines.push(bodyLines.map(line => line.trim() ? `${bullet} ${line}` : '').join('\n'));
    }
    
    if (section.dividerBelow) lines.push(theme.divider);
  });

  if (state.checklist.enabled && state.checklist.include) {
    lines.push(theme.divider);
    lines.push(theme.heading('Checklist'));
    if (state.checklist.items) lines.push(state.checklist.items.split('\n').filter(Boolean).map(i => `${theme.emojiBullet} ${i}`).join('\n'));
    if (state.checklist.questions) {
      lines.push('');
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
    elements.presetListEl.innerHTML = '<p class="muted" style="text-align: center; padding: 15px; background: var(--bg); border-radius: 12px; border: 1px dashed var(--border);">No custom presets saved.</p>';
    return;
  }

  Object.values(presets).forEach(preset => {
    const item = document.createElement('div');
    item.className = `list-item ${state.currentPresetId === preset.id ? 'active' : ''}`;
    item.style.flexDirection = 'column';
    item.style.alignItems = 'flex-start';
    item.style.gap = '10px';
    
    item.innerHTML = `
      <div style="font-weight: 600; width: 100%;">${preset.name}</div>
      <div style="display:flex; gap:10px; width: 100%;">
        <button class="btn btn-sm" style="flex: 1;" onclick="loadPreset('${preset.id}')">Load</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="deletePreset('${preset.id}')">Delete</button>
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
  showToast(`Loaded Preset: ${presets[id].name}`);
};

window.deletePreset = (id) => {
  if(!confirm('Are you sure you want to delete this custom preset?')) return;
  const presets = getSavedPresets();
  delete presets[id];
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  if (state.currentPresetId === id) { state.currentPresetId = null; elements.updatePresetBtn.disabled = true; }
  renderPresets();
};

const saveNewPreset = () => {
  const name = prompt('Name this new preset:', state.title || 'My Preset');
  if (!name) return;
  
  const id = 'preset_' + Date.now();
  const presets = getSavedPresets();
  presets[id] = { id, name, data: JSON.parse(JSON.stringify(state)) };
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  
  state.currentPresetId = id;
  elements.updatePresetBtn.disabled = false;
  renderPresets();
  showToast('New Custom Preset Saved!');
};

document.getElementById('updatePreset').addEventListener('click', () => {
  if (!state.currentPresetId) return;
  const presets = getSavedPresets();
  if (presets[state.currentPresetId]) {
    presets[state.currentPresetId].data = JSON.parse(JSON.stringify(state));
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    showToast('Preset Successfully Updated.');
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

  // Bind core text inputs for state tracking AND cursor focus tracking
  ['postTitle', 'postChannel', 'postTag', 'postRoles', 'postPrefix'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', (e) => { state[id.replace('post', '').toLowerCase()] = e.target.value; updatePreview(); });
    bindFocusTracking(el);
  });

  ['checklistEnabled', 'checklistInclude'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => { state.checklist[id.replace('checklist', '').toLowerCase()] = e.target.checked; updatePreview(); });
  });
  
  ['checklistItems', 'questionItems'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', (e) => { state.checklist[id === 'checklistItems' ? 'items' : 'questions'] = e.target.value; updatePreview(); });
    bindFocusTracking(el);
  });

  // Bind Format Buttons
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (btn.dataset.wrap) wrapTextForDiscord(btn.dataset.wrap);
      if (btn.dataset.prefix) wrapTextForDiscord('', btn.dataset.prefix);
    });
  });

  // Bind Font Conversion Buttons
  document.querySelectorAll('.font-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      applyUnicodeFont(btn.dataset.font);
    });
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
  renderChips('emojiSymbols', emojiLibrary.symbols, false);
  renderChips('dividerLibrary', dividerLibrary, true);

  // Bind Control Buttons
  document.getElementById('addSection').addEventListener('click', () => { state.sections.push(sectionTemplate()); renderSections(); updatePreview(); });
  document.getElementById('saveNewPreset').addEventListener('click', saveNewPreset);
  document.getElementById('clearAll').addEventListener('click', () => {
    if(confirm('Are you sure you want to clear the entire editor?')) {
      state = { currentPresetId: null, title: '', channel: '', tag: '', roles: '', prefix: '', sections: [sectionTemplate()], checklist: { enabled: false, include: false, items: '', questions: '' }, theme: 'fancy' };
      elements.updatePresetBtn.disabled = true;
      populateFormFromState();
      renderPresets();
    }
  });
  
  document.getElementById('copyPost').addEventListener('click', () => navigator.clipboard.writeText(elements.previewEl.textContent).then(() => showToast('Post Copied to Clipboard!')));
  document.getElementById('copyCode').addEventListener('click', () => navigator.clipboard.writeText(`\`\`\`\n${elements.previewEl.textContent}\n\`\`\``).then(() => showToast('Copied as Code Block!')));

  elements.templateSelect.addEventListener('change', () => loadBaseTemplate(elements.templateSelect.value));
  elements.themeSelect.addEventListener('change', () => { state.theme = elements.themeSelect.value; updatePreview(); });

  renderPresets();
  loadBaseTemplate('event');
};

document.addEventListener('DOMContentLoaded', init);
