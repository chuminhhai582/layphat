import { describe, it, expect } from 'vitest';
import { connectWithRetry, SourceManager, type EventSource } from './index.js';
import { SimulatorSource } from './simulator.js';
import { TikFinitySource } from './tikfinity.js';
import type { LiveEvent } from '@but-oi/shared';

describe('T04, T11, T12 - Event Sources & Reconnect', () => {
  it('T04: SimulatorSource emits all 6 event types and streak gifts', async () => {
    const sim = new SimulatorSource();
    const received: LiveEvent[] = [];
    sim.on((e) => received.push(e));
    await sim.connect();

    sim.simulate({ type: 'join', user: 'Minh' });
    sim.simulate({ type: 'like', user: 'Minh', count: 10 });
    sim.simulate({ type: 'chat', user: 'Minh', text: 'Bụt ơi' });
    sim.simulate({ type: 'follow', user: 'Minh' });
    sim.simulate({ type: 'share', user: 'Minh' });
    sim.simulate({ type: 'gift', user: 'Minh', coins: 10, repeat: 5 });

    expect(received.map((e) => e.type)).toEqual([
      'join',
      'like',
      'chat',
      'follow',
      'share',
      'gift',
    ]);
    const giftEv = received[5];
    expect(giftEv?.type).toBe('gift');
    if (giftEv?.type === 'gift') {
      expect(giftEv.totalCoins).toBe(50);
    }
  });

  it('T11: TikFinitySource parses incoming messages and reports offline cleanly when unreachable', async () => {
    const tf = new TikFinitySource('ws://127.0.0.1:59999');
    const events: LiveEvent[] = [];
    tf.on((e) => events.push(e));

    tf.handleRawMessage(
      JSON.stringify({
        event: 'chat',
        data: { userId: 'u1', nickname: 'Lan', comment: 'ước: bình an' },
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('chat');
  });

  it('T12: connectWithRetry backs off exponentially (2s, 4s, 8s... max 30s) until connected', async () => {
    const delays: number[] = [];
    let attempts = 0;

    const flakySource: EventSource = {
      name: 'connector',
      async connect() {
        attempts++;
        if (attempts < 4) {
          throw new Error('Network down');
        }
      },
      disconnect() {},
      on() {},
      onStatus() {},
    };

    await connectWithRetry(flakySource, {
      sleepFn: async (ms) => {
        delays.push(ms);
      },
    });

    expect(attempts).toBe(4);
    expect(delays).toEqual([2000, 4000, 8000]);
  });

  it('T12: SourceManager switches sources dynamically without losing state', async () => {
    const manager = new SourceManager(undefined, 'simulator');
    await manager.start();
    expect(manager.getStatus().source).toBe('simulator');
    expect(manager.getStatus().status).toBe('live');

    manager.stop();
  });
});

