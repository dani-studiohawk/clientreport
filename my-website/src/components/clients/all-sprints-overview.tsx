'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { format, differenceInDays } from 'date-fns'

interface SprintCardData {
  id: string
  name: string
  sprint_number: number | null
  start_date: string
  end_date: string
  status: string
  kpi_target: number
  kpi_achieved: number
  hours_used: number
  budget_hours: number
  monthly_rate: number | null
}

interface AllSprintsOverviewProps {
  sprints: SprintCardData[]
}

// Clockify tracking started on 02/02/2025
const TRACKING_START_DATE = new Date('2025-02-02')

type TrackingStatus = 'tracked' | 'partial' | 'not-tracked'

function getTrackingStatus(startDate: string, endDate: string): TrackingStatus {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  // If sprint ended before tracking started - not tracked
  if (end < TRACKING_START_DATE) {
    return 'not-tracked'
  }
  
  // If sprint started before tracking but ended after - partial
  if (start < TRACKING_START_DATE && end >= TRACKING_START_DATE) {
    return 'partial'
  }
  
  // Sprint fully within tracking period
  return 'tracked'
}

function getKpiEfficiencyColor(efficiency: number): string {
  if (efficiency >= 100) return 'bg-green-500'
  if (efficiency >= 75) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getHoursUtilizationColor(utilization: number): string {
  if (utilization <= 100) return 'bg-green-500'
  if (utilization <= 120) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function AllSprintsOverview({ sprints }: AllSprintsOverviewProps) {
  const today = new Date()

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
        All Sprints
      </h3>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {sprints.map((sprint) => {
          const startDate = new Date(sprint.start_date)
          const endDate = new Date(sprint.end_date)
          const trackingStatus = getTrackingStatus(sprint.start_date, sprint.end_date)
          const isTracked = trackingStatus === 'tracked'
          const isPartial = trackingStatus === 'partial'
          
          // Calculate days remaining for current sprint
          const daysRemaining = sprint.status === 'active' 
            ? Math.max(0, differenceInDays(endDate, today))
            : null
          
          // KPI efficiency
          const kpiEfficiency = sprint.kpi_target > 0 
            ? (sprint.kpi_achieved / sprint.kpi_target) * 100 
            : 0
          
          // Hours utilization
          const hoursUtilization = sprint.budget_hours > 0 
            ? (sprint.hours_used / sprint.budget_hours) * 100 
            : 0
          
          // Billable rate (monthly_rate / hours_used for this sprint's portion)
          // For a 3-month sprint, budget is monthly_rate * 3
          const sprintBudget = (sprint.monthly_rate || 0) * 3
          const billableRate = sprint.hours_used > 0 
            ? sprintBudget / sprint.hours_used 
            : null

          return (
            <Card key={sprint.id} className="border-l-4 border-l-green-500">
              <CardContent className="pt-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">
                    Sprint {sprint.sprint_number || '?'}
                  </h4>
                  {sprint.status === 'active' ? (
                    <Badge className="bg-blue-500 text-white hover:bg-blue-600">
                      CURRENT
                    </Badge>
                  ) : sprint.status === 'completed' ? (
                    <Badge className="bg-green-500 text-white hover:bg-green-600">
                      COMPLETED
                    </Badge>
                  ) : sprint.status === 'pending' ? (
                    <Badge className="bg-gray-500 text-white hover:bg-gray-600">
                      PENDING
                    </Badge>
                  ) : null}
                </div>
                
                {/* Dates */}
                <div className="text-sm text-gray-500">
                  <p>{format(startDate, 'dd/MM/yyyy')} → {format(endDate, 'dd/MM/yyyy')}</p>
                  {daysRemaining !== null && (
                    <p className="text-gray-400">({daysRemaining} days remaining)</p>
                  )}
                </div>
                
                {/* KPI */}
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase">KPI</p>
                  <p className="text-xl font-bold">
                    {sprint.kpi_achieved} / {sprint.kpi_target}
                  </p>
                  <p className="text-sm text-gray-500">
                    {kpiEfficiency.toFixed(0)}% efficiency
                  </p>
                </div>
                
                {/* Hours */}
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase">Hours</p>
                  {isTracked || isPartial ? (
                    <>
                      <p className="text-xl font-bold">
                        {sprint.hours_used.toFixed(1)}
                      </p>
                      <p className="text-sm text-gray-500">
                        of {sprint.budget_hours.toFixed(2)}h
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg text-gray-400">Hours not tracked</p>
                      <p className="text-sm text-gray-500">
                        Budget: {sprint.budget_hours.toFixed(2)}h
                      </p>
                    </>
                  )}
                </div>
                
                {/* Billable Rate */}
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase">Billable Rate</p>
                  {isTracked && billableRate ? (
                    <>
                      <p className="text-xl font-bold">${Math.round(billableRate)}/hr</p>
                      <p className="text-sm text-gray-500">
                        {hoursUtilization.toFixed(1)}% hours utilization
                      </p>
                    </>
                  ) : isPartial && billableRate ? (
                    <>
                      <p className="text-xl font-bold">${Math.round(billableRate)}/hr</p>
                      <p className="text-sm text-gray-400">
                        Partial tracking
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg text-gray-400">Not measured</p>
                      <p className="text-sm text-gray-500">
                        Budget: ${sprintBudget.toLocaleString()}
                      </p>
                    </>
                  )}
                </div>
                
                {/* Progress Bars */}
                <div className="space-y-3 pt-2">
                  {/* KPI Efficiency */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 uppercase">KPI Efficiency</p>
                    <Progress 
                      value={Math.min(kpiEfficiency, 100)} 
                      className={`h-2 ${kpiEfficiency >= 100 ? '[&>div]:bg-green-500' : kpiEfficiency >= 75 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`}
                    />
                  </div>
                  
                  {/* Hours Utilization */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 uppercase">Hours Utilization</p>
                    {isTracked || isPartial ? (
                      <Progress 
                        value={Math.min(hoursUtilization, 100)} 
                        className={`h-2 ${hoursUtilization <= 100 ? '[&>div]:bg-green-500' : hoursUtilization <= 120 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`}
                      />
                    ) : (
                      <div className="h-2 bg-gray-200 rounded-full" />
                    )}
                  </div>
                </div>
                
                {/* Tracking Status Badge */}
                {trackingStatus !== 'tracked' && (
                  <div className="pt-2">
                    <Badge 
                      variant="outline" 
                      className={trackingStatus === 'partial'
                        ? 'bg-orange-100 text-orange-700 border-orange-300' 
                        : 'bg-gray-100 text-gray-600 border-gray-300'
                      }
                    >
                      {trackingStatus === 'partial' ? 'Partial tracking' : 'Not tracked'}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
