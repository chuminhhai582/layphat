import React, { useEffect, useState } from 'react';
import {
  STRINGS_VI,
  type BlessingLength,
  type BlessingRecord,
  type OccasionType,
  type WishCategory,
} from '@but-oi/shared';
import { apiFetch, getServerBaseUrl } from '../lib/api.js';

type BankPageProps = {
  pin: string;
};

export function BankPage({ pin }: BankPageProps): React.ReactElement {
  const [blessings, setBlessings] = useState<BlessingRecord[]>([]);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterLen, setFilterLen] = useState<string>('all');
  const [filterOcc, setFilterOcc] = useState<string>('all');

  const [newCategory, setNewCategory] = useState<WishCategory>('binh_an');
  const [newLength, setNewLength] = useState<BlessingLength>('full');
  const [newOccasion, setNewOccasion] = useState<string>('none');
  const [newText, setNewText] = useState('');

  const loadList = async () => {
    const res = await apiFetch<{ blessings: BlessingRecord[] }>(
      '/api/admin/blessings',
      pin,
    );
    setBlessings(res.blessings);
  };

  useEffect(() => {
    void loadList();
  }, [pin]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    await apiFetch('/api/admin/blessings', pin, {
      method: 'POST',
      body: JSON.stringify({
        category: newCategory,
        length: newLength,
        occasion:
          newOccasion === 'none' ? null : (newOccasion as OccasionType),
        text: newText.trim(),
        weight: 1,
        active: 1,
      }),
    });
    setNewText('');
    await loadList();
  };

  const handleToggleActive = async (item: BlessingRecord) => {
    await apiFetch(`/api/admin/blessings/${item.id}`, pin, {
      method: 'PUT',
      body: JSON.stringify({ active: item.active ? 0 : 1 }),
    });
    await loadList();
  };

  const handleRegenAndPlay = async (item: BlessingRecord) => {
    const res = await apiFetch<{ audioUrl: string }>(
      `/api/admin/blessings/${item.id}/voice`,
      pin,
      { method: 'POST' },
    );
    await loadList();
    if (res.audioUrl) {
      const audio = new Audio(`${getServerBaseUrl()}${res.audioUrl}`);
      void audio.play().catch(() => {});
    }
  };

  const filtered = blessings.filter((b) => {
    if (filterCat !== 'all' && b.category !== filterCat) return false;
    if (filterLen !== 'all' && b.length !== filterLen) return false;
    if (filterOcc !== 'all') {
      if (filterOcc === 'none' && b.occasion !== null) return false;
      if (filterOcc !== 'none' && b.occasion !== filterOcc) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Thêm câu mới */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">
          {STRINGS_VI.ADMIN.BANK_ADD}
        </h2>
        <form onSubmit={handleAdd} className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as WishCategory)}
              className="min-h-[44px] rounded-lg border border-slate-300 px-2 text-sm"
            >
              {Object.entries(STRINGS_VI.CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={newLength}
              onChange={(e) => setNewLength(e.target.value as BlessingLength)}
              className="min-h-[44px] rounded-lg border border-slate-300 px-2 text-sm"
            >
              <option value="full">full</option>
              <option value="short">short</option>
              <option value="opener">opener</option>
              <option value="reject">reject</option>
              <option value="group">group</option>
              <option value="grand">grand</option>
            </select>
            <select
              value={newOccasion}
              onChange={(e) => setNewOccasion(e.target.value)}
              className="min-h-[44px] rounded-lg border border-slate-300 px-2 text-sm"
            >
              <option value="none">Quanh năm</option>
              <option value="trung_thu">Trung Thu</option>
              <option value="tet">Tết</option>
              <option value="cuoi_nam">Cuối năm</option>
            </select>
          </div>
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={2}
            placeholder="Bụt chúc {ten}..."
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-amber-300"
          >
            {STRINGS_VI.ADMIN.BANK_ADD}
          </button>
        </form>
      </section>

      {/* Bộ lọc & Danh sách */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-800">
            {STRINGS_VI.ADMIN.BANK_TITLE} ({filtered.length}/{blessings.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="min-h-[44px] rounded-lg border border-slate-300 px-2 text-xs"
            >
              <option value="all">Tất cả nhóm</option>
              {Object.entries(STRINGS_VI.CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filterLen}
              onChange={(e) => setFilterLen(e.target.value)}
              className="min-h-[44px] rounded-lg border border-slate-300 px-2 text-xs"
            >
              <option value="all">Tất cả độ dài</option>
              <option value="full">full</option>
              <option value="short">short</option>
              <option value="opener">opener</option>
              <option value="reject">reject</option>
              <option value="group">group</option>
              <option value="grand">grand</option>
            </select>
            <select
              value={filterOcc}
              onChange={(e) => setFilterOcc(e.target.value)}
              className="min-h-[44px] rounded-lg border border-slate-300 px-2 text-xs"
            >
              <option value="all">Mọi dịp</option>
              <option value="none">Thường ngày</option>
              <option value="trung_thu">Trung Thu</option>
              <option value="tet">Tết</option>
              <option value="cuoi_nam">Cuối năm</option>
            </select>
          </div>
        </div>

        <ul className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">
          {filtered.map((b) => (
            <li
              key={b.id}
              className={`rounded-lg border p-3 ${
                b.active ? 'border-slate-200 bg-slate-50' : 'border-slate-100 bg-slate-100 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase text-amber-800">
                  #{b.id} • {STRINGS_VI.CATEGORY_LABELS[b.category]} • {b.length}
                  {b.occasion ? ` • ${b.occasion}` : ''}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleRegenAndPlay(b)}
                    className="min-h-[44px] rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900"
                  >
                    {b.audio_path
                      ? STRINGS_VI.ADMIN.BANK_PREVIEW_VOICE
                      : STRINGS_VI.ADMIN.BANK_REGEN_VOICE}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(b)}
                    className="min-h-[44px] rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800"
                  >
                    {b.active ? 'Đang bật' : 'Đã tắt'}
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-sm text-slate-800">{b.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

