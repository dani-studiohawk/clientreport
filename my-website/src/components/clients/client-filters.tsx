'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'
import { useCallback, useState, useTransition } from 'react'

interface ClientFiltersProps {
  // No props needed - we use fixed status values
}

export function ClientFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const [search, setSearch] = useState(searchParams.get('search') || '')

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

  const handleSearch = () => {
    startTransition(() => {
      const queryString = createQueryString({ search })
      router.push(`/dashboard/clients?${queryString}`)
    })
  }

  const handleRegionChange = (value: string) => {
    startTransition(() => {
      const queryString = createQueryString({ region: value })
      router.push(`/dashboard/clients?${queryString}`)
    })
  }

  const handleStatusChange = (value: string) => {
    startTransition(() => {
      const queryString = createQueryString({ status: value })
      router.push(`/dashboard/clients?${queryString}`)
    })
  }

  const clearFilters = () => {
    setSearch('')
    startTransition(() => {
      router.push('/dashboard/clients')
    })
  }

  const hasFilters = searchParams.toString().length > 0

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-1 gap-2 min-w-[200px]">
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-sm"
        />
        <Button onClick={handleSearch} disabled={isPending} size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <Select
        value={searchParams.get('region') || 'all'}
        onValueChange={handleRegionChange}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions</SelectItem>
          <SelectItem value="AU">Australia</SelectItem>
          <SelectItem value="US">United States</SelectItem>
          <SelectItem value="UK">United Kingdom</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('status') || 'all'}
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" onClick={clearFilters} disabled={isPending}>
          <X className="h-4 w-4 mr-2" />
          Clear
        </Button>
      )}
    </div>
  )
}
