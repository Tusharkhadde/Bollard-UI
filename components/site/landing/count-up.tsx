"use client"

import * as React from "react"
import { animate, useReducedMotion } from "motion/react"

/**
 * A number that counts up the first time it scrolls into view. The server renders the
 * real value (crawlers, no-JS and first paint all read it). If the number is already on
 * screen when the page hydrates it stays put, so it never flashes back to zero.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()

  React.useEffect(() => {
    const node = ref.current
    if (!node || reduce || !("IntersectionObserver" in window)) return
    const rect = node.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) return
    const format = (n: number) => Math.round(n).toLocaleString("en-US")
    node.textContent = format(0)
    let stop: (() => void) | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        const controls = animate(0, value, {
          duration: 1.1,
          ease: [0.22, 1, 0.36, 1],
          onUpdate: (latest) => {
            node.textContent = format(latest)
          },
        })
        stop = () => controls.stop()
      },
      { threshold: 0.6 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      stop?.()
      node.textContent = format(value)
    }
  }, [value, reduce])

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("en-US")}
    </span>
  )
}
