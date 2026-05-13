import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { DomainError } from '../../common/domain.errors';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import type { WorkerEnv } from '../services/auth-factory';
import { makeDramasService } from '../services/dramas-factory';
import {
  isDramaProcessValidationFallbackEnabled,
  makeSuspenseFallbackPlayback,
} from './drama-process-validation-fallback';
import { episodeIdParamSchema } from './dramas.schemas';

const DENIED_PLAYBACK_ALLOWED_KEYS = new Set([
  'episodeId',
  'dramaId',
  'episodeNumber',
  'title',
  'durationSeconds',
  'access',
  'accessReason',
  'coinPerEpisode',
  'processValidationFallback',
  'reason',
]);

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const allowDeniedPlaybackFields = (playback: JsonObject): JsonObject =>
  Object.fromEntries(
    Object.entries(playback).filter(([key]) => DENIED_PLAYBACK_ALLOWED_KEYS.has(key)),
  );

const sanitizePlaybackResponse = (playback: unknown): unknown => {
  if (!isJsonObject(playback) || playback.access === 'granted') return playback;
  return allowDeniedPlaybackFields(playback);
};

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
      try {
        return c.json(
          sanitizePlaybackResponse(await dramas.getPlayback(episodeId, user?.id ?? null)),
          200,
        );
      } catch (error) {
        if (!isDramaSchemaUnavailable(error)) throw error;
        if (isDramaProcessValidationFallbackEnabled(c.env)) {
          const fallback = makeSuspenseFallbackPlayback(episodeId);
          if (fallback) return c.json(sanitizePlaybackResponse(fallback), 200);
        }
        throw new DomainError(404, 'Drama catalog is temporarily unavailable', {
          disabled: true,
          reason: DRAMA_SCHEMA_UNAVAILABLE_REASON,
        });
      }
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
