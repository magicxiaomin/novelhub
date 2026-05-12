import { fileURLToPath } from 'node:url';

import { createSuspense1913ProductionSeed } from './staging-suspense-1913.seed.mjs';

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const result = await createSuspense1913ProductionSeed({ env: process.env, prisma }).run();
    console.log(
      `[suspense-1913 seed] Upserted ${result.dramaSlug}: ${result.episodes} episodes, ${result.videoAssets} video assets, ${result.freeEpisodeCount} free episodes.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
