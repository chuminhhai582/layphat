import React, { useState } from 'react';
import { STRINGS_VI } from '@but-oi/shared';
import { apiFetch } from '../lib/api.js';

type SimulatorPageProps = {
  pin: string;
};

export function SimulatorPage({ pin }: SimulatorPageProps): React.ReactElement {
  const [viewerName, setViewerName] = useState('');
  const [lastAction, setLastAction] = useState('');

  const fireSim = async (body: Record<string, unknown>, label: string) => {
    await apiFetch('/sim', pin, {
      method: 'POST',
      body: JSON.stringify({
        ...body,
        ...(viewerName.trim() ? { user: viewerName.trim() } : {}),
      }),
    });
    setLastAction(`Đã phát: ${label}`);
  };

  const fireBurst = async (
    kind: 'gifts' | 'joins',
    n: number,
    seconds: number,
    label: string,
  ) => {
    await apiFetch('/sim/burst', pin, {
      method: 'POST',
      body: JSON.stringify({ kind, n, seconds }),
    });
    setLastAction(`Đã kích hoạt: ${label}`);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">
          {STRINGS_VI.ADMIN.SIM_TITLE}
        </h2>

        <input
          type="text"
          value={viewerName}
          onChange={(e) => setViewerName(e.target.value)}
          placeholder={STRINGS_VI.ADMIN.SIM_VIEWER_NAME_PLACEHOLDER}
          className="mt-3 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        {lastAction && (
          <p className="mt-2 text-xs font-semibold text-emerald-700">{lastAction}</p>
        )}

        {/* Sự kiện tương tác cơ bản */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void fireSim({ type: 'join' }, STRINGS_VI.ADMIN.SIM_JOIN)}
            className="min-h-[44px] rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            {STRINGS_VI.ADMIN.SIM_JOIN}
          </button>
          <button
            type="button"
            onClick={() =>
              void fireSim({ type: 'like', count: 5 }, STRINGS_VI.ADMIN.SIM_LIKE)
            }
            className="min-h-[44px] rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            {STRINGS_VI.ADMIN.SIM_LIKE}
          </button>
          <button
            type="button"
            onClick={() =>
              void fireSim(
                { type: 'chat', text: 'Bụt ơi' },
                STRINGS_VI.ADMIN.SIM_CALL_BUD,
              )
            }
            className="min-h-[44px] rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            {STRINGS_VI.ADMIN.SIM_CALL_BUD}
          </button>
          <button
            type="button"
            onClick={() =>
              void fireSim({ type: 'follow' }, STRINGS_VI.ADMIN.SIM_FOLLOW)
            }
            className="min-h-[44px] rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            {STRINGS_VI.ADMIN.SIM_FOLLOW}
          </button>
          <button
            type="button"
            onClick={() =>
              void fireSim({ type: 'share' }, STRINGS_VI.ADMIN.SIM_SHARE)
            }
            className="min-h-[44px] rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            {STRINGS_VI.ADMIN.SIM_SHARE}
          </button>
          <button
            type="button"
            onClick={() =>
              void fireSim(
                {
                  type: 'chat',
                  text: 'ước: kỳ thi sắp tới làm bài thật bình tĩnh và đạt điểm cao',
                },
                STRINGS_VI.ADMIN.SIM_GOOD_WISH,
              )
            }
            className="min-h-[44px] rounded-lg bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-900"
          >
            {STRINGS_VI.ADMIN.SIM_GOOD_WISH}
          </button>
          <button
            type="button"
            onClick={() =>
              void fireSim(
                {
                  type: 'chat',
                  text: 'ước: cho con xin số đề chiều nay trúng đậm',
                },
                STRINGS_VI.ADMIN.SIM_BAD_WISH,
              )
            }
            className="col-span-2 min-h-[44px] rounded-lg bg-rose-100 px-3 py-2 text-sm font-bold text-rose-900"
          >
            {STRINGS_VI.ADMIN.SIM_BAD_WISH}
          </button>
        </div>

        {/* Quà từng bậc */}
        <h3 className="mt-4 text-sm font-bold text-slate-700">Quà từng bậc</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              void fireSim(
                { type: 'gift', coins: 5 },
                STRINGS_VI.TIER_LABELS.firefly,
              )
            }
            className="min-h-[44px] rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white"
          >
            {STRINGS_VI.TIER_LABELS.firefly} (5 xu)
          </button>
          <button
            type="button"
            onClick={() =>
              void fireSim(
                { type: 'gift', coins: 50 },
                STRINGS_VI.TIER_LABELS.visit,
              )
            }
            className="min-h-[44px] rounded-lg bg-teal-800 px-3 py-2 text-sm font-bold text-white"
          >
            {STRINGS_VI.TIER_LABELS.visit} (50 xu)
          </button>
          <button
            type="button"
            onClick={() =>
              void fireSim(
                { type: 'gift', coins: 500 },
                STRINGS_VI.TIER_LABELS.miracle,
              )
            }
            className="min-h-[44px] rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white"
          >
            {STRINGS_VI.TIER_LABELS.miracle} (500 xu)
          </button>
          <button
            type="button"
            onClick={() =>
              void fireSim(
                { type: 'gift', coins: 3000 },
                STRINGS_VI.TIER_LABELS.grand,
              )
            }
            className="min-h-[44px] rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold text-white"
          >
            {STRINGS_VI.TIER_LABELS.grand} (3000 xu)
          </button>
          <button
            type="button"
            onClick={() =>
              void fireSim(
                { type: 'gift', coins: 20, repeat: 20 },
                'Combo 20 quà chuỗi',
              )
            }
            className="col-span-2 min-h-[44px] rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white"
          >
            Combo dài (1 người 20 quà chuỗi)
          </button>
        </div>

        {/* Mưa quà & Mưa người vào */}
        <h3 className="mt-4 text-sm font-bold text-slate-700">Kịch bản tải cao</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              void fireBurst(
                'gifts',
                50,
                10,
                STRINGS_VI.ADMIN.SIM_BURST_GIFTS,
              )
            }
            className="min-h-[48px] rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-amber-300"
          >
            {STRINGS_VI.ADMIN.SIM_BURST_GIFTS}
          </button>
          <button
            type="button"
            onClick={() =>
              void fireBurst(
                'joins',
                100,
                5,
                STRINGS_VI.ADMIN.SIM_BURST_JOINS,
              )
            }
            className="min-h-[48px] rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-amber-300"
          >
            {STRINGS_VI.ADMIN.SIM_BURST_JOINS}
          </button>
        </div>
      </section>
    </div>
  );
}

