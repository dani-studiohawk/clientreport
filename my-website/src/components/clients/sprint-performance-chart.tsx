'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

interface SprintData {
  name: string
  kpiTarget: number
  kpiAchieved: number
}

interface SprintPerformanceChartProps {
  data: SprintData[]
}

export function SprintPerformanceChart({ data }: SprintPerformanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No sprint data available
      </div>
    )
  }

  // Determine bar color based on whether achieved >= target
  const getBarColor = (achieved: number, target: number) => {
    return achieved >= target ? '#22C55E' : '#F59E0B' // green or amber/yellow
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis 
            dataKey="name" 
            tick={{ fill: '#6B7280', fontSize: 12 }}
            tickLine={{ stroke: '#D1D5DB' }}
            label={{ value: 'Sprint', position: 'bottom', offset: 0, fill: '#6B7280', fontSize: 12 }}
          />
          <YAxis 
            tick={{ fill: '#6B7280', fontSize: 12 }}
            tickLine={{ stroke: '#D1D5DB' }}
            label={{ value: 'Links', angle: -90, position: 'insideLeft', fill: '#6B7280', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            formatter={(value: number, name: string) => {
              const label = name === 'kpiAchieved' ? 'KPI Achieved' : 'KPI Target'
              return [value, label]
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: 10 }}
            iconType="circle"
            formatter={(value: string) => {
              if (value === 'kpiAchieved') return 'KPI Achieved'
              if (value === 'kpiTarget') return 'KPI Target'
              return value
            }}
          />
          {/* KPI Achieved as bars with conditional coloring */}
          <Bar 
            dataKey="kpiAchieved" 
            name="kpiAchieved"
            radius={[4, 4, 0, 0]}
            maxBarSize={80}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={getBarColor(entry.kpiAchieved, entry.kpiTarget)} 
              />
            ))}
          </Bar>
          {/* KPI Target as dashed line */}
          <Line
            type="monotone"
            dataKey="kpiTarget"
            name="kpiTarget"
            stroke="#6B7280"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#6B7280', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
