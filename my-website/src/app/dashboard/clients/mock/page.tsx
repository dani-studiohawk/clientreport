'use client'

import { notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { format, differenceInDays } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SprintPerformanceChart } from '@/components/clients/sprint-performance-chart'
import { AllSprintsOverview } from '@/components/clients/all-sprints-overview'
import { useRouter, useSearchParams } from 'next/navigation'

export default function MockClientPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const theme = searchParams.get('theme') || 'default'
  const layoutVariant = searchParams.get('layoutVariant') || 'default'
  const uxDesign = searchParams.get('ux') === 'true'

  // Mock data based on the provided example
  const mockClient = {
    id: 'mock-budget-pet-products',
    name: 'Budget Pet Products',
    is_active: true,
    dpr_lead: { id: 'user-paige', name: 'Paige Claydon' },
    campaign_type: 'SEO & DPR Campaign',
    agency_value: 10260,
    monthly_rate: 3060,
    monthly_hours: 48.32, // Assuming 3 months per sprint
    hasPartialTracking: false,
  }

  const mockSprints = [
    {
      id: 'sprint-1',
      name: 'Sprint 1',
      sprint_number: 1,
      start_date: '2025-02-26',
      end_date: '2025-05-26',
      status: 'completed',
      kpi_target: 8,
      kpi_achieved: 0,
      monthly_rate: 3060,
    },
    {
      id: 'sprint-2',
      name: 'Sprint 2',
      sprint_number: 2,
      start_date: '2025-05-26',
      end_date: '2025-08-26',
      status: 'completed',
      kpi_target: 8,
      kpi_achieved: 11,
      monthly_rate: 3060,
    },
    {
      id: 'sprint-3',
      name: 'Sprint 3',
      sprint_number: 3,
      start_date: '2025-08-26',
      end_date: '2025-11-26',
      status: 'completed',
      kpi_target: 8,
      kpi_achieved: 47,
      monthly_rate: 3060,
    },
    {
      id: 'sprint-4',
      name: 'Sprint 4',
      sprint_number: 4,
      start_date: '2025-11-26',
      end_date: '2026-02-26',
      status: 'active',
      kpi_target: 8,
      kpi_achieved: 0,
      monthly_rate: 3060,
    },
  ]

  const mockTimeEntries = [
    { hours: 100.8, sprint_id: 'sprint-1' },
    { hours: 83.3, sprint_id: 'sprint-2' },
    { hours: 69.2, sprint_id: 'sprint-3' },
    { hours: 4.8, sprint_id: 'sprint-4' },
  ]

  // Calculate hours per sprint
  const hoursPerSprint: Record<string, number> = {}
  mockTimeEntries.forEach(entry => {
    if (entry.sprint_id) {
      hoursPerSprint[entry.sprint_id] = (hoursPerSprint[entry.sprint_id] || 0) + (entry.hours || 0)
    }
  })

  // Calculate contract-wide metrics
  const totalSprints = mockSprints.length
  const activeSprint = mockSprints.find(s => s.status === 'active')
  const currentSprintNumber = activeSprint?.sprint_number || totalSprints

  // Contract period (first sprint start to last sprint end)
  const firstSprint = mockSprints[0]
  const lastSprint = mockSprints[mockSprints.length - 1]
  const contractStart = firstSprint.start_date
  const contractEnd = lastSprint.end_date

  // Days remaining in current sprint
  const today = new Date()
  const daysRemaining = activeSprint?.end_date
    ? Math.max(0, differenceInDays(new Date(activeSprint.end_date), today))
    : 0

  // Total days across all sprints
  const totalContractDays = contractStart && contractEnd
    ? differenceInDays(new Date(contractEnd), new Date(contractStart))
    : 0

  // Contract KPI totals
  const totalKpiTarget = mockSprints.reduce((sum, s) => sum + (s.kpi_target || 0), 0)
  const totalKpiAchieved = mockSprints.reduce((sum, s) => sum + (s.kpi_achieved || 0), 0)
  const kpiProgress = totalKpiTarget > 0 ? (totalKpiAchieved / totalKpiTarget) * 100 : 0

  // Contract hours totals
  const monthlyHours = mockClient.monthly_hours
  const totalBudgetHours = monthlyHours * 3 * totalSprints // 3 months per sprint
  const totalHoursUsed = mockTimeEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
  const hoursProgress = totalBudgetHours > 0 ? (totalHoursUsed / totalBudgetHours) * 100 : 0
  const hoursUtilization = totalBudgetHours > 0 ? (totalHoursUsed / totalBudgetHours) * 100 : 0

  // Average billable rate
  const avgBillableRate = totalHoursUsed > 0 && mockClient.agency_value
    ? mockClient.agency_value / totalHoursUsed
    : null

  // Check if client has partial tracking
  const sprintsWithHours = mockSprints.filter(s => hoursPerSprint[s.id] && hoursPerSprint[s.id] > 0).length
  const hasPartialTracking = sprintsWithHours < totalSprints && sprintsWithHours > 0

  // Prepare sprint data for chart
  const sprintChartData = mockSprints.map(s => ({
    name: `Sprint ${s.sprint_number}`,
    kpiTarget: s.kpi_target || 0,
    kpiAchieved: s.kpi_achieved || 0,
  }))

  // Prepare sprint data for All Sprints overview
  const sprintCardsData = mockSprints.map(s => ({
    id: s.id,
    name: s.name,
    sprint_number: s.sprint_number,
    start_date: s.start_date,
    end_date: s.end_date,
    status: s.status,
    kpi_target: s.kpi_target || 0,
    kpi_achieved: s.kpi_achieved || 0,
    hours_used: hoursPerSprint[s.id] || 0,
    budget_hours: monthlyHours * 3,
    monthly_rate: mockClient.monthly_rate,
  }))

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Toggle Buttons */}
      <div className="flex gap-2 mb-6">
        <Button onClick={() => router.push('/dashboard/clients')} variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Clients
        </Button>
      </div>

      {/* Hero Header Section */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            {mockClient.name}
          </h1>
          <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-sm px-3 py-1">
            Active
          </Badge>
        </div>
        <div className="flex items-center gap-6 text-base text-gray-600 dark:text-gray-400">
          <span><strong>DPR Lead:</strong> {mockClient.dpr_lead?.name}</span>
          <span>•</span>
          <span>{mockClient.campaign_type}</span>
          <span>•</span>
          <span>{format(new Date(contractStart), 'MMM yyyy')} - {format(new Date(contractEnd), 'MMM yyyy')}</span>
        </div>
      </div>

      {/* Key Metrics - Clean Grid */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Contract Value</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              ${mockClient.agency_value.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">${mockClient.monthly_rate.toLocaleString()}/month</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-500 mb-2">KPI Progress</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {Math.round(kpiProgress)}%
            </div>
            <div className="text-sm text-gray-600">{totalKpiAchieved} of {totalKpiTarget} links</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Hours Usage</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {Math.round(hoursUtilization)}%
            </div>
            <div className="text-sm text-gray-600">{totalHoursUsed.toFixed(0)} of {totalBudgetHours.toFixed(0)} hrs</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Avg Billable Rate</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              ${avgBillableRate ? Math.round(avgBillableRate) : '—'}
            </div>
            <div className="text-sm text-gray-600">per hour billed</div>
          </CardContent>
        </Card>
      </div>

      {/* Contract Details - Horizontal Info Bar */}
      <Card className="mb-8">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-500 mb-0.5">Contract Period</span>
              <span className="font-semibold text-gray-900">{totalSprints} sprints</span>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-500 mb-0.5">Current Sprint</span>
              <span className="font-semibold text-gray-900">Sprint {currentSprintNumber} of {totalSprints}</span>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-500 mb-0.5">Sprint Dates</span>
              <span className="font-semibold text-gray-900">
                {activeSprint ? format(new Date(activeSprint.start_date), 'dd MMM') : '—'} - {activeSprint ? format(new Date(activeSprint.end_date), 'dd MMM yy') : '—'}
              </span>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-500 mb-0.5">Ideal Rate</span>
              <span className="font-semibold text-gray-900">$190/hr</span>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-500 mb-0.5">Monthly Budget</span>
              <span className="font-semibold text-gray-900">{monthlyHours.toFixed(1)} hrs</span>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-500 mb-0.5">Days Remaining</span>
              <span className="font-semibold text-gray-900">{daysRemaining} days</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout - Timeline + Chart */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Contract Timeline */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Contract Timeline</h2>
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-gray-600">Sprint {currentSprintNumber} of {totalSprints}</span>
              <span className="text-sm font-semibold text-gray-900">{daysRemaining} days remaining</span>
            </div>
            
            <div className="space-y-6">
              {/* KPI Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">KPI Achievement</span>
                  <span className={`text-sm font-bold ${kpiProgress >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                    {kpiProgress.toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(kpiProgress, 100)} className="h-3 [&>div]:bg-green-500" />
                <div className="text-xs text-gray-500 mt-1">{totalKpiAchieved} of {totalKpiTarget} links</div>
              </div>

              {/* Hours Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Hours Utilization</span>
                  <span className={`text-sm font-bold ${hoursUtilization > 100 ? 'text-red-600' : hoursUtilization > 80 ? 'text-amber-600' : 'text-green-600'}`}>
                    {hoursUtilization.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={Math.min(hoursProgress, 100)} 
                  className={`h-3 ${hoursUtilization > 100 ? '[&>div]:bg-red-500' : hoursUtilization > 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-blue-500'}`}
                />
                <div className="text-xs text-gray-500 mt-1">{totalHoursUsed.toFixed(0)} of {totalBudgetHours.toFixed(0)} hrs</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Chart */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Performance Trend</h2>
            <SprintPerformanceChart data={sprintChartData} />
          </CardContent>
        </Card>
      </div>

      {/* Sprints Table - Clean, Data-Dense */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Sprint Breakdown</h2>
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
                {sprintCardsData.map((sprint, idx) => {
                  const efficiency = sprint.kpi_target > 0 ? (sprint.kpi_achieved / sprint.kpi_target) * 100 : 0
                  const utilization = sprint.budget_hours > 0 ? (sprint.hours_used / sprint.budget_hours) * 100 : 0
                  const rate = sprint.hours_used > 0 && sprint.monthly_rate ? (sprint.monthly_rate * 3) / sprint.hours_used : 0
                  const isActive = sprint.status === 'active'

                  return (
                    <tr key={sprint.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isActive ? 'bg-blue-50' : ''}`}>
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
        </CardContent>
      </Card>
    </div>
  )
}