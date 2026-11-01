import React, { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_NAMESPACES,
  STRINGS_VI,
  type AdminPreviewPayload,
  type AdminStatePayload,
  type AdminToServerEvents,
  type ServerToAdminEvents,
  type Settings,
} from '@but-oi/shared';
import { apiFetch, getServerBaseUrl } from './lib/api.js';
import { LivePage } from './pages/Live.js';
import { ManualPage } from './pages/Manual.js';
import { BankPage } from './pages/Bank.js';
import { WordsPage } from './pages/Words.js';
import { SettingsPage } from './pages/Settings.js';
import { SimulatorPage } from './pages/Simulator.js';

type TabId = 'live' | 'manual' | 'bank' | 'words' | 'settings' | 'sim';

export function App(): React.ReactElement {
  const [pin, setPin] = useState<string>(() => localStorage.getItem('admin_pin') ?? '');
  const [pinInput, setPinInput] = useState<string>(pin);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabId>('live');

  const [socket, setSocket] = useState<Socket<
    ServerToAdminEvents,
    AdminToServerEvents
  > | null>(null);
  const [adminState, setAdminState] = useState<AdminStatePayload | null>(null);
  const [preview, setPreview] = useState<AdminPreviewPayload | null>(null);

  const connectWithPin = (targetPin: string) => {
    setAuthError('');
    if (socket) {
      socket.disconnect();
    }

    const s: Socket<ServerToAdminEvents, AdminToServerEvents> = io(
      `${getServerBaseUrl()}${SOCKET_NAMESPACES.ADMIN}`,
      {
        auth: { pin: targetPin },
        reconnection: true,
      },
    );

    s.on('connect', () => {
      setAuthenticated(true);
      setPin(targetPin);
      localStorage.setItem('admin_pin', targetPin);
    });

    s.on('connect_error', () => {
      setAuthenticated(false);
      setAuthError(STRINGS_VI.ADMIN.PIN_ERROR);
    });

    s.on('admin:state', (st) => {
      setAdminState(st);
    });

    s.on('queue:update', (q) => {
      setAdminState((prev) => (prev ? { ...prev, queue: q } : prev));
    });

    s.on('state:pause', (paused) => {
      setAdminState((prev) => (prev ? { ...prev, paused } : prev));
    });

    s.on('admin:preview', (p) => {
      setPreview(p);
      const remainMs = Math.max(500, p.expiresAt - Date.now());
      setTimeout(() => {
        setPreview((cur) => (cur?.visitId === p.visitId ? null : cur));
      }, remainMs);
    });

    setSocket(s);
  };

  useEffect(() => {
    connectWithPin(pin);
    return () => {
      socket?.disconnect();
    };
  }, []);

  const handleSaveSettings = async (partial: Partial<Settings>) => {
    const res = await apiFetch<{ settings: Settings }>('/api/admin/settings', pin, {
      method: 'PUT',
      body: JSON.stringify(partial),
    });
    setAdminState((prev) => (prev ? { ...prev, settings: res.settings } : prev));
  };

  if (!authenticated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-slate-50 p-6 text-slate-900">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
          <h1 className="text-xl font-bold text-slate-900">
            {STRINGS_VI.ADMIN_TITLE}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {STRINGS_VI.ADMIN.PIN_TITLE}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              connectWithPin(pinInput);
            }}
            className="mt-4 space-y-3"
          >
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder={STRINGS_VI.ADMIN.PIN_PLACEHOLDER}
              className="min-h-[48px] w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
            {authError && (
              <p className="text-xs font-semibold text-rose-600">{authError}</p>
            )}
            <button
              type="submit"
              className="min-h-[48px] w-full rounded-lg bg-slate-900 px-4 py-3 text-base font-bold text-amber-300"
            >
              {STRINGS_VI.ADMIN.PIN_SUBMIT}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-20 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white shadow">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <h1 className="text-lg font-bold text-amber-300">
            {STRINGS_VI.ADMIN_TITLE}
          </h1>
          <span className="text-xs text-slate-300">
            {adminState?.sourceStatus.source.toUpperCase() ?? 'LIVE'}
          </span>
        </div>
      </header>

      {/* T32: Popup xem trước 3 giây khi lượt miracle/grand có lời do AI viết */}
      {preview && (
        <div className="fixed inset-x-4 top-16 z-50 mx-auto max-w-xl rounded-xl border-2 border-amber-500 bg-slate-900 p-4 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-amber-300">
              {STRINGS_VI.ADMIN.PREVIEW_POPUP_TITLE} • {preview.viewerName}
            </span>
            <button
              type="button"
              onClick={() => {
                socket?.emit('admin:replaceBlessing', preview.visitId);
                setPreview(null);
              }}
              className="min-h-[44px] rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white"
            >
              {STRINGS_VI.ADMIN.BTN_CHANGE_BLESSING}
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-100">{preview.blessingText}</p>
        </div>
      )}

      <main className="mx-auto max-w-xl p-4">
        {activeTab === 'live' && adminState && (
          <LivePage
            state={adminState}
            onSwitchSource={(src) => socket?.emit('admin:switchSource', src)}
            onPauseToggle={(paused) => socket?.emit('admin:pause', paused)}
            onSkip={(id) => socket?.emit('admin:skip', id)}
            onPromote={(id) => socket?.emit('admin:promote', id)}
            onReplay={(id) => socket?.emit('admin:replay', id)}
          />
        )}

        {activeTab === 'manual' && (
          <ManualPage
            onTriggerManual={(payload) => socket?.emit('admin:manual', payload)}
          />
        )}

        {activeTab === 'bank' && <BankPage pin={pin} />}

        {activeTab === 'words' && <WordsPage pin={pin} />}

        {activeTab === 'settings' && adminState && (
          <SettingsPage
            settings={adminState.settings}
            onSave={handleSaveSettings}
          />
        )}

        {activeTab === 'sim' && <SimulatorPage pin={pin} />}
      </main>

      {/* Thanh điều hướng dưới tối ưu điện thoại (nút >= 44px) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white shadow-lg">
        <div className="mx-auto grid max-w-xl grid-cols-6">
          {(
            [
              ['live', STRINGS_VI.ADMIN.NAV_LIVE],
              ['manual', STRINGS_VI.ADMIN.NAV_MANUAL],
              ['bank', STRINGS_VI.ADMIN.NAV_BANK],
              ['words', STRINGS_VI.ADMIN.NAV_WORDS],
              ['settings', STRINGS_VI.ADMIN.NAV_SETTINGS],
              ['sim', STRINGS_VI.ADMIN.NAV_SIMULATOR],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`min-h-[52px] px-1 py-2 text-xs font-bold transition ${
                activeTab === id
                  ? 'bg-slate-900 text-amber-300'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
