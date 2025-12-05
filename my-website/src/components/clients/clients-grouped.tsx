'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ExternalLink } from 'lucide-react'
import type { ClientWithDprLead } from '@/types'

interface ClientsGroupedProps {
  clients: ClientWithDprLead[]
}

const regionColors: Record<string, string> = {
  AU: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  US: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  UK: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
}

// Define a consistent order for groups
const groupOrder = [
  'Active Campaigns - AU',
  'Active Campaigns - US',
  'Campaign Starting in Future Dates',
  'Paused Campaigns',
  'Completed Campaigns',
  'Refunded Campaigns',
]

export function ClientsGrouped({ clients }: ClientsGroupedProps) {
  if (clients.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        No clients found
      </div>
    )
  }

  // Group clients by group_name
  const groupedClients = clients.reduce((acc, client) => {
    const group = client.group_name || 'Ungrouped'
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(client)
    return acc
  }, {} as Record<string, ClientWithDprLead[]>)

  // Sort groups according to predefined order
  const sortedGroups = Object.keys(groupedClients).sort((a, b) => {
    const indexA = groupOrder.indexOf(a)
    const indexB = groupOrder.indexOf(b)

    // If both are in the order array, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB
    }
    // If only A is in the order array, it comes first
    if (indexA !== -1) return -1
    // If only B is in the order array, it comes first
    if (indexB !== -1) return 1
    // If neither is in the order array, sort alphabetically
    return a.localeCompare(b)
  })

  return (
    <div className="space-y-6">
      {sortedGroups.map((groupName) => {
        const groupClients = groupedClients[groupName]
        const isActive = groupName.startsWith('Active Campaigns')

        return (
          <Card key={groupName}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {groupName}
                    {isActive && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" variant="secondary">
                        Active
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {groupClients.length} client{groupClients.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>DPR Lead</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupClients.map((client) => (
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
                        {client.dpr_lead?.name || '-'}
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
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
