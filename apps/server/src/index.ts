import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { fileURLToPath } from 'node:url';
import type { AdminManualPayload, Settings, SourceName } from '@but-oi/shared';
import { getSettings, updateSettings, validateEnv } from './config.js';
import { getRepo, type NewBlessingInput, type Repo } from './db/repo.js';
import { seedDatabase } from './scripts/seed.js';
import { registerSimRoutes } from './sources/simulator.js';
import { registerVoiceRoutes } from './voice/cache.js';
import { defaultVoiceService } from './voice/index.js';
import { RealtimeHub } from './realtime.js';
import { getLanAddresses, registerStaticHosting } from './static.js';
import { DataRetentionManager } from './core/retention.js';

export type ServerContext = {
  app: FastifyInstance;
  hub: RealtimeHub;
  repo: Repo;
  retention: DataRetentionManager;
};

export async function buildServerWithHub(opts?: {
  dbPath?: string;
  adminPin?: string;
}): Promise<ServerContext> {
  const repo = getRepo(opts?.dbPath);
  if (repo.listBlessings().length === 0) {
    seedDatabase(opts?.dbPath);
  }

  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  await app.register(cors, { origin: true });
  await registerStaticHosting(app);

  const hub = new RealtimeHub({
    app,
    repo,
    adminPin: opts?.adminPin,
  });

  const retention = new DataRetentionManager({
    repo,
    voice: defaultVoiceService,
  });

  app.get('/health', async () => {
    return { ok: true };
  });

  registerSimRoutes(app, hub.sources.getSimulator());
  registerVoiceRoutes(app, defaultVoiceService.cache);

  // Middleware kiểm tra PIN cho các route /api/admin/*
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/api/admin')) {
      const headerPin = String(req.headers['x-admin-pin'] ?? '');
      if (!hub.checkPin(headerPin)) {
        return reply.code(401).send({ error: 'INVALID_PIN' });
      }
    }
  });

  // Admin REST APIs (cho T31-T34)
  app.get('/api/admin/state', async () => {
    return hub.getAdminState();
  });

  app.post<{ Body: AdminManualPayload }>('/api/admin/manual', async (req) => {
    hub.triggerManualVisit(req.body);
    return { ok: true };
  });

  app.post<{ Body: { source: SourceName } }>('/api/admin/source', async (req) => {
    const status = await hub.sources.switchSource(req.body.source);
    hub.broadcastAdminState();
    return { ok: true, status };
  });

  app.get('/api/admin/blessings', async () => {
    return { blessings: repo.listBlessings() };
  });

  app.post<{ Body: NewBlessingInput }>('/api/admin/blessings', async (req) => {
    const created = repo.upsertBlessing(req.body);
    return { ok: true, blessing: created };
  });

  app.put<{
    Params: { id: string };
    Body: Partial<NewBlessingInput & { active: number | boolean }>;
  }>('/api/admin/blessings/:id', async (req, reply) => {
    const updated = repo.updateBlessing(Number(req.params.id), req.body);
    if (!updated) return reply.code(404).send({ error: 'Not found' });
    return { ok: true, blessing: updated };
  });

  app.post<{ Params: { id: string } }>(
    '/api/admin/blessings/:id/voice',
    async (req, reply) => {
      const b = repo.getBlessingById(Number(req.params.id));
      if (!b) return reply.code(404).send({ error: 'Not found' });
      const rendered = await defaultVoiceService.render(b.text);
      const updated = repo.updateBlessing(b.id, { audio_path: rendered.url });
      return {
        ok: true,
        blessing: updated,
        audioUrl: rendered.url,
        durationMs: rendered.durationMs,
      };
    },
  );

  app.get('/api/admin/banned-words', async () => {
    return { words: repo.listBannedWords() };
  });

  app.post<{ Body: { words: string[] | string } }>(
    '/api/admin/banned-words',
    async (req) => {
      const raw = req.body.words;
      const list = Array.isArray(raw)
        ? raw
        : String(raw ?? '')
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean);
      const added = repo.addBannedWordsBulk(list);
      return { ok: true, added, words: repo.listBannedWords() };
    },
  );

  app.delete<{ Params: { word: string } }>(
    '/api/admin/banned-words/:word',
    async (req) => {
      const removed = repo.removeBannedWord(decodeURIComponent(req.params.word));
      return { ok: true, removed, words: repo.listBannedWords() };
    },
  );

  app.get('/api/admin/settings', async () => {
    return { settings: getSettings() };
  });

  app.put<{ Body: Partial<Settings> }>('/api/admin/settings', async (req) => {
    const updated = updateSettings(req.body);
    hub.io.of('/overlay').emit('settings:update', updated);
    hub.broadcastAdminState();
    return { ok: true, settings: updated };
  });

  app.addHook('onClose', async () => {
    retention.stop();
    await hub.close();
  });

  return { app, hub, repo, retention };
}

export async function buildServer(): Promise<FastifyInstance> {
  const ctx = await buildServerWithHub({ dbPath: ':memory:' });
  return ctx.app;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const env = validateEnv(process.env, true);
  buildServerWithHub({ adminPin: env.ADMIN_PIN })
    .then(async ({ app, hub, retention }) => {
      await app.listen({ port: env.PORT, host: '0.0.0.0' });
      retention.start();
      hub.groupScheduler.start();
      void hub.sources.start();

      const urls = getLanAddresses(env.PORT);
      console.log('====================================================');
      console.log(' BỤT ƠI LIVE — SERVER ĐÃ KHỞI ĐỘNG');
      console.log(` • Overlay (dán vào OBS/LIVE Studio): ${urls.overlayUrl}`);
      for (const lanUrl of urls.adminLanUrls) {
        console.log(` • Admin (mở trên điện thoại cùng Wi-Fi): ${lanUrl}`);
      }
      console.log('====================================================');
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
