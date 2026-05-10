/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['auth.privy.io'],
  },
}

module.exports = nextConfig
