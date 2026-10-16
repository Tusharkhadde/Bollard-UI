import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Lets several dev servers run side by side (NEXT_DIST_DIR=.next-a npx next dev -p 3101).
  distDir: process.env.NEXT_DIST_DIR || ".next",
}

export default nextConfig
