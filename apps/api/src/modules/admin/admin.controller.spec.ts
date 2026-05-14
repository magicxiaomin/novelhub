import { GoneException } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

const DRAMA_DEPRECATED_RESPONSE = {
  code: 'DRAMA_DEPRECATED',
  message: 'Short-drama admin endpoints are deprecated during the novels-only pivot.',
} as const;

function expectDramaDeprecated(invoke: () => unknown): void {
  expect(invoke).toThrow(GoneException);

  try {
    invoke();
    throw new Error('Expected drama admin endpoint to throw GoneException');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(GoneException);
    const gone = error as GoneException;
    expect(gone.getStatus()).toBe(410);
    expect(gone.getResponse()).toMatchObject(DRAMA_DEPRECATED_RESPONSE);
  }
}

const service = {
  dashboardSummary: jest.fn(async () => ({
    today: { signups: 1, payingUsers: 1, revenueCents: 999, estimatedRoasCents: 0 },
    weekly: [],
    topBooks: [],
  })),
  listUsers: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 20 })),
  getUser: jest.fn(async () => ({
    id: 'user-id',
    email: 'reader@example.com',
    coinBalance: 0,
    isAdmin: false,
    bannedAt: null,
    createdAt: new Date(),
    purchases: { count: 0, sumCents: 0 },
    unlocks: { count: 0 },
  })),
  banUser: jest.fn(async (id: string) => ({ id })),
  unbanUser: jest.fn(async (id: string) => ({ id })),
  listOrders: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 20 })),
  bulkCreateChapters: jest.fn(async () => ({ created: 1 })),
  coverUploadUrl: jest.fn(async () => ({ uploadUrl: 'https://upload.test', key: 'covers/key' })),
};

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(() => {
    controller = new AdminController(service as unknown as AdminService);
    jest.clearAllMocks();
  });

  it('dashboardSummary: delegates to service', async () => {
    await expect(controller.dashboardSummary()).resolves.toMatchObject({
      today: { signups: 1, revenueCents: 999 },
    });
  });

  it('users: lists and returns detail', async () => {
    await expect(
      controller.listUsers({ search: 'reader', page: 1, limit: 20 }),
    ).resolves.toMatchObject({
      total: 0,
    });
    await expect(controller.getUser('00000000-0000-4000-8000-000000000001')).resolves.toMatchObject(
      {
        email: 'reader@example.com',
      },
    );
  });

  it('ban/unban: delegates to service', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    await expect(controller.banUser(id)).resolves.toEqual({ id });
    await expect(controller.unbanUser(id)).resolves.toEqual({ id });
  });

  it('orders: delegates search filters to service', async () => {
    await expect(
      controller.listOrders({ search: 'cs_', status: 'completed' }),
    ).resolves.toMatchObject({
      total: 0,
    });
    expect(service.listOrders).toHaveBeenCalledWith({ search: 'cs_', status: 'completed' });
  });

  it('bulkCreateChapters: creates parsed chapters', async () => {
    await expect(
      controller.bulkCreateChapters('00000000-0000-4000-8000-000000000001', {
        chapters: [{ title: 'Chapter 1', content: 'Body' }],
      }),
    ).resolves.toEqual({ created: 1 });
  });

  it('coverUploadUrl: returns upload URL and key', async () => {
    await expect(controller.coverUploadUrl({ contentType: 'image/png' })).resolves.toEqual({
      uploadUrl: 'https://upload.test',
      key: 'covers/key',
    });
  });

  it('drama admin endpoints return HTTP 410 DRAMA_DEPRECATED before service access', () => {
    const id = '00000000-0000-4000-8000-000000000001';

    const deprecatedEndpoints: Array<() => unknown> = [
      () => controller.listDramas({}),
      () => controller.getDrama(id),
      () => controller.createDrama({ title: 'Drama', slug: 'drama' } as never),
      () => controller.updateDrama(id, { title: 'Drama' }),
      () => controller.softDeleteDrama(id),
      () => controller.publishDrama(id),
      () => controller.unpublishDrama(id),
    ];

    for (const endpoint of deprecatedEndpoints) {
      expectDramaDeprecated(endpoint);
    }

    expect(service.dashboardSummary).not.toHaveBeenCalled();
  });

  it('episode admin endpoints return HTTP 410 DRAMA_DEPRECATED before service access', () => {
    const id = '00000000-0000-4000-8000-000000000001';

    const deprecatedEndpoints: Array<() => unknown> = [
      () => controller.listEpisodes({}),
      () => controller.getEpisode(id),
      () => controller.createEpisode({ dramaId: id, title: 'Episode 1', episodeNumber: 1 }),
      () => controller.updateEpisode(id, { title: 'Episode 1' }),
      () => controller.softDeleteEpisode(id),
      () => controller.publishEpisode(id),
      () => controller.unpublishEpisode(id),
    ];

    for (const endpoint of deprecatedEndpoints) {
      expectDramaDeprecated(endpoint);
    }

    expect(service.dashboardSummary).not.toHaveBeenCalled();
  });
});
