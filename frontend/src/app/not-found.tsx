import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center text-center p-6">
      <div>
        <div className="text-8xl font-extrabold text-border-strong mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-text-secondary text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-primary text-bg-primary font-bold text-sm hover:bg-accent-primary/90 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
