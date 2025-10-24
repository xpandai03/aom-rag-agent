/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-940ccf6255b54fa799a9b01050e6c227.r2.dev',
      },
    ],
  },
};

module.exports = nextConfig;
