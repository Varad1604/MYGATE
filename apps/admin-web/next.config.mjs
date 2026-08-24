/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages are consumed as source (ESM/CJS mix).
  transpilePackages: ["@societyos/api-client"],
};

export default nextConfig;
