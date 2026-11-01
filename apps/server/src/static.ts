import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../..');
const OVERLAY_DIST = path.join(ROOT_DIR, 'apps/overlay/dist');
const ADMIN_DIST = path.join(ROOT_DIR, 'apps/admin/dist');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');

export async function registerStaticHosting(app: FastifyInstance): Promise<void> {
  // Phục vụ thư mục assets (/assets/*) cho overlay
  if (fs.existsSync(ASSETS_DIR)) {
    await app.register(fastifyStatic, {
      root: ASSETS_DIR,
      prefix: '/assets/',
      decorateReply: false,
    });
  }

  // Phục vụ overlay tĩnh tại /overlay
  if (fs.existsSync(OVERLAY_DIST)) {
    await app.register(fastifyStatic, {
      root: OVERLAY_DIST,
      prefix: '/overlay/',
      decorateReply: false,
    });
    app.get('/overlay', async (_req, reply) => {
      return reply.redirect('/overlay/');
    });
  }

  // Phục vụ admin tĩnh tại /admin
  if (fs.existsSync(ADMIN_DIST)) {
    await app.register(fastifyStatic, {
      root: ADMIN_DIST,
      prefix: '/admin/',
      decorateReply: false,
    });
    app.get('/admin', async (_req, reply) => {
      return reply.redirect('/admin/');
    });
  }
}

export function getLanAddresses(port: number): {
  overlayUrl: string;
  adminLanUrls: string[];
} {
  const nets = os.networkInterfaces();
  const ips: string[] = [];

  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const net of list) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  const overlayUrl = `http://localhost:${port}/overlay/`;
  const adminLanUrls =
    ips.length > 0
      ? ips.map((ip) => `http://${ip}:${port}/admin/`)
      : [`http://localhost:${port}/admin/`];

  return { overlayUrl, adminLanUrls };
}

