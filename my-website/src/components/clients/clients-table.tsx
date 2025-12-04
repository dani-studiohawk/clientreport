'use client'

import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import type { Client } from '@/types'

interface ClientsTableProps {
  clients: Client[]
}

const regionColors: Record<string, string> = {
  AU: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  US: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  UK: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
}

export function ClientsTable({ clients }: ClientsTableProps) {
  if (clients.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        No clients found
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Region</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Group</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell className="font-medium">
              <Link 
                href={`/dashboard/clients/${client.id}`}
                className="hover:underline"
              >
                {client.name}
              </Link>
            </TableCell>
            <TableCell>
              {client.region && (
                <Badge className={regionColors[client.region] || ''} variant="secondary">
                  {client.region}
                </Badge>
              )}
            </TableCell>
            <TableCell>
              {client.is_active ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" variant="secondary">
                  Active
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400" variant="secondary">
                  Inactive
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-gray-600 dark:text-gray-400">
              {client.group_name || '-'}
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/clients/${client.id}`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
