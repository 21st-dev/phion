const { withPhionToolbar } = require("phion/plugin-next")

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = withPhionToolbar(nextConfig)
