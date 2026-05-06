/** @type {import('next').NextConfig} */
// Keep this allowlist narrow: next/image server-side fetches any host listed here (SSRF/egress risk).
const remotePatterns = [];

if (process.env.NEXT_PUBLIC_IMAGE_HOST) {
  remotePatterns.push({ protocol: 'https', hostname: process.env.NEXT_PUBLIC_IMAGE_HOST });
}

if (process.env.NEXT_PUBLIC_R2_PUBLIC_HOST) {
  remotePatterns.push({ protocol: 'https', hostname: process.env.NEXT_PUBLIC_R2_PUBLIC_HOST });
}

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns,
  },
};

export default nextConfig;
