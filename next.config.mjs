/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Autoriser les requêtes cross-origin en développement
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'ws://localhost:3000',
    'ws://127.0.0.1:3000',
  ],
}

export default nextConfig
