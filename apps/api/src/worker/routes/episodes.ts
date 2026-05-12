import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import type { WorkerEnv } from '../services/auth-factory';
import { makeDramasService } from '../services/dramas-factory';
import { episodeIdParamSchema } from './dramas.schemas';

const PLAYBACK_MEDIA_KEYS = new Set([
  'hlsUrl',
  'playbackUrl',
  'mediaUrl',
  'signedUrl',
  'manifestUrl',
  'segmentUrl',
  'bucket',
  'provider',
]);

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stripPlaybackMediaFields = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripPlaybackMediaFields);
  if (!isJsonObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PLAYBACK_MEDIA_KEYS.has(key))
      .map(([key, nested]) => [key, stripPlaybackMediaFields(nested)]),
  );
};

const sanitizePlaybackResponse = (playback: unknown): unknown => {
  if (!isJsonObject(playback) || playback.access !== 'denied') return playback;
  return stripPlaybackMediaFields(playback);
};

type Bindings = WorkerEnv;
type Variables = PrismaVariables & Partial<AuthVariables>;

export const episodesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('*', optionalAuth)
  .get(
    '/:episodeId/playback',
    zValidator('param', episodeIdParamSchema, validationHook),
    async (c) => {
      const { episodeId } = c.req.valid('param');
      const user = c.get('user');
      const dramas = makeDramasService(c.env, c.get('prisma'));
      return c.json(
        sanitizePlaybackResponse(await dramas.getPlayback(episodeId, user?.id ?? null)),
        200,
      );
    },
  )
  .post(
    '/:episodeId/unlock',
    requireAuth,
    zValidator('param', episodeIdParamSchema, validationHook),
    async (c) => {
      const { episodeId } = c.req.valid('param');
      const user = c.get('user');
      const dramas = makeDramasService(c.env, c.get('prisma'));
      return c.json(await dramas.unlockEpisode(episodeId, user.id), 201);
    },
  );
