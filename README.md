# 🦖 Elys Astra Helper Application (EAHA)

EAHA is a specialized, offline-ready tactical dashboard and documentation toolkit built specifically for operators on the *Path of Titans: Elys Astra* server. It bypasses the need for internet-dependent server bots, placing combat analytics, map reconnaissance, and vitals tracking directly into the player's hands.

## 🚀 Features
* **Tactical Map Room:** Paste raw Unreal Engine coordinates `(X,Y,Z)` directly from the game to dynamically drop pins on a high-resolution 3445x3445 Gondwa map. Map custom migration routes and track PvP hotspots.
* **Combat Analytics:** Log victories, defeats, and starvation events. The dashboard automatically calculates your overall K/D ratio, active creature K/D, and generates a visual Cause of Death distribution chart.
* **Elysian Lifeline Tracker:** Monitor Comfort, Hygiene, and Satiation decay with a built-in alarm timer.
* **Offline Database:** Manage Creature Profiles, Server Rules, Lineage, and Custom Discord Post templates entirely within your browser's local storage.
* **JSON Backup/Restore:** Securely export your entire database for safekeeping or importing to other devices.

## 🛠️ Installation
EAHA is a pure client-side application requiring no backend servers or complex dependencies. 
1. Clone or download this repository to your local machine.
2. Or click on the URL to navigate
3. Unzip the folder.
4. Double-click `index.html` to open the application in your preferred web browser.

## 💻 Tech Stack
* **Frontend:** HTML5, CSS3 (Custom Variables/Grid), Vanilla JavaScript (ES6)
* **Data Visualization:** Chart.js
* **Data Storage:** Browser LocalStorage API (`data-store.js`)

## ⚙️ Map Calibration (Developer Note)
The Gondwa map parsing utilizes a responsive percentage-based formula. If pins appear slightly off-center due to differing map image borders, developers can navigate to `map.js` and tweak the `xOffsetPercent` and `yOffsetPercent` variables within the `handleCoordinatePaste` function to perfectly snap the grid.

---
*Created by PixelPacket.*
