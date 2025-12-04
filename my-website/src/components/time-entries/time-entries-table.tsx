'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface TimeEntry {
  id: string
  description: string | null
  entry_date: string
  hours: number
  task_category: string | null
  project_name: string | null
  tags: string[] | null
  clients: {
    id: string
    name: string
    region: string | null
  } | null
  users: {
    id: string
    name: string
    email: string
  } | null
}

interface TimeEntriesTableProps {
  entries: TimeEntry[]
}

export function TimeEntriesTable({ entries }: TimeEntriesTableProps) {
  if (entries.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        No time entries found for this period
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Client</TableHead>
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
              <TableCell className="font-medium">
                {entry.clients?.name || 
                  <span className="text-gray-400 italic">No client</span>
                }
              </TableCell>
              <TableCell className="max-w-[300px] truncate">
                {entry.description || entry.task_category || 
                  <span className="text-gray-400 italic">No description</span>
                }
                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {entry.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {entry.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{entry.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
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
    </div>
  )
}
