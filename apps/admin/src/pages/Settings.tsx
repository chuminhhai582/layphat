import React, { useState } from 'react';
import { STRINGS_VI, type Settings } from '@but-oi/shared';

type SettingsPageProps = {
  settings: Settings;
  onSave: (partial: Partial<Settings>) => Promise<void>;
};

export function SettingsPage({
  settings,
  onSave,
}: SettingsPageProps): React.ReactElement {
  const [local, setLocal] = useState<Settings>(() => structuredClone(settings));
  const [savedMsg, setSavedMsg] = useState(false);

  const handleTierChange = (
    idx: number,
    field: 'minCoins' | 'durationMs',
    value: number,
  ) => {
    const nextTiers = local.tiers.map((t, i) =>
      i === idx ? { ...t, [field]: Math.max(1, value) } : t,
    );
    setLocal({ ...local, tiers: nextTiers });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(local);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const vols = local.volumes ?? { bgm: 0.35, sfx: 0.8, voice: 1.0 };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-bold text-slate-800">
        {STRINGS_VI.ADMIN.SETTINGS_TITLE}
      </h2>

      {/* Ngưỡng xu và thời lượng từng bậc */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-700">Ngưỡng xu & Thời lượng (ms)</h3>
        {local.tiers.map((t, idx) => (
          <div
            key={t.id}
            className="grid grid-cols-3 items-center gap-2 rounded-lg bg-slate-50 p-2"
          >
            <span className="text-sm font-semibold text-slate-800">
              {STRINGS_VI.TIER_LABELS[t.id]}
            </span>
            <input
              type="number"
              min={1}
              value={t.minCoins}
              onChange={(e) =>
                handleTierChange(idx, 'minCoins', Number(e.target.value))
              }
              className="min-h-[44px] rounded border border-slate-300 px-2 text-sm"
            />
            <input
              type="number"
              min={1000}
              step={500}
              value={t.durationMs}
              onChange={(e) =>
                handleTierChange(idx, 'durationMs', Number(e.target.value))
              }
              className="min-h-[44px] rounded border border-slate-300 px-2 text-sm"
            />
          </div>
        ))}
      </div>

      {/* giftGraceMs */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-700">Độ trễ nhường hiệu ứng quà TikTok (giftGraceMs)</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['visit', 'miracle', 'grand'] as const).map((k) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-slate-600">
                {STRINGS_VI.TIER_LABELS[k]}
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={local.giftGraceMs[k]}
                onChange={(e) =>
                  setLocal({
                    ...local,
                    giftGraceMs: {
                      ...local.giftGraceMs,
                      [k]: Number(e.target.value),
                    },
                  })
                }
                className="mt-1 min-h-[44px] w-full rounded border border-slate-300 px-2 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Số chỗ ngồi & Chu kỳ Bụt ghé làng */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700">
            Số chỗ ngồi dân làng
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={local.seatCount}
            onChange={(e) =>
              setLocal({ ...local, seatCount: Number(e.target.value) })
            }
            className="mt-1 min-h-[44px] w-full rounded border border-slate-300 px-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700">
            Chu kỳ ghé làng (ms)
          </label>
          <input
            type="number"
            min={10000}
            step={10000}
            value={local.groupVisitEveryMs}
            onChange={(e) =>
              setLocal({ ...local, groupVisitEveryMs: Number(e.target.value) })
            }
            className="mt-1 min-h-[44px] w-full rounded border border-slate-300 px-2 text-sm"
          />
        </div>
      </div>

      {/* Âm lượng 3 kênh */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-700">Âm lượng 3 kênh (0.0 – 1.0)</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['bgm', 'sfx', 'voice'] as const).map((ch) => (
            <div key={ch}>
              <label className="block text-xs font-semibold uppercase text-slate-600">
                {ch} ({Math.round(vols[ch] * 100)}%)
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={vols[ch]}
                onChange={(e) =>
                  setLocal({
                    ...local,
                    volumes: { ...vols, [ch]: Number(e.target.value) },
                  })
                }
                className="mt-2 h-6 w-full"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Giọng đọc & Khung webcam */}
      <div className="grid grid-cols-2 items-center gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700">
            Mã giọng đọc (TTS Voice)
          </label>
          <input
            type="text"
            value={local.ttsVoice ?? 'banmai'}
            onChange={(e) => setLocal({ ...local, ttsVoice: e.target.value })}
            className="mt-1 min-h-[44px] w-full rounded border border-slate-300 px-2 text-sm"
          />
        </div>
        <div className="pt-4">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-bold text-slate-800">
            <input
              type="checkbox"
              checked={Boolean(local.webcamEnabled)}
              onChange={(e) =>
                setLocal({ ...local, webcamEnabled: e.target.checked })
              }
              className="h-5 w-5"
            />
            Bật khung Webcam (Ø260)
          </label>
        </div>
      </div>

      <button
        type="submit"
        className="min-h-[48px] w-full rounded-lg bg-amber-600 px-4 py-3 text-base font-bold text-white hover:bg-amber-700"
      >
        {STRINGS_VI.ADMIN.SETTINGS_SAVE}
      </button>

      {savedMsg && (
        <p className="text-center text-sm font-bold text-emerald-600">
          {STRINGS_VI.ADMIN.SETTINGS_SAVED}
        </p>
      )}
    </form>
  );
}

