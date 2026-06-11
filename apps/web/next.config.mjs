/** @type {import('next').NextConfig} */
const nextConfig = {
  // The workspace packages ship raw TS (main: src/index.ts) — Next must transpile them.
  transpilePackages: ["@ll/core", "@ll/pack-mk", "@ll/pack-schema"],
  // @google-cloud/speech uses dynamic requires / proto files — don't bundle it, require at runtime.
  serverExternalPackages: ["@google-cloud/speech"],
  webpack: (config) => {
    // The packages use ESM-style ".js" extensions in relative imports that point at ".ts" source.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
