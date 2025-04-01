/** @type {import('next').NextConfig} */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const nextConfig = {
  reactStrictMode: true,
  optimizeFonts: false,
  basePath: BASE_PATH,
  compiler: {
    removeConsole: false
  }
};

export default nextConfig;
