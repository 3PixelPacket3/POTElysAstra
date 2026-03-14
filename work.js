<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EAHA | Rules & Guidelines</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="top-nav">
    <div class="brand">Elys Astra Helper Application</div>
    <nav class="nav-links">
      <a class="nav-btn" href="index.html">Dashboard</a>
      <a class="nav-btn" href="apps.html">Post Builder</a>
      <a class="nav-btn active" href="work.html">Rules &amp; Guidelines</a>
      <a class="nav-btn" href="docs.html">Creature Profiles</a>
      <a class="nav-btn" href="about.html">Stats</a>
      <a class="nav-btn" href="settings.html">JSON Backup</a>
      <a class="nav-btn" href="guide.html">About</a>
    </nav>
  </header>

  <main class="page builder-workspace">
    
    <aside class="preset-sidebar card" style="border-top: 5px solid var(--primary);">
      <h2 style="font-size: 1.5em;">Rulebook</h2>
      <p class="muted" style="margin-bottom: 20px; font-size: 0.9em; line-height: 1.4;">Manage and search server guidelines.</p>
      
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
        <input type="text" id="ruleSearch" placeholder="Search by keyword, tag, or title...">
        <select id="ruleCategoryFilter" class="full-width" style="cursor: pointer;"><option value="all">All Categories</option></select>
        <button class="btn full-width" id="addRuleBtn">+ Add New Rule</button>
      </div>
      
      <div class="preset-list" id="ruleList" style="display: flex; flex-direction: column; gap: 8px;">
        </div>
    </aside>

    <section class="editor-pane scrollable" style="flex: 2;">
      
      <div class="card" style="box-shadow: none; border: 2px solid var(--border); padding: 15px 25px; margin-bottom: 20px;">
        <div class="mode-toggle" id="modeToggleContainer" style="display: flex; gap: 10px;">
          <button class="btn active" data-mode="view" style="flex: 1;">Read Rule</button>
          <button class="btn btn-ghost" data-mode="edit" style="flex: 1;">Edit Rule</button>
        </div>
      </div>

      <div id="ruleView" class="card" style="border-top: 5px solid var(--primary); min-height: 400px;">
        <div style="text-align: center; padding: 60px 20px; color: var(--muted); font-size: 1.1em; font-weight: 500;">
          Select a rule from the directory to view its details.
        </div>
      </div>

      <div id="ruleForm" class="is-hidden">
        
        <div class="card" style="box-shadow: none; border: 2px solid var(--border);">
          <h2 style="color: var(--primary);">Rule Metadata</h2>
          <div class="form-grid">
            <label class="field"><span>Rule Title</span><input type="text" id="ruleTitle" placeholder="e.g., Body Down, Safe Zones"></label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <label class="field"><span>Category</span><input type="text" id="ruleCategory" placeholder="PvP, General, Hunting"></label>
              <label class="field"><span>Author / Source</span><input type="text" id="ruleAuthor" placeholder="Admin Name"></label>
            </div>
            <label class="field"><span>Search Tags (comma separated)</span><input type="text" id="ruleTags" placeholder="combat, body, claim"></label>
          </div>
        </div>

        <div class="card" style="box-shadow: none; border: 2px solid var(--border);">
          <div class="card-header" style="margin-bottom: 15px;">
             <h2 style="color: var(--primary); margin: 0;">Rule Content</h2>
             <span class="muted" style="font-size: 0.85em;" id="ruleUpdatedDate"></span>
          </div>
          
          <div id="ruleToolbar" style="display: flex; gap: 5px; background: var(--bg); padding: 5px; border-radius: 50px; border: 1px solid var(--border); margin-bottom: 15px; width: fit-content;">
            <button class="btn btn-ghost btn-sm" data-command="bold"><b>B</b></button>
            <button class="btn btn-ghost btn-sm" data-command="italic"><i>I</i></button>
            <button class="btn btn-ghost btn-sm" data-command="underline"><u>U</u></button>
            <button class="btn btn-ghost btn-sm" data-command="insertUnorderedList">• List</button>
            <button class="btn btn-ghost btn-sm" data-command="insertOrderedList">1. List</button>
          </div>
          
          <div id="ruleBody" class="editor-content" contenteditable="true" style="min-height: 300px; border: 2px solid var(--border); padding: 20px; border-radius: 12px; background: var(--bg); color: var(--text); line-height: 1.6; font-size: 1.05em;"></div>
        </div>

        <div class="card" style="display: flex; gap: 15px; flex-wrap: wrap; background: transparent; border: none; box-shadow: none; padding: 0;">
          <button class="btn" id="saveRule" style="flex: 1;">Save Rule Document</button>
          <button class="btn btn-ghost" id="duplicateRule">Duplicate</button>
          <button class="btn btn-ghost" id="deleteRule" style="border-color: var(--danger); color: var(--danger);">Delete Rule</button>
        </div>

      </div>
    </section>
  </main>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <footer style="text-align: center; padding: 20px; color: var(--muted); font-size: 0.9em;">© 2026 Elys Astra Helper Application Created by PixelPacket</footer>
  
  <script src="data-store.js"></script>
  <script src="work.js"></script>
</body>
</html>
