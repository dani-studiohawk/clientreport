import { createClient } from '@/lib/supabase/server'
import { ClientsTable } from '@/components/clients/clients-table'
import { ClientFilters } from '@/components/clients/client-filters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface SearchParams {
  region?: string
  status?: string
  search?: string
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  
  // Build query
  let query = supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true })

  // Apply filters
  if (params.region) {
    query = query.eq('region', params.region)
  }
  if (params.status === 'active') {
    query = query.eq('is_active', true)
  } else if (params.status === 'inactive') {
    query = query.eq('is_active', false)
  }
  if (params.search) {
    query = query.ilike('name', `%${params.search}%`)
  }

  const { data: clients, error } = await query

  if (error) {
    console.error('Error fetching clients:', error)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage and view all client accounts
        </p>
      </div>

      <ClientFilters />

      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>
            {clients?.length || 0} clients found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsTable clients={clients || []} />
        </CardContent>
      </Card>
    </div>
  )
}
