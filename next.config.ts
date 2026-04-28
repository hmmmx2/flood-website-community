import type { NextConfig } from "next";

/** `output: "standalone"` enables the production Dockerfile (see deploy/docker-compose.yml). */
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
