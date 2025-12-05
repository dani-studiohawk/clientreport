'use client'

import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {error.message}
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
