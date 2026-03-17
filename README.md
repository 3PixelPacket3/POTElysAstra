# 🦖 Elys Astra Helper Application (EAHA)

**The Ultimate Command Hub for Path of Titans Operators**

## 📖 Overview
Welcome to the Elys Astra Helper Application. This system is a highly advanced tactical suite designed to provide immediate analytical advantages, cloud-synchronized record-keeping, and rapid LFG deployments for Path of Titans survival operations.

## 🚀 Key Architectural Features

### 🗺️ Smart-Learn Tactical Map
* **Clipboard API Integration:** Press `Ctrl + V` anywhere on the map screen to instantly parse raw Unreal Engine `(X,Y,Z)` coordinates from your clipboard or insert a screen shot.
* **Machine Learning Calibration:** The map engine features a dynamic, drag-and-drop calibration loop. By dragging the target pin to your exact in-game location, the system calculates the mathematical delta and permanently "learns" your screen offset for flawless future pin drops.
* **Vector Routing:** Draw, save, and overlay multi-point tactical migration routes across Gondwa.

### ⚔️ Combat Analytics Engine
* **Online Ledger:** Log victories, defeats, and environmental deaths to a local database.
* **Dynamic Visualization:** Utilizing `Chart.js`, the dashboard renders a live Cause of Death radial graph and an Engagement Split (K/D) ratio based on your active creature.

### 🧬 Elysian Lifeline Tracker
* **Asynchronous Timers:** Set custom decay intervals for Comfort, Hygiene, and Satiation. 
* **Eldering Matrix:** Track migration milestones and unlockable Rebirth tokens for Stage 4 Elder dinosaurs.

### 💾 Immutable Data Sync

The Elys Astra Helper Application operates on a secure, serverless cloud architecture. Your data is split into two distinct tiers: Global Data and Personal Data.

Global Baseline (Admin Controlled): Base creature stats, overarching server rules, and system formulas are maintained exclusively by the Administration. When you log in, your application automatically downloads the latest baseline.
Personal Data (Private): Your map markers, custom creature builds, lineage charts, and combat logs are encrypted and tied strictly to your account. No other user can access your personal data.
Auto-Save Protocol: There is no "Save" button. Every modification you make to your personal data is instantly cached locally and synchronized with the cloud backend in real-time.
Manual Sync: Should the Admin announce an update to server rules or base creature stats, navigate to the Settings page and click "Sync with Central Server". This will download the new global data without overwriting your personal modifications.

## 🛠️ Installation & Quick Start
EAHA requires no backend server, node modules, or complex deployment.
1. Click on the URL and begin.

## 💻 Tech Stack
* **Frontend Structure:** HTML5, CSS3 (CSS Variables, Flexbox/Grid layouts)
* **Logic & DOM Manipulation:** Vanilla JavaScript (ES6+) + Firestack
* **Data Visualization:** Chart.js
* **Persistence Layer:** Browser LocalStorage API & Custom JSON Parsing + Firestack

---
*Developed and maintained by PixelPacket.*
