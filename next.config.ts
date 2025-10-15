/** @type {import('next').NextConfig} */
const nextConfig = {
  // Other top-level config options...
  
  // 👇 Add the option here with its new name
  serverExternalPackages: ['protobufjs'], // Replace with the actual package

  experimental: {
    // Other experimental features (keep them here)
    // ❌ Remove 'serverComponentsExternalPackages' from this section
  },
}

module.exports = nextConfig