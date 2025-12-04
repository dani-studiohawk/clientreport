'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'

interface TimeEntry {
  id: string
  description: string | null
  entry_date: string
  hours: number
  task_category: string | null
  users: {
    id: string
    name: string
  } | null
}

interface ClientTimeEntriesTabProps {
  entries: TimeEntry[]
}

export function ClientTimeEntriesTab({ entries }: ClientTimeEntriesTabProps) {
  if (entries.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        No time entries found for this period
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>User</TableHead>
          <TableHead className="text-right">Hours</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="whitespace-nowrap">
              {format(new Date(entry.entry_date), 'MMM d, yyyy')}
            </TableCell>
            <TableCell className="max-w-[300px] truncate">
              {entry.description || entry.task_category || 
                <span className="text-gray-400 italic">No description</span>
              }
            </TableCell>
            <TableCell>
              {entry.users?.name || '-'}
            </TableCell>
            <TableCell className="text-right font-mono">
              {entry.hours.toFixed(2)}h
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
