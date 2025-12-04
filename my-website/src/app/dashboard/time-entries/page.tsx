import { createClient } from '@/lib/supabase/server'
import { TimeEntriesTable } from '@/components/time-entries/time-entries-table'
import { TimeEntryFilters } from '@/components/time-entries/time-entry-filters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { format, startOfMonth, endOfMonth } from 'date-fns'

interface SearchParams {
  clientId?: string
  startDate?: string
  endDate?: string
  userId?: string
}

export default async function TimeEntriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  
  // Default to current month if no dates specified
  const now = new Date()
  const defaultStartDate = format(startOfMonth(now), 'yyyy-MM-dd')
  const defaultEndDate = format(endOfMonth(now), 'yyyy-MM-dd')
  
  const startDate = params.startDate || defaultStartDate
  const endDate = params.endDate || defaultEndDate

  // Build query - join with clients and users
  let query = supabase
    .from('time_entries')
    .select(`
      *,
      clients (
        id,
        name,
        region
      ),
      users (
        id,
        name,
        email
      )
    `)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: false })
    .limit(500)

  // Apply filters
  if (params.clientId) {
    query = query.eq('client_id', params.clientId)
  }
  if (params.userId) {
    query = query.eq('user_id', params.userId)
  }

  const { data: timeEntries, error } = await query

  if (error) {
    console.error('Error fetching time entries:', error)
  }

  // Get clients for filter dropdown
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  // Get users for filter
  const { data: usersData } = await supabase
    .from('users')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  // Calculate totals
  const totalHours = timeEntries?.reduce((sum, entry) => sum + (entry.hours || 0), 0) || 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Time Entries</h2>
        <p className="text-gray-600 dark:text-gray-400">
          View and filter time tracking data from Clockify
        </p>
      </div>

      <TimeEntryFilters 
        clients={clients || []} 
        users={usersData || []}
        defaultStartDate={startDate}
        defaultEndDate={endDate}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timeEntries?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}h</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
          <CardDescription>
            Showing {timeEntries?.length || 0} entries from {format(new Date(startDate), 'MMM d, yyyy')} to {format(new Date(endDate), 'MMM d, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimeEntriesTable entries={timeEntries || []} />
        </CardContent>
      </Card>
    </div>
  )
}
