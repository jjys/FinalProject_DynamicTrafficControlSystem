import React from 'react';
import { Play, Square, RotateCcw, Settings2 } from 'lucide-react';

interface ControlsProps {
  running: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  spawnRate: number;
  onSpawnRateChange: (rate: number) => void;
  epsilon: number;
  onEpsilonChange: (eps: number) => void;
  mode: 'ai' | 'fixed';
  onModeChange: (mode: 'ai' | 'fixed') => void;
  recordStatus: 'idle' | 'recording' | 'replaying';
  onRecordAction: (action: 'record' | 'replay' | 'stop') => void;
}

export const Controls: React.FC<ControlsProps> = ({
  running,
  onToggleRun,
  onReset,
  spawnRate,
  onSpawnRateChange,
  epsilon,
  onEpsilonChange,
  mode,
  onModeChange,
  recordStatus,
  onRecordAction
}) => {
  return (
    <div className="controls-panel">
      <h2 className="panel-title">Simulation Controls</h2>
      
      <div className="control-group" title="交通密度：調整新車輛進入路網的頻率。往右調高會模擬尖峰時段，車輛較多容易造成壅塞。">
        <label className="control-label">
          <Settings2 size={16} /> Traffic Density (Peak / Off-peak)
        </label>
        <div className="slider-container">
          <span className="slider-val">Low</span>
          <input 
            type="range" 
            min="0.005" 
            max="0.08" 
            step="0.005"
            value={spawnRate} 
            onChange={(e) => onSpawnRateChange(parseFloat(e.target.value))} 
            className="slider"
          />
          <span className="slider-val">High</span>
        </div>
      </div>

      <div className="control-group" title="AI 探索率 (Epsilon)：控制 AI 嘗試新策略的機率。數值高(Explore)代表 AI 會亂試紅綠燈來累積經驗；數值低(Exploit)代表 AI 會完全依照過去學到的最佳經驗來運作。">
        <label className="control-label">
          <Settings2 size={16} /> AI Exploration Rate (Epsilon)
        </label>
        <div className="slider-container">
          <span className="slider-val">Exploit</span>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01"
            value={epsilon} 
            onChange={(e) => onEpsilonChange(parseFloat(e.target.value))} 
            className="slider"
          />
          <span className="slider-val">Explore</span>
        </div>
        <div className="hint-text">Value: {epsilon.toFixed(2)}</div>
      </div>

      <div className="control-group" style={{marginTop: '1rem'}}>
        <label className="control-label">A/B Test Mode</label>
        <div style={{display: 'flex', gap: '0.5rem', marginTop: '0.5rem'}}>
          <button className={`btn ${mode === 'ai' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onModeChange('ai')}>
            AI Smart Lights
          </button>
          <button className={`btn ${mode === 'fixed' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onModeChange('fixed')}>
            Fixed Timer (10s/5s)
          </button>
        </div>
      </div>

      <div className="control-group" style={{marginTop: '1rem'}} title="Record traffic to replay exactly the same scenario in another mode.">
        <label className="control-label">Deterministic Scenario</label>
        <div style={{display: 'flex', gap: '0.5rem', marginTop: '0.5rem'}}>
          <button 
            className={`btn ${recordStatus === 'recording' ? 'btn-danger' : 'btn-secondary'}`} 
            onClick={() => onRecordAction(recordStatus === 'recording' ? 'stop' : 'record')}
          >
            {recordStatus === 'recording' ? 'Stop Rec' : 'Record'}
          </button>
          <button 
            className={`btn ${recordStatus === 'replaying' ? 'btn-danger' : 'btn-secondary'}`} 
            onClick={() => onRecordAction(recordStatus === 'replaying' ? 'stop' : 'replay')}
          >
            {recordStatus === 'replaying' ? 'Stop Replay' : 'Replay'}
          </button>
        </div>
      </div>

      <div className="action-buttons" style={{marginTop: '1.5rem'}}>
        <button className={`btn ${running ? 'btn-danger' : 'btn-primary'}`} onClick={onToggleRun}>
          {running ? <><Square size={16} /> Stop</> : <><Play size={16} /> Start</>}
        </button>
        <button className="btn btn-secondary" onClick={onReset}>
          <RotateCcw size={16} /> Reset
        </button>
      </div>
    </div>
  );
};
