'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { format, differenceInDays } from 'date-fns'
import { Calendar, Clock, Target, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { calculateSprintHealth, type SprintHealth } from '@/lib/sprint-health'

export interface SprintWithCalculations {
  id: string
  name: string
  sprint_number: number | null
  start_date: string
  end_date: string
  kpi_target: number
  kpi_achieved: number
  monthly_rate: number | null
  status: 'active' | 'completed' | 'cancelled' | 'pending'
  client_id: string
  clients: {
    id: string
    name: string
    monthly_hours: number | null
    report_status?: string | null
    dpr_lead_id?: string | null
  } | null
  hours_used: number
}

interface SprintCardProps {
  sprint: SprintWithCalculations
}

const healthConfig: Record<SprintHealth, { label: string; color: string; icon: React.ReactNode }> = {
  'on-track': {
    label: 'On Track',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: <TrendingUp className="h-3 w-3" />,
  },
  'at-risk': {
    label: 'At Risk',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  'behind': {
    label: 'Behind',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  'kpi-complete': {
    label: 'KPI Complete',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  'completed': {
    label: 'Completed',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
}

export function SprintCard({ sprint }: SprintCardProps) {
  const health = calculateSprintHealth(sprint)
  const healthInfo = healthConfig[health]
  
  const today = new Date()
  const startDate = new Date(sprint.start_date)
  const endDate = new Date(sprint.end_date)
  
  // Calculate KPI progress
  const kpiProgress = sprint.kpi_target > 0 
    ? (sprint.kpi_achieved / sprint.kpi_target) * 100 
    : 0
  
  // Calculate days remaining
  const totalDays = differenceInDays(endDate, startDate)
  const daysRemaining = Math.max(0, differenceInDays(endDate, today))
  const daysProgress = totalDays > 0 
    ? ((totalDays - daysRemaining) / totalDays) * 100 
    : 100
  
  // Calculate hours (sprint is 3 months, so monthly_hours * 3)
  const budgetHours = (sprint.clients?.monthly_hours || 0) * 3
  const hoursProgress = budgetHours > 0 
    ? (sprint.hours_used / budgetHours) * 100 
    : 0

  return (
    <Link href={`/dashboard/sprints/${sprint.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                {sprint.clients?.name || 'Unknown Client'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sprint #{sprint.sprint_number || '?'}
              </p>
            </div>
            <Badge className={`${healthInfo.color} flex items-center gap-1`}>
              {healthInfo.icon}
              {healthInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dates */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="h-4 w-4" />
            <span>
              {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
            </span>
          </div>

          {/* KPI Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <Target className="h-4 w-4" />
                KPI Progress
              </span>
              <span className="font-medium">
                {sprint.kpi_achieved}/{sprint.kpi_target} ({Math.round(kpiProgress)}%)
              </span>
            </div>
            <Progress 
              value={Math.min(kpiProgress, 100)} 
              className="h-2"
            />
          </div>

          {/* Hours Used */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                Hours Used
              </span>
              <span className="font-medium">
                {sprint.hours_used.toFixed(1)}/{budgetHours.toFixed(1)} hrs ({Math.round(hoursProgress)}%)
              </span>
            </div>
            <Progress 
              value={Math.min(hoursProgress, 100)} 
              className={`h-2 ${hoursProgress > 100 ? '[&>div]:bg-red-500' : ''}`}
            />
          </div>

          {/* Days Remaining */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Days Remaining</span>
              <span className="font-medium">
                {daysRemaining} of {totalDays} days
              </span>
            </div>
            <Progress 
              value={daysProgress} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function SprintCardGrid({ sprints }: { sprints: SprintWithCalculations[] }) {
  if (sprints.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        No sprints found
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sprints.map((sprint) => (
        <SprintCard key={sprint.id} sprint={sprint} />
      ))}
    </div>
  )
}

// Re-export from shared lib for convenience
export { calculateSprintHealth, type SprintHealth } from '@/lib/sprint-health'
