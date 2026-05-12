import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { DomainError } from '../../common/domain.errors';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { optionalAuth } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import type { WorkerEnv } from '../services/auth-factory';
import { makeDramasService } from '../services/dramas-factory';
import { dramaSlugParamSchema, listDramasQuerySchema } from './dramas.schemas';

const LOCKED_EPISODE_ALLOWED_KEYS = new Set([
  'id',
  'episodeId',
  'dramaId',
  'episodeNumber',
  'title',
  'synopsis',
  'durationSeconds',
  'isFree',
  'publishedAt',
  'isUnlocked',
  'progress',
  'access',
  'accessReason',
  'coinPerEpisode',
]);

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeLockedEpisode = (episode: JsonObject): JsonObject =>
  Object.fromEntries(
    Object.entries(episode).filter(([key]) => LOCKED_EPISODE_ALLOWED_KEYS.has(key)),
  );

const stripLockedEpisodeMediaFields = (value: unknown, lockedContext = false): unknown => {
  if (Array.isArray(value))
    return value.map((item) => stripLockedEpisodeMediaFields(item, lockedContext));
  if (!isJsonObject(value)) return value;

  const shouldStrip = lockedContext || value.isUnlocked === false || value.access === 'denied';
  if (shouldStrip) return sanitizeLockedEpisode(value);

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      stripLockedEpisodeMediaFields(nested, false),
    ]),
  );
};

type Bindings = WorkerEnv;
type Variables = PrismaVariables & Partial<AuthVariables>;

const DRAMA_SCHEMA_UNAVAILABLE_REASON = 'drama_schema_unavailable';

const isDramaSchemaUnavailable = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  const code = 'code' in error ? error.code : undefined;
  if (code === 'P2021' || code === 'P2022') return true;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  return /relation .*dramas.* does not exist|table .*dramas.* does not exist|column .*dramas\./i.test(
    message,
  );
};

export const dramasRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('*', optionalAuth)
  .get('/', zValidator('query', listDramasQuerySchema, validationHook), async (c) => {
    const query = c.req.valid('query');
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const dramas = makeDramasService(c.env, c.get('prisma'));
    try {
      return c.json(stripLockedEpisodeMediaFields(await dramas.list(query)), 200);
    } catch (error) {
      if (!isDramaSchemaUnavailable(error)) throw error;
      return c.json(
        {
          items: [],
          pageInfo: { page, pageSize, total: 0, totalPages: 0 },
          disabled: true,
          reason: DRAMA_SCHEMA_UNAVAILABLE_REASON,
        },
        200,
      );
    }
  })
  .get('/:slug', zValidator('param', dramaSlugParamSchema, validationHook), async (c) => {
    const { slug } = c.req.valid('param');
    const user = c.get('user');
    const dramas = makeDramasService(c.env, c.get('prisma'));
    try {
      return c.json(
        stripLockedEpisodeMediaFields(await dramas.getBySlug(slug, user?.id ?? null)),
        200,
      );
    } catch (error) {
      if (!isDramaSchemaUnavailable(error)) throw error;
      throw new DomainError(404, 'Drama catalog is temporarily unavailable', {
        disabled: true,
        reason: DRAMA_SCHEMA_UNAVAILABLE_REASON,
      });
    }
  });
