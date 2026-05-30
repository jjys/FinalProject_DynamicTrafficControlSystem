import { useEffect, useRef, useState } from 'react';
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
    ['n00', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)],
    ['n10', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)],
    ['n20', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)],
    ['n01', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)],
    ['n11', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)],
    ['n21', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)],
    ['n02', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)],
    ['n12', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)],
    ['n22', new QLearning(0.1, 0.9, 1.0, 0.995, 0.05)]
  ]));
  const frameRef = useRef<number>(0);
  
  const [running, setRunning] = useState(false);
  const [, setTickCount] = useState(0);

  const [stats, setStats] = useState({
    congestedVehicles: 0,
    totalCars: 0,
    avgWaitTime: '0.00'
  });
  
  // Phase 3: Continuous Sky Interpolation
  const getSkyColor = (time: number) => {
      // 0-15s: Day to Sunset
      // 15-30s: Sunset to Night
      // 30-60s: Night to Day
      
      const interpolate = (c1: number[], c2: number[], t: number) => {
          const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
          const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
          const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
          return `rgb(${r},${g},${b})`;
      };
      
      const day = [135, 206, 235];   // #87CEEB
      const sunset = [255, 176, 133]; // #FFB085
      const night = [26, 37, 44];     // #1A252C
      
      if (time < 15) {
          return interpolate(day, sunset, time / 15);
      } else if (time < 30) {
          return interpolate(sunset, night, (time - 15) / 15);
      } else {
          // Night to Day (slower, 30 seconds)
          return interpolate(night, day, (time - 30) / 30);
      }
  };
  
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
  const [timeOfDay, setTimeOfDay] = useState<number>(0);
  const fixedPhaseTimerRef = useRef(0);
  const autoTrafficRef = useRef(true);
  const [autoTrafficState, setAutoTrafficState] = useState(true);

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
                
                // Phase 2: Cooperative MARL
                // 1. Get Actions
                const actions = new Map<string, number>();
                const states = new Map<string, number[]>();
                simRef.current.nodes.forEach(node => {
                    const state = simRef.current.getNodeState(node.id);
                    states.set(node.id, state);
                    actions.set(node.id, agentsRef.current.get(node.id)!.getAction(state));
                });
                
                // 2. Apply Actions
                simRef.current.nodes.forEach(node => {
                    simRef.current.applyAction(node.id, actions.get(node.id)!);
                });
                
                // 3. Get Next States and Local Rewards (with Flicker Penalty)
                const nextStates = new Map<string, number[]>();
                const localRewards = new Map<string, number>();
                simRef.current.nodes.forEach(node => {
                    nextStates.set(node.id, simRef.current.getNodeState(node.id));
                    // Phase 3 Flicker Penalty: action === 1 gets -2 reward penalty
                    localRewards.set(node.id, simRef.current.getNodeReward(node.id) - (actions.get(node.id) === 1 ? 2 : 0));
                });
                
                // 4. Compute Blended Rewards and Learn
                simRef.current.nodes.forEach(node => {
                    const agent = agentsRef.current.get(node.id)!;
                    
                    // Phase 3: Strict Adjacent Neighbors Reward Blending
                    const neighbors = simRef.current.getAdjacentNeighbors(node.id);
                    let neighborRewardSum = 0;
                    neighbors.forEach(nId => {
                        neighborRewardSum += localRewards.get(nId) || 0;
                    });
                    
                    const blendedReward = localRewards.get(node.id)! + 0.5 * neighborRewardSum;
                    
                    agent.learn(states.get(node.id)!, actions.get(node.id)!, blendedReward, nextStates.get(node.id)!);
                    simRef.current.resetCarsPassed(node.id);
                    agent.endEpisode();

                    fetch('http://127.0.0.1:3001/log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            timestamp: Date.now(),
                            episode: agent.trainingEpisodes,
                            nodeId: node.id,
                            state: agent.getStateString(states.get(node.id)!),
                            action: actions.get(node.id)!,
                            reward: blendedReward,
                            nextState: agent.getStateString(nextStates.get(node.id)!),
                            epsilon: agent.getEpsilon(),
                            qValues: agent.getQValues(agent.getStateString(states.get(node.id)!))
                        })
                    }).catch(() => {});
                    
                    totalEpisodes = agent.trainingEpisodes;
                    avgEpsilon += agent.getEpsilon();
                    totalGlobalReward += agent.totalReward;
                });
                
                setQStats({
                    episodes: totalEpisodes,
                    epsilon: avgEpsilon / 9, // Phase 3: 9 agents
                    reward: totalGlobalReward
                });
            }
        }

        chartTimer += dt;
        if (chartTimer >= 1.0) {
            chartTimer = 0;
            const currentStats = simRef.current.getGlobalStats();
            setStats(currentStats);
            
            // Phase 3: Time of Day loop (0 to 60s)
            setTimeOfDay(prev => {
                const next = (prev + 1) % 60;
                // Update Spawn Rate based on Time of Day if Auto is enabled
                if (autoTrafficRef.current) {
                    // Phase 3: Smooth continuous interpolation using a Cosine wave
                    // Peak at t=0 (0.10), Trough at t=30 (0.002)
                    const peak = 0.10;
                    const trough = 0.002;
                    const amplitude = (peak - trough) / 2;
                    const offset = (peak + trough) / 2;
                    simRef.current.spawnRate = amplitude * Math.cos((next / 60) * 2 * Math.PI) + offset;
                }
                return next;
            });

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
    autoTrafficRef.current = false;
    setAutoTrafficState(false);
    setTickCount(c => c + 1);
  };

  const handleEpsilon = (eps: number) => {
    agentsRef.current.forEach(agent => agent.setEpsilon(eps));
    setQStats(prev => ({ ...prev, epsilon: eps }));
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Smart City: 3x3 Traffic Network</h1>
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
            autoTraffic={autoTrafficState}
            onToggleAutoTraffic={(val) => {
                autoTrafficRef.current = val;
                setAutoTrafficState(val);
            }}
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
          <div style={{ marginTop: '1rem', padding: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '5px' }}>
             <h4>
                Time of Day: {
                    timeOfDay < 15 ? '☀️ Morning Rush (Day)' : 
                    timeOfDay < 30 ? '🌇 Evening Flow (Sunset)' : 
                    timeOfDay < 45 ? '🌙 Midnight (Off-peak)' : 
                    '🌅 Dawn (Building up)'
                }
             </h4>
             <progress value={timeOfDay} max="60" style={{width: '100%'}} />
          </div>
        </div>
        
        {/* Phase 3 Dynamic Sky Background (Smooth Interpolation) */}
        <div className="view-panel" style={{
            backgroundImage: 'none',
            backgroundColor: getSkyColor(timeOfDay),
            transition: 'background-color 1s linear'
        }}>
          <Intersection cars={simState.cars} nodes={simState.nodes} />
          {chartData.length > 0 && <CongestionChart data={chartData} />}
        </div>
      </main>
    </div>
  );
}

export default App;
