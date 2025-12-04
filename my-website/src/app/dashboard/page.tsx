import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, Calendar, TrendingUp } from 'lucide-react'

async function getDashboardStats() {
  const supabase = await createClient()
  
  // Get client count
  const { count: clientCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // Get time entries count for this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const { count: timeEntriesCount } = await supabase
    .from('time_entries')
    .select('*', { count: 'exact', head: true })
    .gte('entry_date', startOfMonth.toISOString().split('T')[0])

  // Get total hours this month
  const { data: hoursData } = await supabase
    .from('time_entries')
    .select('hours')
    .gte('entry_date', startOfMonth.toISOString().split('T')[0])

  const totalHours = hoursData?.reduce((sum, entry) => sum + (entry.hours || 0), 0) || 0

  // Get active sprints count
  const { count: activeSprintsCount } = await supabase
    .from('sprints')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  return {
    clientCount: clientCount || 0,
    timeEntriesCount: timeEntriesCount || 0,
    totalHours: Math.round(totalHours * 10) / 10,
    activeSprintsCount: activeSprintsCount || 0,
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  const cards = [
    {
      title: 'Total Clients',
      value: stats.clientCount,
      description: 'Active client accounts',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      title: 'Time Entries',
      value: stats.timeEntriesCount,
      description: 'This month',
      icon: Clock,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      title: 'Hours Logged',
      value: `${stats.totalHours}h`,
      description: 'This month',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    },
    {
      title: 'Active Sprints',
      value: stats.activeSprintsCount,
      description: 'Currently running',
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Overview</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Welcome to your client monitoring dashboard
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {card.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder for charts and tables */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hours by Client</CardTitle>
            <CardDescription>Top clients by hours logged this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center text-gray-400">
              Chart coming soon...
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest time entries and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center text-gray-400">
              Activity feed coming soon...
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
