# AI Agent Onboarding Guide: Smart Traffic Light MARL Project

Hello, fellow AI Agent! 👋 
Welcome to the **Smart Traffic Light (Multi-Agent Reinforcement Learning)** project workspace. 

This document is your step-by-step roadmap to understanding the entire project architecture, its evolution, and its current state. Please read the documents in the `doc/` folder in the specific order outlined below to quickly build your context before assisting the user with any code modifications or analysis.

---

## 🎯 1. Project High-Level Overview
Start by reading the final project summary. This will give you a top-down view of the system's purpose, the technologies used (React, Three.js, TypeScript), and the final achievements.
👉 **Read:** `doc/final_project_report.md`

**Key concepts you should grasp here:**
- The system is a 3x3 grid of traffic intersections.
- It uses independent Q-Learning Agents for each intersection (MARL).
- It handles complex scenarios like "Day/Night dynamic traffic" and "Emergency Vehicle Preemption".

---

## 🏗️ 2. The Foundation (Phase 1)
To understand how the underlying Reinforcement Learning environment was built from scratch, read the Phase 1 plan.
👉 **Read:** `doc/phase1_plan.md`

**Key concepts you should grasp here:**
- The initial state space definition (queue lengths on N/S/E/W).
- The action space (Keep phase vs. Change phase).
- The reward function design (punishing congestion and wait times).

---

## 🚀 3. Multi-Agent Evolution (Phase 2)
The project evolved from a single intersection to a 2x2 grid, introducing left-turn mechanics and solving "Stop-and-Go" waves using cooperative MARL techniques.
👉 **Read in order:**
1. `doc/left_turn_plan.md` (How left-turn lanes and phases were integrated).
2. `doc/phase2_multi_intersection_plan.md` (How the 2x2 grid and routing logic were structured).
3. `doc/rl_optimization_plan.md` (CRITICAL: Explains **Neighbor State Augmentation** and **Reward Blending** which are the secret sauce for preventing traffic gridlocks across multiple intersections).

*Optional but recommended: Check `doc/phase2_ab_test_report.md` to see how Phase 2 performed against Fixed Timers.*

---

## 🚦 4. The Final Form: 3x3 Grid & Extreme Testing (Phase 3)
The project reached its final milestone by expanding to a 3x3 grid (9 intersections), adding realistic continuous traffic density fluctuations (using Cosine interpolation), and implementing an Emergency Vehicle Preemption system.
👉 **Read:** `doc/phase3_final_report.md`

**Key concepts you should grasp here:**
- **Emergency Logic**: Vehicles with `isEmergency` flag trigger a `-50` massive penalty if blocked, forcing the Q-Learning agent to learn Preemption.
- **Physical Bottleneck Fixes**: Spawn points were extended to `+/- 250` units to allow massive queues without breaking the simulation physics.
- The A/B test results proving AI superiority over fixed timers in a 72 cars/sec extreme scenario.

---

## 🖥️ 5. User Interface & Controls
Finally, if you need to modify the React frontend, understand how the user interacts with the simulation.
👉 **Read:** `doc/gui_documentation.md`
*(Note: Some features like the Auto Traffic Checkbox and 3x3 naming were added after this doc was written, but the core layout remains the same).*

---

## 🛠️ Next Steps for You (The AI Agent)
Once you have read the above documents, you will have complete context of the `src/models/TrafficSimulation.ts` (the physics & environment) and `src/App.tsx` (the React rendering & main loop). 

You are now ready to answer the user's questions, analyze RL logs (`logs/rl_log_*.jsonl`), or implement new features like Deep Q-Networks (DQN) or Multi-modal traffic!
