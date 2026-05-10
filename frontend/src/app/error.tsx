'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center text-center p-6">
      <div>
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
        <p className="text-text-secondary text-sm mb-6 max-w-sm mx-auto">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-xl bg-bg-elevated border border-border-default text-sm font-medium hover:border-border-strong transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
