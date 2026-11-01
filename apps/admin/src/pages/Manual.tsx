import React, { useState } from 'react';
import {
  STRINGS_VI,
  type AdminManualPayload,
  type TierId,
} from '@but-oi/shared';

type ManualPageProps = {
  onTriggerManual: (payload: AdminManualPayload) => void;
};

export function ManualPage({ onTriggerManual }: ManualPageProps): React.ReactElement {
  const [name, setName] = useState('');
  const [tier, setTier] = useState<TierId>('visit');
  const [wish, setWish] = useState('');
  const [sentNotice, setSentNotice] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onTriggerManual({
      name: name.trim() || 'Minh Anh',
      tier,
      wish: wish.trim() || undefined,
    });
    setWish('');
    setSentNotice(true);
    setTimeout(() => setSentNotice(false), 2000);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">
        {STRINGS_VI.ADMIN.MANUAL_TITLE}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700">
            {STRINGS_VI.ADMIN.MANUAL_NAME_LABEL}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Minh Anh"
            className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">
            {STRINGS_VI.ADMIN.MANUAL_TIER_LABEL}
          </label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(['firefly', 'visit', 'miracle', 'grand'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`min-h-[44px] rounded-lg px-3 py-2 text-sm font-bold transition ${
                  tier === t
                    ? 'bg-slate-900 text-amber-300'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {STRINGS_VI.TIER_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">
            {STRINGS_VI.ADMIN.MANUAL_WISH_LABEL}
          </label>
          <textarea
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            rows={3}
            placeholder="Nhập lời ước (sẽ đi qua bộ kiểm duyệt)..."
            className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
        </div>

        <button
          type="submit"
          className="min-h-[48px] w-full rounded-lg bg-amber-600 px-4 py-3 text-base font-bold text-white hover:bg-amber-700"
        >
          {STRINGS_VI.ADMIN.MANUAL_SUBMIT}
        </button>

        {sentNotice && (
          <p className="text-center text-sm font-semibold text-emerald-600">
            Đã thêm lượt Bụt hiện vào hàng chờ!
          </p>
        )}
      </form>
    </section>
  );
}

