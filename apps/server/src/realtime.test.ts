import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { buildServerWithHub, type ServerContext } from './index.js';
import { setRepo } from './db/repo.js';

describe('T09 - Socket.IO RealtimeHub', () => {
  let ctx: ServerContext;
  let baseUrl: string;
  let overlaySocket: ClientSocket;
  let adminSocket: ClientSocket;

  beforeEach(async () => {
    ctx = await buildServerWithHub({ dbPath: ':memory:', adminPin: '1234' });
    await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    const addr = ctx.app.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 7777;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    overlaySocket?.disconnect();
    adminSocket?.disconnect();
    await ctx.app.close();
    setRepo(null);
  });

  it('connects /overlay and /admin (with PIN), and emits seat:add, fx:wave, fx:leaf on /sim', async () => {
    // Test wrong PIN rejected on /admin
    const badAdmin = Client(`${baseUrl}/admin`, {
      auth: { pin: 'wrong' },
      reconnection: false,
    });
    const connectError = await new Promise<Error>((resolve) => {
      badAdmin.on('connect_error', (err) => resolve(err));
    });
    expect(connectError.message).toContain('INVALID_PIN');
    badAdmin.disconnect();

    // Connect valid overlay and admin clients
    overlaySocket = Client(`${baseUrl}/overlay`, { reconnection: false });
    adminSocket = Client(`${baseUrl}/admin`, {
      auth: { pin: '1234' },
      reconnection: false,
    });

    await Promise.all([
      new Promise<void>((r) => overlaySocket.on('connect', () => r())),
      new Promise<void>((r) => adminSocket.on('connect', () => r())),
    ]);

    const seatAddedPromise = new Promise<{ userId: string }>((r) =>
      overlaySocket.once('seat:add', (data) => r(data)),
    );
    const wavePromise = new Promise<{ userId: string }>((r) =>
      overlaySocket.once('fx:wave', (data) => r(data)),
    );
    const leafPromise = new Promise<{ userId: string }>((r) =>
      overlaySocket.once('fx:leaf', (data) => r(data)),
    );

    await ctx.app.inject({
      method: 'POST',
      url: '/sim',
      payload: { type: 'join', user: 'Minh' },
    });
    const seatAdded = await seatAddedPromise;
    expect(seatAdded.userId).toBe('sim_minh');

    await ctx.app.inject({
      method: 'POST',
      url: '/sim',
      payload: { type: 'chat', user: 'Minh', text: 'Bụt ơi cho con hỏi' },
    });
    const waved = await wavePromise;
    expect(waved.userId).toBe('sim_minh');

    await ctx.app.inject({
      method: 'POST',
      url: '/sim',
      payload: { type: 'chat', user: 'Minh', text: 'ước: kỳ thi tới điểm cao' },
    });
    const leafed = await leafPromise;
    expect(leafed.userId).toBe('sim_minh');
  });
});

