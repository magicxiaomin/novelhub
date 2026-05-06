/** @type {import('next').NextConfig} */
// Keep this allowlist narrow: next/image server-side fetches any host listed here (SSRF/egress risk).
const remotePatterns = [{ protocol: 'https', hostname: 'cdn.novelhub.local' }];

if (process.env.NEXT_PUBLIC_IMAGE_HOST) {
  remotePatterns.push({ protocol: 'https', hostname: process.env.NEXT_PUBLIC_IMAGE_HOST });
}

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns,
  },
};

export default nextConfig;
