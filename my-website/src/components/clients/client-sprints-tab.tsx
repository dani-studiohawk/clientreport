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
import { Progress } from '@/components/ui/progress'
import { format } from 'date-fns'

interface Sprint {
  id: string
  name: string
  sprint_number: number | null
  start_date: string
  end_date: string
  kpi_target: number
  kpi_achieved: number
  status: 'active' | 'completed' | 'cancelled'
}

interface ClientSprintsTabProps {
  sprints: Sprint[]
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
}

export function ClientSprintsTab({ sprints }: ClientSprintsTabProps) {
  if (sprints.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        No sprints found for this client
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sprint</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>KPI Progress</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sprints.map((sprint) => {
          const kpiProgress = sprint.kpi_target > 0 
            ? (sprint.kpi_achieved / sprint.kpi_target) * 100 
            : 0
          
          return (
            <TableRow key={sprint.id}>
              <TableCell className="font-medium">
                {sprint.name}
                {sprint.sprint_number && (
                  <div className="text-xs text-gray-500">
                    Sprint #{sprint.sprint_number}
                  </div>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div>{format(new Date(sprint.start_date), 'MMM d, yyyy')}</div>
                <div className="text-xs text-gray-500">
                  to {format(new Date(sprint.end_date), 'MMM d, yyyy')}
                </div>
              </TableCell>
              <TableCell className="min-w-[150px]">
                <div className="flex items-center gap-2">
                  <Progress 
                    value={Math.min(kpiProgress, 100)} 
                    className="h-2 flex-1"
                  />
                  <span className="text-xs text-gray-600 w-12">
                    {sprint.kpi_achieved}/{sprint.kpi_target}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {kpiProgress.toFixed(0)}% complete
                </div>
              </TableCell>
              <TableCell>
                <Badge className={statusColors[sprint.status]}>
                  {sprint.status.charAt(0).toUpperCase() + sprint.status.slice(1)}
                </Badge>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
