/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Handle server-side only modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Ignore warnings for optional Zora dependencies
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/@zoralabs\/coins-sdk/,
      },
      {
        module: /node_modules\/@zoralabs\/protocol-deployments/,
      },
    ];

    return config;
  },
  // External packages for server components
  serverExternalPackages: ['@zoralabs/coins-sdk', '@zoralabs/protocol-deployments'],
};

module.exports = nextConfig;
