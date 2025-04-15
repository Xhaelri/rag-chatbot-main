import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// /** @type {import('next').NextConfig} */
// const nextConfig: import("next").NextConfig = {
//   webpack: (config, { isServer }) => {
//     if (isServer) {
//       config.externals.push({
//         puppeteer: "commonjs puppeteer",
//         "puppeteer-core": "commonjs puppeteer-core",
//       });
//     }
//     return config;
//   },
// };

// module.exports = nextConfig;
