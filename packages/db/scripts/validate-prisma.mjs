import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

process.env.DATABASE_URL ??= 'postgresql://novelhub:novelhub@localhost:5432/novelhub';

const prismaBin = resolve(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.CMD' : 'prisma',
);

const result = spawnSync(prismaBin, ['validate', '--schema', 'prisma/schema.prisma'], {
  env: process.env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
