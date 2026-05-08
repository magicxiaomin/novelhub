/**
 * Hono /admin routes — mirror apps/api/src/modules/admin/admin.controller.ts.
 *
 * All routes require an admin user (cookie JWT + isAdmin flag). The
 * `requireAdmin` middleware does both auth + admin-flag check and throws
 * 401/403 via DomainError on failure, which app.onError renders as the
 * standard envelope.
 *
 * `POST /books/:id/chapters` reads multipart/form-data via
 * `c.req.formData()`. The plan calls for a 200 KB chapters file upload
 * smoke; the FormData API returns the file as a Blob whose `arrayBuffer()`
 * gives the raw bytes the service consumes (Uint8Array). MAX_UPLOAD_BYTES
 * mirrors the Nest 10 MB cap so a misconfigured client can't pin the
 * Worker on a huge upload.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { DomainError } from '../../common/domain.errors';
import type { PrismaVariables } from '../db/prisma';
import { requireAdmin, type AuthVariables } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import { makeAdminService, type AdminWorkerEnv } from '../services/admin-factory';
import {
  adminChapterListQuerySchema,
  adminOrderListQuerySchema,
  adminSearchQuerySchema,
  bulkCreateChaptersBodySchema,
  bulkImportOptionsQuerySchema,
  coverUploadUrlBodySchema,
  createBookBodySchema,
  updateBookBodySchema,
  updateChapterBodySchema,
  uuidParam,
} from './admin.schemas';

type Bindings = AdminWorkerEnv;
type Variables = PrismaVariables & AuthVariables;

const idParamSchema = z.object({ id: uuidParam });

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('*', requireAdmin)

  // Dashboard
  .get('/dashboard/summary', async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.dashboardSummary(), 200);
  })

  // Books
  .get('/books', zValidator('query', adminSearchQuerySchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.listBooks(c.req.valid('query')), 200);
  })
  .get('/books/:id', zValidator('param', idParamSchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.getBook(c.req.valid('param').id), 200);
  })
  .post('/books', zValidator('json', createBookBodySchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.createBook(c.req.valid('json')), 201);
  })
  .put(
    '/books/:id',
    zValidator('param', idParamSchema, validationHook),
    zValidator('json', updateBookBodySchema, validationHook),
    async (c) => {
      const admin = makeAdminService(c.env, c.get('prisma'));
      return c.json(await admin.updateBook(c.req.valid('param').id, c.req.valid('json')), 200);
    },
  )
  .delete('/books/:id', zValidator('param', idParamSchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.softDeleteBook(c.req.valid('param').id), 200);
  })

  // Bulk chapter import (multipart upload)
  .post(
    '/books/:id/chapters',
    zValidator('param', idParamSchema, validationHook),
    zValidator('query', bulkImportOptionsQuerySchema, validationHook),
    async (c) => {
      const { id } = c.req.valid('param');
      const options = c.req.valid('query');

      // c.req.formData() parses the multipart body once. We pull the `file`
      // field, validate size, and pass the raw bytes to the service.
      const form = await c.req.formData();
      const fileField = form.get('file');
      if (!fileField || typeof fileField === 'string') {
        throw DomainError.badRequest('File is required');
      }
      const file = fileField as Blob;
      if (file.size > MAX_UPLOAD_BYTES) {
        throw DomainError.badRequest(`File exceeds ${MAX_UPLOAD_BYTES} bytes (got ${file.size})`);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());

      // Form-form options can override the query-form (admins POST as
      // multipart and may include delimiter / replace alongside the file).
      const delimiterField = form.get('delimiter');
      const replaceField = form.get('replace');
      const merged = {
        delimiter: typeof delimiterField === 'string' ? delimiterField : options.delimiter,
        replace: typeof replaceField === 'string' ? replaceField === 'true' : options.replace,
      };

      const admin = makeAdminService(c.env, c.get('prisma'));
      return c.json(await admin.bulkImportChapters(id, bytes, merged), 201);
    },
  )

  // Bulk-create chapters from JSON
  .post(
    '/books/:id/chapters/bulk',
    zValidator('param', idParamSchema, validationHook),
    zValidator('json', bulkCreateChaptersBodySchema, validationHook),
    async (c) => {
      const { id } = c.req.valid('param');
      const { chapters } = c.req.valid('json');
      const admin = makeAdminService(c.env, c.get('prisma'));
      return c.json(await admin.bulkCreateChapters(id, chapters), 201);
    },
  )

  // Chapters
  .get('/chapters', zValidator('query', adminChapterListQuerySchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.listChapters(c.req.valid('query')), 200);
  })
  .get('/chapters/:id', zValidator('param', idParamSchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.getChapter(c.req.valid('param').id), 200);
  })
  .put(
    '/chapters/:id',
    zValidator('param', idParamSchema, validationHook),
    zValidator('json', updateChapterBodySchema, validationHook),
    async (c) => {
      const admin = makeAdminService(c.env, c.get('prisma'));
      return c.json(await admin.updateChapter(c.req.valid('param').id, c.req.valid('json')), 200);
    },
  )
  .delete('/chapters/:id', zValidator('param', idParamSchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.softDeleteChapter(c.req.valid('param').id), 200);
  })

  // Users
  .get('/users', zValidator('query', adminSearchQuerySchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.listUsers(c.req.valid('query')), 200);
  })
  .get('/users/:id', zValidator('param', idParamSchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.getUser(c.req.valid('param').id), 200);
  })
  .post('/users/:id/ban', zValidator('param', idParamSchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.banUser(c.req.valid('param').id), 200);
  })
  .post('/users/:id/unban', zValidator('param', idParamSchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.unbanUser(c.req.valid('param').id), 200);
  })

  // Orders
  .get('/orders', zValidator('query', adminOrderListQuerySchema, validationHook), async (c) => {
    const admin = makeAdminService(c.env, c.get('prisma'));
    return c.json(await admin.listOrders(c.req.valid('query')), 200);
  })

  // Uploads
  .post(
    '/uploads/cover-url',
    zValidator('json', coverUploadUrlBodySchema, validationHook),
    async (c) => {
      const admin = makeAdminService(c.env, c.get('prisma'));
      return c.json(await admin.coverUploadUrl(c.req.valid('json').contentType), 201);
    },
  );
