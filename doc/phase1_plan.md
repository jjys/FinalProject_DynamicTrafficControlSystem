# 智慧城市：動態紅綠燈控制系統 (Phase 1)

本計畫旨在透過純前端網頁 APP 建立一個基於 Q-Learning 強化學習的動態紅綠燈控制系統。APP 將包含 2D/3D 十字路口動畫視覺化，以及顯示平均等候時間與車輛擁堵數的儀表板。

## 框架與技術
- **框架**：Vite + React + TypeScript。
- **樣式**：Vanilla CSS，加入深色模式 (Dark Mode) 的科技感視覺。
- **3D 渲染**：使用 React Three Fiber (@react-three/fiber) 與 @react-three/drei 實現可互動的上帝視角。

## 強化學習設定 (Q-Learning)
- **State (狀態)**：四個方向的等待車輛數進行離散化，後續最佳化為 `[目前相位, 南北向總排隊等級, 東西向總排隊等級]`。
- **Action (動作)**：0 表示「維持目前綠燈方向」，1 表示「切換綠燈方向」。
- **Reward (獎勵)**：每一步給予 `- (所有車道的總等待車輛數)` 作為負獎勵。後續最佳化為加入「切換懲罰 (Switch Penalty)」以避免紅綠燈頻繁閃爍。

## 主要元件
- `QLearning.ts`: Q-Table 維護、Epsilon-greedy 動作選擇與學習更新。
- `TrafficSimulation.ts`: 管理車流產生機率、車輛位置、速度控制與紅綠燈倒數。
- `Intersection.tsx`: 3D 場景渲染。
- `Dashboard.tsx`: 顯示訓練狀態與交通壅塞指標。
- `Controls.tsx`: 提供車流密度與 Epsilon 探索率的控制。
