import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export interface ChartData {
  time: string;
  congested: number;
}

interface Props {
  data: ChartData[];
}

export const CongestionChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="congestion-chart-container">
      <h3 className="chart-title">即時壅塞程度 (Real-time Congestion)</h3>
      <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#64748b" 
              fontSize={11} 
              tickMargin={8} 
              tick={{fill: '#64748b'}}
              axisLine={{stroke: '#334155'}}
            />
            <YAxis 
              stroke="#64748b" 
              fontSize={11} 
              allowDecimals={false} 
              tick={{fill: '#64748b'}}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', fontSize: '12px' }} 
              itemStyle={{ color: '#e74c3c', fontWeight: 'bold' }}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
            />
            <Line 
              type="monotone" 
              dataKey="congested" 
              name="壅塞車輛數"
              stroke="#e74c3c" 
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4, fill: '#e74c3c', stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
