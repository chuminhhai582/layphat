import React, { useEffect, useState } from 'react';
import { STRINGS_VI } from '@but-oi/shared';
import { apiFetch } from '../lib/api.js';

type WordsPageProps = {
  pin: string;
};

export function WordsPage({ pin }: WordsPageProps): React.ReactElement {
  const [words, setWords] = useState<string[]>([]);
  const [bulkInput, setBulkInput] = useState('');

  const loadWords = async () => {
    const res = await apiFetch<{ words: string[] }>('/api/admin/banned-words', pin);
    setWords(res.words);
  };

  useEffect(() => {
    void loadWords();
  }, [pin]);

  const handleAddBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;
    const res = await apiFetch<{ words: string[] }>('/api/admin/banned-words', pin, {
      method: 'POST',
      body: JSON.stringify({ words: bulkInput }),
    });
    setWords(res.words);
    setBulkInput('');
  };

  const handleRemove = async (w: string) => {
    const res = await apiFetch<{ words: string[] }>(
      `/api/admin/banned-words/${encodeURIComponent(w)}`,
      pin,
      { method: 'DELETE' },
    );
    setWords(res.words);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">
          {STRINGS_VI.ADMIN.WORDS_ADD_BTN}
        </h2>
        <form onSubmit={handleAddBulk} className="mt-3 space-y-3">
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            rows={4}
            placeholder={STRINGS_VI.ADMIN.WORDS_BULK_PLACEHOLDER}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-amber-300"
          >
            {STRINGS_VI.ADMIN.WORDS_ADD_BTN}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">
          {STRINGS_VI.ADMIN.WORDS_TITLE} ({words.length})
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {words.map((w) => (
            <span
              key={w}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800"
            >
              {w}
              <button
                type="button"
                onClick={() => void handleRemove(w)}
                className="ml-1 rounded bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

