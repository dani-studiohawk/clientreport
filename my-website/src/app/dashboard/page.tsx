import { createClient } from '@/lib/supabase/server'
import { formatDistanceToNow } from 'date-fns'

async function getLastSyncTimes() {
  const supabase = await createClient()

  const { data: syncLogs } = await supabase
    .from('sync_logs')
    .select('source, sync_end, status')
    .in('source', ['monday', 'clockify'])
    .order('sync_end', { ascending: false })
    .limit(10) // Get last 10 to ensure we get both sources

  // Find latest successful sync for each source
  const lastMonday = syncLogs?.find(s => s.source === 'monday' && s.status === 'success')
  const lastClockify = syncLogs?.find(s => s.source === 'clockify' && s.status === 'success')

  return { lastMonday, lastClockify }
}

export default async function DashboardPage() {
  const { lastMonday, lastClockify } = await getLastSyncTimes()

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          StudioHawk Client Dashboard
        </h1>

        <div className="text-lg text-gray-600 dark:text-gray-400">
          <p className="mb-2">Last synced:</p>

          {lastMonday && (
            <div className="flex items-center justify-center gap-2">
              <span className="font-medium">Monday.com:</span>
              <span>{formatDistanceToNow(new Date(lastMonday.sync_end), { addSuffix: true })}</span>
            </div>
          )}

          {lastClockify && (
            <div className="flex items-center justify-center gap-2">
              <span className="font-medium">Clockify:</span>
              <span>{formatDistanceToNow(new Date(lastClockify.sync_end), { addSuffix: true })}</span>
            </div>
          )}

          {!lastMonday && !lastClockify && (
            <p className="text-gray-400">No sync data available</p>
          )}
        </div>
      </div>
    </div>
  )
}
