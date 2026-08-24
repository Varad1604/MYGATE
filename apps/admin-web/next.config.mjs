/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages are consumed as source (ESM/CJS mix).
  transpilePackages: ["@societyos/api-client"],
  // Slim production image: .next/standalone carries a minimal server.
  output: "standalone",

  async rewrites() {
    // Same-origin API proxy: the browser talks only to the admin origin and
    // Next forwards /api + /files to the backend. Removes CORS from the
    // deployment equation entirely. Override the target per environment.
    const apiOrigin = process.env.API_PROXY_ORIGIN ?? "http://localhost:4000";
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/files/:path*", destination: `${apiOrigin}/files/:path*` },
    ];
  },
};

export default nextConfig;
