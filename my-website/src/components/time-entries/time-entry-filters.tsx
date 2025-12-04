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
import { Calendar, X } from 'lucide-react'
import { useCallback, useState, useTransition } from 'react'

interface TimeEntryFiltersProps {
  clients: { id: string; name: string }[]
  users: { id: string; name: string }[]
  defaultStartDate: string
  defaultEndDate: string
}

export function TimeEntryFilters({ 
  clients, 
  users,
  defaultStartDate,
  defaultEndDate 
}: TimeEntryFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || defaultStartDate)
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || defaultEndDate)

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

  const handleDateChange = () => {
    startTransition(() => {
      const queryString = createQueryString({ startDate, endDate })
      router.push(`/dashboard/time-entries?${queryString}`)
    })
  }

  const handleClientChange = (value: string) => {
    startTransition(() => {
      const queryString = createQueryString({ clientId: value })
      router.push(`/dashboard/time-entries?${queryString}`)
    })
  }

  const handleUserChange = (value: string) => {
    startTransition(() => {
      const queryString = createQueryString({ userId: value })
      router.push(`/dashboard/time-entries?${queryString}`)
    })
  }

  const clearFilters = () => {
    setStartDate(defaultStartDate)
    setEndDate(defaultEndDate)
    startTransition(() => {
      router.push('/dashboard/time-entries')
    })
  }

  const hasFilters = searchParams.get('clientId') || searchParams.get('userId') || 
    searchParams.get('startDate') || searchParams.get('endDate')

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="flex gap-2 items-end">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            Start Date
          </label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            End Date
          </label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <Button onClick={handleDateChange} disabled={isPending} size="icon">
          <Calendar className="h-4 w-4" />
        </Button>
      </div>

      <Select
        value={searchParams.get('clientId') || 'all'}
        onValueChange={handleClientChange}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Client" />
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

      <Select
        value={searchParams.get('userId') || 'all'}
        onValueChange={handleUserChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="User" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Users</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}
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
