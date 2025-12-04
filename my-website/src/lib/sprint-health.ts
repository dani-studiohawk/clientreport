import { differenceInDays } from 'date-fns'

export type SprintHealth = 'on-track' | 'at-risk' | 'behind' | 'kpi-complete' | 'completed'

interface SprintForHealthCalc {
  status: string
  kpi_achieved: number
  kpi_target: number
  start_date: string
  end_date: string
}

export function calculateSprintHealth(sprint: SprintForHealthCalc): SprintHealth {
  const today = new Date()
  const startDate = new Date(sprint.start_date)
  const endDate = new Date(sprint.end_date)
  
  // If sprint is marked as completed
  if (sprint.status === 'completed') return 'completed'
  
  // If KPI is already met
  if (sprint.kpi_achieved >= sprint.kpi_target && sprint.kpi_target > 0) {
    return 'kpi-complete'
  }
  
  // Calculate progress percentages
  const totalDays = differenceInDays(endDate, startDate)
  const daysElapsed = differenceInDays(today, startDate)
  const timeProgress = Math.max(0, Math.min(100, (daysElapsed / totalDays) * 100))
  
  const kpiProgress = sprint.kpi_target > 0 
    ? (sprint.kpi_achieved / sprint.kpi_target) * 100 
    : 100
  
  // Health logic based on plan.md description
  if (timeProgress >= 80 && kpiProgress < 60) return 'behind'
  if (timeProgress >= 60 && kpiProgress < 40) return 'at-risk'
  if (timeProgress >= 40 && kpiProgress < 20) return 'at-risk'
  
  return 'on-track'
}
