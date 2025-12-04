import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientSprintsTab } from '@/components/clients/client-sprints-tab'
import { ClientTimeEntriesTab } from '@/components/clients/client-time-entries-tab'
import { format } from 'date-fns'
import { ArrowLeft, Clock, Calendar, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ id: string }>
}

const regionColors: Record<string, string> = {
  AU: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  US: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  UK: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch client details
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !client) {
    notFound()
  }

  // Fetch sprints for this client
  const { data: sprints } = await supabase
    .from('sprints')
    .select('*')
    .eq('client_id', id)
    .order('start_date', { ascending: false })

  // Fetch recent time entries with user info
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select(`
      *,
      users (
        id,
        name
      )
    `)
    .eq('client_id', id)
    .gte('entry_date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('entry_date', { ascending: false })
    .limit(50)

  // Calculate stats
  const totalHoursLast30Days = timeEntries?.reduce((sum, e) => sum + (e.hours || 0), 0) || 0
  const activeSprints = sprints?.filter(s => s.status === 'active').length || 0
  const totalKpiTarget = sprints?.filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.kpi_target || 0), 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/clients">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {client.name}
            </h2>
            {client.region && (
              <Badge className={regionColors[client.region]}>
                {client.region}
              </Badge>
            )}
            {client.is_active ? (
              <Badge className="bg-green-100 text-green-800" variant="secondary">
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                Inactive
              </Badge>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            {client.group_name || 'No group'} • Added {format(new Date(client.created_at), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Hours (Last 30 Days)</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursLast30Days.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">{timeEntries?.length || 0} entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Sprints</CardTitle>
            <Calendar className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSprints}</div>
            <p className="text-xs text-muted-foreground">{totalKpiTarget} links target</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Sprints</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sprints?.length || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sprints" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sprints">Sprints</TabsTrigger>
          <TabsTrigger value="time-entries">Time Entries</TabsTrigger>
        </TabsList>

        <TabsContent value="sprints">
          <Card>
            <CardHeader>
              <CardTitle>Sprints</CardTitle>
              <CardDescription>Sprint history for this client</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientSprintsTab sprints={sprints || []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time-entries">
          <Card>
            <CardHeader>
              <CardTitle>Recent Time Entries</CardTitle>
              <CardDescription>Last 30 days of time tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientTimeEntriesTab entries={timeEntries || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
