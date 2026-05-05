import { prisma } from '@novelhub/db';

describe('Prisma package runtime import', () => {
  it('exports a Prisma client singleton at runtime', () => {
    expect(typeof prisma.$connect).toBe('function');
  });
});
