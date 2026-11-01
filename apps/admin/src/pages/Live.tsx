import React from 'react';
import {
  STRINGS_VI,
  type AdminStatePayload,
  type SourceName,
} from '@but-oi/shared';

type LivePageProps = {
  state: AdminStatePayload;
  onSwitchSource: (src: SourceName) => void;
  onPauseToggle: (paused: boolean) => void;
  onSkip: (visitId: string) => void;
  onPromote: (visitId: string) => void;
  onReplay: (visitId?: string) => void;
};

export function LivePage({
  state,
  onSwitchSource,
  onPauseToggle,
  onSkip,
  onPromote,
  onReplay,
}: LivePageProps): React.ReactElement {
  const { sourceStatus, currentVisit, queue, paused, seatedCount, totalJoined } = state;

  const statusBadgeColor =
    sourceStatus.status === 'live'
      ? 'bg-emerald-600 text-white'
      : sourceStatus.status === 'connecting'
        ? 'bg-amber-500 text-white'
        : 'bg-rose-600 text-white';

  const statusLabel =
    sourceStatus.status === 'live'
      ? STRINGS_VI.ADMIN.STATUS_LIVE
      : sourceStatus.status === 'connecting'
        ? STRINGS_VI.ADMIN.STATUS_CONNECTING
        : sourceStatus.status === 'error'
          ? STRINGS_VI.ADMIN.STATUS_ERROR
          : STRINGS_VI.ADMIN.STATUS_OFFLINE;

  return (
    <div className="space-y-4">
      {/* Trạng thái nguồn & Điều khiển nhanh */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {STRINGS_VI.ADMIN.SOURCE_STATUS_TITLE}:{' '}
              <span className="uppercase text-amber-700">{sourceStatus.source}</span>
            </h2>
            <p className="text-xs text-slate-500">
              {sourceStatus.detail ?? ''} • Dân làng: {seatedCount}/36 (Tổng: {totalJoined})
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadgeColor}`}>
            {statusLabel}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(['connector', 'tikfinity', 'simulator'] as const).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => onSwitchSource(src)}
              className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                sourceStatus.source === src
                  ? 'bg-slate-900 text-amber-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {src.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onPauseToggle(!paused)}
            className={`min-h-[44px] w-full rounded-lg px-4 py-2 text-sm font-bold text-white transition ${
              paused ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {paused ? STRINGS_VI.ADMIN.RESUME_BUD : STRINGS_VI.ADMIN.PAUSE_BUD}
          </button>
        </div>
      </section>

      {/* Lượt đang diễn */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">
            {STRINGS_VI.ADMIN.CURRENT_VISIT_TITLE}
          </h2>
          {currentVisit && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onReplay(currentVisit.id)}
                className="min-h-[44px] rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800"
              >
                {STRINGS_VI.ADMIN.BTN_REPLAY}
              </button>
              <button
                type="button"
                onClick={() => onSkip(currentVisit.id)}
                className="min-h-[44px] rounded-lg bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700"
              >
                {STRINGS_VI.ADMIN.BTN_SKIP}
              </button>
            </div>
          )}
        </div>

        {currentVisit ? (
          <div className="mt-2 rounded-lg bg-amber-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">
                {currentVisit.viewer.displayName}
              </span>
              <span className="rounded bg-amber-700 px-2 py-0.5 text-xs font-bold text-white">
                {STRINGS_VI.TIER_LABELS[currentVisit.tier]} ({currentVisit.blessing?.source ?? 'bank'})
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{currentVisit.blessing?.text}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{STRINGS_VI.ADMIN.NO_CURRENT_VISIT}</p>
        )}
      </section>

      {/* Hàng chờ */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">
          {STRINGS_VI.ADMIN.QUEUE_TITLE} ({queue.length})
        </h2>

        {queue.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{STRINGS_VI.ADMIN.QUEUE_EMPTY}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {queue.map((item, idx) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3"
              >
                <div>
                  <span className="font-bold text-slate-900">
                    #{idx + 1} {item.viewer.displayName}
                  </span>
                  <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {STRINGS_VI.TIER_LABELS[item.tier]} • {item.status}
                  </span>
                  {item.blessing && (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                      {item.blessing.text}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onPromote(item.id)}
                    className="min-h-[44px] rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    {STRINGS_VI.ADMIN.BTN_PROMOTE}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSkip(item.id)}
                    className="min-h-[44px] rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    {STRINGS_VI.ADMIN.BTN_SKIP}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

