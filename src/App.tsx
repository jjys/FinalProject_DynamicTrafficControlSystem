import React, { useEffect, useRef, useState } from 'react';
import { TrafficSimulation } from './models/TrafficSimulation';
import { QLearning } from './models/QLearning';
import { Dashboard } from './components/Dashboard';
import { Controls } from './components/Controls';
import { Intersection } from './components/Intersection';
import { CongestionChart } from './components/CongestionChart';
import './App.css';

function App() {
  const simRef = useRef<TrafficSimulation>(new TrafficSimulation());
  const agentsRef = useRef(new Map([
    // [lr, gamma, epsilon, decay, min_epsilon]
    // Slow down decay from 0.95 to 0.995 to allow more exploration
    ['n00', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)],
    ['n10', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)],
    ['n01', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)],
    ['n11', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)]
  ]));
  const frameRef = useRef<number>();
  
  const [running, setRunning] = useState(false);
  const [, setTickCount] = useState(0);

  const [stats, setStats] = useState({
    congestedVehicles: 0,
    totalCars: 0,
    avgWaitTime: '0.00'
  });
  
  const [qStats, setQStats] = useState({
    episodes: 0,
    epsilon: 1.0,
    reward: 0
  });

  const [chartData, setChartData] = useState<{time: string, congested: number}[]>([]);

  const [simState, setSimState] = useState<{ cars: any[], nodes: any[] }>({
    cars: [],
    nodes: []
  });

  const [mode, setMode] = useState<'ai' | 'fixed'>('ai');
  const [recordStatus, setRecordStatus] = useState<'idle' | 'recording' | 'replaying'>('idle');
  const fixedPhaseTimerRef = useRef(0);

  useEffect(() => {
    let lastTime = performance.now();
    let actionTimer = 0;
    let chartTimer = 0;
    const actionInterval = 2; 

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (running) {
        simRef.current.tick(dt);
        
        if (mode === 'fixed') {
            fixedPhaseTimerRef.current += dt;
            // Assuming all nodes are synced in fixed mode
            const phaseType = simRef.current.nodes.get('n00')!.phase;
            const duration = (phaseType === 0 || phaseType === 2) ? 10 : 5;
            
            if (fixedPhaseTimerRef.current >= duration) {
                fixedPhaseTimerRef.current = 0;
                simRef.current.nodes.forEach(node => {
                    simRef.current.applyAction(node.id, 1);
                });
            }
        } else {
            actionTimer += dt;
            if (actionTimer >= actionInterval) {
                actionTimer = 0;
                
                let totalEpisodes = 0;
                let avgEpsilon = 0;
                let totalGlobalReward = 0;

                // Each agent takes an action
                simRef.current.nodes.forEach(node => {
                    const agent = agentsRef.current.get(node.id)!;
                    const state = simRef.current.getNodeState(node.id);
                    const action = agent.getAction(state);
                    
                    simRef.current.applyAction(node.id, action);
                    
                    const nextState = simRef.current.getNodeState(node.id);
                    // Reduce passed reward from 5 to 2 so it doesn't outweigh massive waiting penalties
                    const reward = simRef.current.getNodeReward(node.id) - (action === 1 ? 2 : 0);
                    
                    agent.learn(state, action, reward, nextState);
                    simRef.current.resetCarsPassed(node.id);
                    agent.endEpisode();

                    fetch('http://127.0.0.1:3001/log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            timestamp: Date.now(),
                            episode: agent.trainingEpisodes,
                            nodeId: node.id,
                            state: agent.getStateString(state),
                            action,
                            reward,
                            nextState: agent.getStateString(nextState),
                            epsilon: agent.getEpsilon(),
                            qValues: agent.getQValues(agent.getStateString(state))
                        })
                    }).catch(() => {});
                    
                    totalEpisodes = agent.trainingEpisodes; // roughly same for all
                    avgEpsilon += agent.getEpsilon();
                    totalGlobalReward += agent.totalReward;
                });
                
                setQStats({
                    episodes: totalEpisodes,
                    epsilon: avgEpsilon / 4,
                    reward: totalGlobalReward
                });
            }
        }

        chartTimer += dt;
        if (chartTimer >= 1.0) {
            chartTimer = 0;
            const currentStats = simRef.current.getGlobalStats();
            setStats(currentStats);
            
            setChartData(prev => {
                const now = new Date();
                const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                const newData = [...prev, { time: timeStr, congested: currentStats.congestedVehicles }];
                if (newData.length > 60) return newData.slice(newData.length - 60); // Keep last 60 seconds
                return newData;
            });

            // Log Metrics to backend
            fetch('http://127.0.0.1:3001/metrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timestamp: Date.now(),
                    mode,
                    congested: currentStats.congestedVehicles,
                    totalPassed: simRef.current.totalNetworkCarsPassed
                })
            }).catch(() => {});
        }
        
        setSimState({
            cars: [...simRef.current.cars],
            nodes: Array.from(simRef.current.nodes.values())
        });
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [running]);

  const toggleRun = () => setRunning(!running);
  
  const reset = () => {
    // Keep scenario data if we are replaying
    const savedRecorded = simRef.current.recordedScenario;
    const savedReplay = simRef.current.replayScenario;
    const savedRecordStatus = simRef.current.recordScenario;
    const savedSpawnRate = simRef.current.spawnRate;

    simRef.current = new TrafficSimulation();
    simRef.current.recordedScenario = savedRecorded;
    simRef.current.replayScenario = savedReplay;
    simRef.current.recordScenario = savedRecordStatus;
    simRef.current.spawnRate = savedSpawnRate;

    agentsRef.current.forEach(agent => agent.reset());
    setSimState({ cars: [], nodes: [] });
    setStats({ congestedVehicles: 0, totalCars: 0, avgWaitTime: '0.00' });
    setQStats({ episodes: 0, epsilon: 1.0, reward: 0 });
    setChartData([]);
    fixedPhaseTimerRef.current = 0;
  };

  const handleRecordAction = (action: 'record' | 'replay' | 'stop') => {
      let status: 'idle' | 'recording' | 'replaying' = 'idle';
      if (action === 'record') status = 'recording';
      if (action === 'replay') status = 'replaying';
      
      setRecordStatus(status);
      
      if (action === 'record') {
          simRef.current.recordedScenario = [];
          simRef.current.recordScenario = true;
          simRef.current.replayScenario = null;
          reset();
      } else if (action === 'replay') {
          simRef.current.recordScenario = false;
          simRef.current.replayScenario = [...simRef.current.recordedScenario];
          reset();
      } else if (action === 'stop') {
          simRef.current.recordScenario = false;
          simRef.current.replayScenario = null;
      }
  };

  const handleSpawnRate = (rate: number) => {
    simRef.current.spawnRate = rate;
    setTickCount(c => c + 1);
  };

  const handleEpsilon = (eps: number) => {
    agentsRef.current.forEach(agent => agent.setEpsilon(eps));
    setQStats(prev => ({ ...prev, epsilon: eps }));
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Smart City: 2x2 Traffic Network</h1>
        <p>Powered by Multi-Agent Reinforcement Learning</p>
      </header>
      
      <main className="app-content">
        <div className="side-panel">
          <Dashboard stats={stats as any} qLearningStats={qStats} />
          <Controls 
            running={running}
            onToggleRun={toggleRun}
            onReset={reset}
            spawnRate={simRef.current.spawnRate}
            onSpawnRateChange={handleSpawnRate}
            epsilon={qStats.epsilon}
            onEpsilonChange={handleEpsilon}
            mode={mode}
            onModeChange={(m) => {
                setMode(m);
                reset();
            }}
            recordStatus={recordStatus}
            onRecordAction={handleRecordAction}
          />
        </div>
        
        <div className="view-panel">
          <Intersection cars={simState.cars} nodes={simState.nodes} />
          {chartData.length > 0 && <CongestionChart data={chartData} />}
        </div>
      </main>
    </div>
  );
}

export default App;
