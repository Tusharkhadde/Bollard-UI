"use client"

import * as React from "react"

/**
 * Mounts its children only once the placeholder scrolls within `margin` of the
 * viewport, so a section's JavaScript (and the live components inside it) stay
 * off the critical path. Pair it with React.lazy children for a real split.
 */
export function Deferred({
  children,
  fallback,
  margin = "600px 0px",
  className,
}: {
  children: React.ReactNode
  fallback: React.ReactNode
  margin?: string
  className?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [near, setNear] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    if (!("IntersectionObserver" in window)) return setNear(true)
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: margin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [margin])

  return (
    <div ref={ref} className={className}>
      {near ? (
        <DemoBoundary>
          <React.Suspense fallback={fallback}>{children}</React.Suspense>
        </DemoBoundary>
      ) : (
        fallback
      )}
    </div>
  )
}

class DemoBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    if (this.state.error) return <p className="text-sm text-muted-foreground">This demo failed to load. Reload the page to try again.</p>
    return this.props.children
  }
}
