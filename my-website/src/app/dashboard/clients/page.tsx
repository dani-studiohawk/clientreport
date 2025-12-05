import { createClient } from '@/lib/supabase/server'
import { ClientsGrouped } from '@/components/clients/clients-grouped'
import { ClientFilters } from '@/components/clients/client-filters'

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
  
  // Build query with user join for DPR lead name
  let query = supabase
    .from('clients')
    .select(`
      *,
      dpr_lead:users!clients_dpr_lead_id_fkey(name)
    `)
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
          Manage and view all client accounts grouped by status
        </p>
      </div>

      <ClientFilters />

      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {clients?.length || 0} clients found
      </div>

      <ClientsGrouped clients={clients || []} />
    </div>
  )
}
