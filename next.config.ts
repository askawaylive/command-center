import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep pages you've visited in the browser for a bit, so going back and forth between
    // them is instant instead of asking the server again. Edits still refresh the page.
    staleTimes: { dynamic: 60, static: 300 },
  },
};

export default nextConfig;
