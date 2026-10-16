"use client"

import * as React from "react"

type DemoModule = { Demo: React.ComponentType }

// Each demo is its own chunk: a page only downloads the demos it shows.
const cache = new Map<string, React.LazyExoticComponent<React.ComponentType>>()

function lazyDemo(name: string) {
  let Lazy = cache.get(name)
  if (!Lazy) {
    Lazy = React.lazy(() =>
      (import(`../demos/${name}.tsx`) as Promise<DemoModule>).then((mod) => ({ default: mod.Demo })),
    )
    cache.set(name, Lazy)
  }
  return Lazy
}

class DemoBoundary extends React.Component<{ name: string; children: React.ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    if (this.state.error) return <p className="text-sm text-muted-foreground">This demo failed to load. Reload the page to try again.</p>
    return this.props.children
  }
}

export function DemoPreview({ name }: { name: string }) {
  const Demo = lazyDemo(name)
  return (
    <DemoBoundary name={name}>
      <React.Suspense fallback={<div aria-busy className="h-24 w-full max-w-md animate-pulse rounded-lg bg-muted/60" />}>
        <Demo />
      </React.Suspense>
    </DemoBoundary>
  )
}
