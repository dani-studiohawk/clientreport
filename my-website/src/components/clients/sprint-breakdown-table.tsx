'use client'

import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'

interface Sprint {
  id: string
  sprint_number: number
  start_date: string
  end_date: string
  status: string
  kpi_target: number
  kpi_achieved: number
  hours_used: number
  budget_hours: number
  monthly_rate: number | null
}

interface SprintBreakdownTableProps {
  sprints: Sprint[]
}

export function SprintBreakdownTable({ sprints }: SprintBreakdownTableProps) {
  const router = useRouter()

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Sprint</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Period</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">KPI Target</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">KPI Achieved</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Efficiency</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Hours Used</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Utilization</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Rate</th>
          </tr>
        </thead>
        <tbody>
          {sprints.map((sprint) => {
            const efficiency = sprint.kpi_target > 0 ? (sprint.kpi_achieved / sprint.kpi_target) * 100 : 0
            const utilization = sprint.budget_hours > 0 ? (sprint.hours_used / sprint.budget_hours) * 100 : 0
            const rate = sprint.hours_used > 0 && sprint.monthly_rate ? (sprint.monthly_rate * 3) / sprint.hours_used : 0
            const isActive = sprint.status === 'active'

            return (
              <tr 
                key={sprint.id} 
                className={`border-b border-gray-100 hover:bg-gray-50 hover:shadow-md transition-shadow cursor-pointer ${isActive ? 'bg-blue-50' : ''}`}
                onClick={() => router.push(`/dashboard/sprints/${sprint.id}`)}
              >
                <td className="py-4 px-4">
                  <div className="font-semibold text-gray-900">Sprint {sprint.sprint_number}</div>
                </td>
                <td className="py-4 px-4 text-sm text-gray-600">
                  {format(new Date(sprint.start_date), 'dd MMM')} - {format(new Date(sprint.end_date), 'dd MMM yy')}
                </td>
                <td className="py-4 px-4">
                  <Badge variant={
                    sprint.status === 'completed' ? 'secondary' :
                    sprint.status === 'active' ? 'default' :
                    'outline'
                  } className="text-xs">
                    {sprint.status.toUpperCase()}
                  </Badge>
                </td>
                <td className="py-4 px-4 text-right text-gray-900">{sprint.kpi_target}</td>
                <td className="py-4 px-4 text-right font-semibold text-gray-900">{sprint.kpi_achieved}</td>
                <td className="py-4 px-4 text-right">
                  <span className={`font-semibold ${
                    efficiency >= 100 ? 'text-green-600' :
                    efficiency >= 50 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {efficiency.toFixed(0)}%
                  </span>
                </td>
                <td className="py-4 px-4 text-right text-gray-900">
                  {sprint.hours_used.toFixed(1)} <span className="text-gray-400">/ {sprint.budget_hours.toFixed(0)}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className={`font-semibold ${
                    utilization > 100 ? 'text-red-600' :
                    utilization > 80 ? 'text-amber-600' :
                    'text-green-600'
                  }`}>
                    {utilization.toFixed(0)}%
                  </span>
                </td>
                <td className="py-4 px-4 text-right text-gray-900">
                  ${rate > 0 ? Math.round(rate) : '—'}/hr
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
