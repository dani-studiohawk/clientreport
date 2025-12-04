import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { format, differenceInDays, parseISO } from 'date-fns'
import { 
  Calendar, 
  Target, 
  Clock, 
  DollarSign, 
  User,
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import { SprintHoursChart } from '@/components/sprints/sprint-hours-chart'
import { BackButton } from '@/components/ui/back-button'

interface PageProps {
  params: Promise<{ id: string }>
}

type SprintHealth = 'on-track' | 'at-risk' | 'behind' | 'kpi-complete' | 'completed'

function calculateSprintHealth(
  sprint: { status: string; kpi_achieved: number; kpi_target: number; start_date: string; end_date: string }
): SprintHealth {
  const today = new Date()
  const startDate = new Date(sprint.start_date)
  const endDate = new Date(sprint.end_date)
  
  if (sprint.status === 'completed') return 'completed'
  if (sprint.kpi_achieved >= sprint.kpi_target && sprint.kpi_target > 0) return 'kpi-complete'
  
  const totalDays = differenceInDays(endDate, startDate)
  const daysElapsed = differenceInDays(today, startDate)
  const timeProgress = Math.max(0, Math.min(100, (daysElapsed / totalDays) * 100))
  const kpiProgress = sprint.kpi_target > 0 ? (sprint.kpi_achieved / sprint.kpi_target) * 100 : 100
  
  if (timeProgress >= 80 && kpiProgress < 60) return 'behind'
  if (timeProgress >= 60 && kpiProgress < 40) return 'at-risk'
  if (timeProgress >= 40 && kpiProgress < 20) return 'at-risk'
  
  return 'on-track'
}

const healthConfig: Record<SprintHealth, { label: string; color: string; icon: React.ReactNode }> = {
  'on-track': {
    label: 'On Track',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: <TrendingUp className="h-4 w-4" />,
  },
  'at-risk': {
    label: 'At Risk',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  'behind': {
    label: 'Behind',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  'kpi-complete': {
    label: 'KPI Complete',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  'completed': {
    label: 'Completed',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
}

export default async function SprintDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Get sprint with client info
  const { data: sprint, error } = await supabase
    .from('sprints')
    .select(`
      *,
      clients (
        id,
        name,
        agency_value,
        monthly_rate,
        monthly_hours,
        dpr_lead_id,
        users:dpr_lead_id (
          name,
          email
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !sprint) {
    notFound()
  }

  // Get time entries for this sprint
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select(`
      id,
      entry_date,
      hours,
      description,
      clockify_task_name,
      users:user_id (
        id,
        name
      )
    `)
    .eq('sprint_id', id)
    .order('entry_date', { ascending: true })

  // Calculate totals
  const totalHours = timeEntries?.reduce((sum, e) => sum + (e.hours || 0), 0) || 0
  const budgetHours = (sprint.clients?.monthly_hours || 0) * 3
  
  // Group by task
  const taskBreakdown: Record<string, number> = {}
  timeEntries?.forEach(entry => {
    const task = entry.clockify_task_name || 'Other'
    taskBreakdown[task] = (taskBreakdown[task] || 0) + (entry.hours || 0)
  })
  const taskBreakdownSorted = Object.entries(taskBreakdown)
    .sort((a, b) => b[1] - a[1])

  // Group by user
  const userBreakdown: Record<string, { name: string; hours: number }> = {}
  timeEntries?.forEach(entry => {
    const userId = entry.users?.id || 'unknown'
    const userName = entry.users?.name || 'Unknown'
    if (!userBreakdown[userId]) {
      userBreakdown[userId] = { name: userName, hours: 0 }
    }
    userBreakdown[userId].hours += entry.hours || 0
  })
  const userBreakdownSorted = Object.values(userBreakdown)
    .sort((a, b) => b.hours - a.hours)

  // Group time entries by date for chart
  const hoursByDate: Record<string, number> = {}
  timeEntries?.forEach(entry => {
    const date = entry.entry_date
    hoursByDate[date] = (hoursByDate[date] || 0) + (entry.hours || 0)
  })

  // Calculate metrics
  const today = new Date()
  const startDate = new Date(sprint.start_date)
  const endDate = new Date(sprint.end_date)
  const totalDays = differenceInDays(endDate, startDate)
  const daysElapsed = Math.max(0, differenceInDays(today, startDate))
  const daysRemaining = Math.max(0, differenceInDays(endDate, today))
  
  const kpiProgress = sprint.kpi_target > 0 
    ? (sprint.kpi_achieved / sprint.kpi_target) * 100 
    : 0
  
  const hoursProgress = budgetHours > 0 
    ? (totalHours / budgetHours) * 100 
    : 0

  // Billable rate calculations
  const standardBillableRate = 190 // AUD per hour
  const actualBillableRate = totalHours > 0 
    ? (sprint.monthly_rate || 0) * 3 / totalHours 
    : 0

  const health = calculateSprintHealth(sprint)
  const healthInfo = healthConfig[health]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton />
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {sprint.clients?.name || 'Unknown Client'}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              DPR Lead: {sprint.clients?.users?.name || 'Unassigned'}
            </span>
            <Badge className={`${healthInfo.color} flex items-center gap-1`}>
              {healthInfo.icon}
              {healthInfo.label}
            </Badge>
          </div>
        </div>
        <Link href={`/dashboard/clients/${sprint.clients?.id}`}>
          <Button variant="outline">
            View Client Page
          </Button>
        </Link>
      </div>

      {/* Financial Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financial Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Agency Value</p>
              <p className="text-2xl font-bold">
                ${(sprint.clients?.agency_value || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Rate</p>
              <p className="text-2xl font-bold">
                ${(sprint.monthly_rate || sprint.clients?.monthly_rate || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Billable Rate (Target: ${standardBillableRate}/hr)
              </p>
              <p className={`text-2xl font-bold ${actualBillableRate < standardBillableRate ? 'text-red-600' : 'text-green-600'}`}>
                ${actualBillableRate.toFixed(0)}/hr
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sprint Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Sprint Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sprint Period</p>
              <p className="text-lg font-medium">
                {format(startDate, 'MMMM d, yyyy')} - {format(endDate, 'MMMM d, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sprint Progress</p>
              <p className="text-lg font-medium">
                Day {daysElapsed} of {totalDays} ({daysRemaining} days remaining)
              </p>
              <Progress 
                value={(daysElapsed / totalDays) * 100} 
                className="h-2 mt-2" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  KPI Target
                </span>
                <span className="font-medium">
                  {sprint.kpi_achieved}/{sprint.kpi_target} ({Math.round(kpiProgress)}%)
                </span>
              </div>
              <Progress value={Math.min(kpiProgress, 100)} className="h-3" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Hours Used
                </span>
                <span className="font-medium">
                  {totalHours.toFixed(1)}/{budgetHours.toFixed(1)} hrs ({Math.round(hoursProgress)}%)
                </span>
              </div>
              <Progress 
                value={Math.min(hoursProgress, 100)} 
                className={`h-3 ${hoursProgress > 100 ? '[&>div]:bg-red-500' : ''}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hours Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Hours by Date</CardTitle>
        </CardHeader>
        <CardContent>
          <SprintHoursChart 
            data={Object.entries(hoursByDate).map(([date, hours]) => ({
              date,
              hours,
            }))}
          />
        </CardContent>
      </Card>

      {/* Task Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Time by Task</CardTitle>
          </CardHeader>
          <CardContent>
            {taskBreakdownSorted.length === 0 ? (
              <p className="text-gray-500">No time entries recorded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskBreakdownSorted.map(([task, hours]) => (
                    <TableRow key={task}>
                      <TableCell className="font-medium">{task}</TableCell>
                      <TableCell className="text-right">{hours.toFixed(1)}</TableCell>
                      <TableCell className="text-right">
                        {totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time by Team Member</CardTitle>
          </CardHeader>
          <CardContent>
            {userBreakdownSorted.length === 0 ? (
              <p className="text-gray-500">No time entries recorded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Member</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userBreakdownSorted.map((user) => (
                    <TableRow key={user.name}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-right">{user.hours.toFixed(1)}</TableCell>
                      <TableCell className="text-right">
                        {totalHours > 0 ? Math.round((user.hours / totalHours) * 100) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
