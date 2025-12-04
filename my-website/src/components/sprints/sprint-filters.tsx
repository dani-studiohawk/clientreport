'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { X, ArrowUpDown } from 'lucide-react'
import { useCallback, useTransition } from 'react'

interface SprintFiltersProps {
  clients: { id: string; name: string }[]
  dprLeads: { id: string; name: string }[]
}

export function SprintFilters({ clients, dprLeads }: SprintFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const createQueryString = useCallback(
    (params: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams.toString())
      
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === '' || value === 'all') {
          newParams.delete(key)
        } else {
          newParams.set(key, value)
        }
      })

      return newParams.toString()
    },
    [searchParams]
  )

  const handleFilterChange = (key: string, value: string) => {
    startTransition(() => {
      const queryString = createQueryString({ [key]: value })
      router.push(`/dashboard/sprints?${queryString}`, { scroll: false })
    })
  }

  // Default activeOnly to true (checked) - only false if explicitly set to 'false'
  const isActiveOnly = searchParams.get('activeOnly') !== 'false'
  
  const handleActiveOnlyChange = (checked: boolean) => {
    startTransition(() => {
      // When checked (true), we don't need the param since it's the default
      // When unchecked (false), we explicitly set it to 'false'
      const queryString = createQueryString({ activeOnly: checked ? null : 'false' })
      router.push(`/dashboard/sprints?${queryString}`, { scroll: false })
    })
  }

  const clearFilters = () => {
    startTransition(() => {
      router.push('/dashboard/sprints', { scroll: false })
    })
  }

  const hasFilters = searchParams.get('health') || 
                     searchParams.get('clientId') || 
                     searchParams.get('dprLeadId') ||
                     searchParams.get('sort') ||
                     searchParams.get('activeOnly') === 'false'

  return (
    <div className="space-y-4">
      {/* Active Only Toggle */}
      <div className="flex items-center space-x-2">
        <Switch
          id="active-only"
          checked={isActiveOnly}
          onCheckedChange={handleActiveOnlyChange}
        />
        <Label htmlFor="active-only">Show active sprints only</Label>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4">
        {/* Health Filter */}
        <Select
          value={searchParams.get('health') || 'all'}
          onValueChange={(value) => handleFilterChange('health', value)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sprint Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Health</SelectItem>
            <SelectItem value="on-track">On Track</SelectItem>
            <SelectItem value="at-risk">At Risk</SelectItem>
            <SelectItem value="behind">Behind</SelectItem>
            <SelectItem value="kpi-complete">KPI Complete</SelectItem>
          </SelectContent>
        </Select>

        {/* DPR Lead Filter */}
        <Select
          value={searchParams.get('dprLeadId') || 'all'}
          onValueChange={(value) => handleFilterChange('dprLeadId', value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="DPR Lead" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All DPR Leads</SelectItem>
            {dprLeads.map((lead) => (
              <SelectItem key={lead.id} value={lead.id}>
                {lead.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Client Filter */}
        <Select
          value={searchParams.get('clientId') || 'all'}
          onValueChange={(value) => handleFilterChange('clientId', value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort Options - default is a-z */}
        <Select
          value={searchParams.get('sort') || 'a-z'}
          onValueChange={(value) => handleFilterChange('sort', value)}
        >
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a-z">A-Z (Client)</SelectItem>
            <SelectItem value="z-a">Z-A (Client)</SelectItem>
            <SelectItem value="ending-soon">Ending Soon</SelectItem>
            <SelectItem value="kpi-progress">KPI Progress</SelectItem>
            <SelectItem value="hours-used">Hours Used</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-10"
            disabled={isPending}
          >
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
