import React from 'react';
import { Activity, Clock, Car as CarIcon, Target } from 'lucide-react';

interface DashboardProps {
  stats: {
    congestedVehicles: number;
    totalCars: number;
    avgWaitTime: number | string;
  };
  qLearningStats: {
    episodes: number;
    epsilon: number;
    reward: number;
  };
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, qLearningStats }) => {
  return (
    <div className="dashboard">
      <h2 className="panel-title">Global Network Status</h2>
      
      <div className="stat-grid">
        <div className="stat-card" title="壅塞車輛 / 總車輛數：路網中因紅燈或車多而停下的車輛數，與目前路網總車數的比例。">
          <div className="stat-icon"><CarIcon size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Congested / Total</span>
            <span className="stat-value">{stats.congestedVehicles} / {stats.totalCars}</span>
          </div>
        </div>
        
        <div className="stat-card" title="壅塞比例：壅塞車輛佔總車輛數的百分比。比例越低代表交通越順暢。">
          <div className="stat-icon"><Clock size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Congestion Ratio</span>
            <span className="stat-value">{stats.totalCars > 0 ? Math.round((stats.congestedVehicles / stats.totalCars) * 100) : 0}%</span>
          </div>
        </div>

        <div className="stat-card" title="訓練週期 (Training Epochs)：AI 大腦累積的決策次數。數字越大代表 AI 學到越多經驗。">
          <div className="stat-icon"><Activity size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Training Epochs</span>
            <span className="stat-value">{qLearningStats.episodes}</span>
          </div>
        </div>

        <div className="stat-card" title="全域獎勵 (Global Reward)：AI 近期表現的平均分數。當車輛成功通過路口會加分，塞車或切換燈號會扣分。分數越高（正數）代表交通越順暢！">
          <div className="stat-icon"><Target size={20} /></div>
          <div className="stat-info">
            <span className="stat-label">Global Reward</span>
            <span className="stat-value" style={{ color: qLearningStats.reward < -50 ? '#e74c3c' : (qLearningStats.reward > 0 ? '#2ecc71' : '#f1c40f')}}>{Math.round(qLearningStats.reward)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
