# 🦖 Elys Astra Helper Application (EAHA)

**The Ultimate Offline Command Hub for Path of Titans Operators**

## 📖 Overview
EAHA is a specialized, zero-dependency, local web application engineered for operators on the *Path of Titans: Elys Astra* server. Built to bypass the need for internet-reliant Discord bots, this toolkit places combat analytics, dynamic map reconnaissance, and vitals tracking directly into the player's hands via their browser's secure local storage.

## 🚀 Key Architectural Features

### 🗺️ Smart-Learn Tactical Map
* **Clipboard API Integration:** Press `Ctrl + V` anywhere on the map screen to instantly parse raw Unreal Engine `(X,Y,Z)` coordinates from your clipboard.
* **Machine Learning Calibration:** The map engine features a dynamic, drag-and-drop calibration loop. By dragging the target pin to your exact in-game location, the system calculates the mathematical delta and permanently "learns" your screen offset for flawless future pin drops.
* **Vector Routing:** Draw, save, and overlay multi-point tactical migration routes across Gondwa.

### ⚔️ Combat Analytics Engine
* **Offline Ledger:** Log victories, defeats, and environmental deaths to a local database.
* **Dynamic Visualization:** Utilizing `Chart.js`, the dashboard renders a live Cause of Death radial graph and an Engagement Split (K/D) ratio based on your active creature.

### 🧬 Elysian Lifeline Tracker
* **Asynchronous Timers:** Set custom decay intervals for Comfort, Hygiene, and Satiation. 
* **Eldering Matrix:** Track migration milestones and unlockable Rebirth tokens for Stage 4 Elder dinosaurs.

### 💾 Immutable Data Sync
* **Master JSON Merge:** Pull the latest baseline creature stats and server rules from the master `JSON.json` file without overwriting or corrupting your personal tactical map pins and combat logs.

## 🛠️ Installation & Quick Start
EAHA requires no backend server, node modules, or complex deployment.
1. Download or clone this repository to your local machine.
2. Unzip the directory.
3. Double-click `index.html` to initialize the dashboard in your default web browser.

## 💻 Tech Stack
* **Frontend Structure:** HTML5, CSS3 (CSS Variables, Flexbox/Grid layouts)
* **Logic & DOM Manipulation:** Vanilla JavaScript (ES6+)
* **Data Visualization:** Chart.js
* **Persistence Layer:** Browser LocalStorage API & Custom JSON Parsing

---
*Developed and maintained by PixelPacket.*
