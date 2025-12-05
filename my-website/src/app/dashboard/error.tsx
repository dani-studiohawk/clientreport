'use client'

import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Failed to load dashboard
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {error.message}
        </p>
        <Button onClick={reset}>Retry</Button>
      </div>
    </div>
  )
}
