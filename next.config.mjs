/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable strict mode to reduce hydration issues in development
  swcMinify: true,
  experimental: {
    // Enable if you need server components
    // serverComponents: true,
  },
};

export default nextConfig; 