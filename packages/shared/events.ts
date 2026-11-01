import type {
  FireflyBurstPayload,
  GroupVisitPayload,
  Settings,
  SourceName,
  SourceStatusInfo,
  TierId,
  Viewer,
  Visit,
  WishCategory,
} from './types.js';

export const SOCKET_NAMESPACES = {
  OVERLAY: '/overlay',
  ADMIN: '/admin',
} as const;

export const SOCKET_EVENTS = {
  // Server -> Overlay
  SEAT_ADD: 'seat:add',
  SEAT_REMOVE: 'seat:remove',
  FX_FIREFLY: 'fx:firefly',
  FX_WAVE: 'fx:wave',
  FX_LEAF: 'fx:leaf',
  FX_FISH: 'fx:fish',
  FX_SPARROW: 'fx:sparrow',
  VISIT_START: 'visit:start',
  VISIT_FIREFLY: 'visit:firefly',
  VISIT_GROUP: 'visit:group',
  QUEUE_UPDATE: 'queue:update',
  STATE_PAUSE: 'state:pause',
  STATE_SYNC: 'state:sync',
  GROUP_COUNTDOWN: 'group:countdown',
  SETTINGS_UPDATE: 'settings:update',

  // Overlay -> Server
  VISIT_DONE: 'visit:done',

  // Admin <-> Server
  ADMIN_STATE: 'admin:state',
  ADMIN_PREVIEW: 'admin:preview',
  ADMIN_SKIP: 'admin:skip',
  ADMIN_PROMOTE: 'admin:promote',
  ADMIN_REPLAY: 'admin:replay',
  ADMIN_PAUSE: 'admin:pause',
  ADMIN_MANUAL: 'admin:manual',
  ADMIN_SWITCH_SOURCE: 'admin:switchSource',
  ADMIN_REPLACE_BLESSING: 'admin:replaceBlessing',
  ADMIN_SETTINGS_UPDATE: 'admin:settingsUpdate',
} as const;

export type SeatSyncPayload = {
  seats: Array<{ seatIndex: number; viewer: Viewer; lastActiveAt: number }>;
  totalJoined: number;
  queue: Visit[];
  currentVisit: Visit | null;
  paused: boolean;
  nextGroupVisitAt: number;
  settings: Settings;
};

export type AdminStatePayload = {
  sourceStatus: SourceStatusInfo;
  queue: Visit[];
  currentVisit: Visit | null;
  paused: boolean;
  totalJoined: number;
  seatedCount: number;
  settings: Settings;
};

export type AdminPreviewPayload = {
  visitId: string;
  viewerName: string;
  tier: TierId;
  blessingText: string;
  category: WishCategory;
  expiresAt: number;
};

export type AdminManualPayload = {
  name: string;
  tier: TierId;
  wish?: string;
};

export interface ServerToOverlayEvents {
  'seat:add': (payload: Viewer & { seatIndex?: number; totalJoined?: number }) => void;
  'seat:remove': (userId: string) => void;
  'fx:firefly': (payload: { userId: string; count: number }) => void;
  'fx:wave': (payload: { userId: string; showBudShadow?: boolean }) => void;
  'fx:leaf': (payload: { userId: string }) => void;
  'fx:fish': (payload: { userId: string }) => void;
  'fx:sparrow': (payload: { userId: string }) => void;
  'visit:start': (visit: Visit) => void;
  'visit:firefly': (payload: FireflyBurstPayload) => void;
  'queue:update': (nextVisits: Visit[]) => void;
  'visit:group': (payload: GroupVisitPayload) => void;
  'state:pause': (paused: boolean) => void;
  'state:sync': (payload: SeatSyncPayload) => void;
  'group:countdown': (payload: { nextGroupVisitAt: number }) => void;
  'settings:update': (settings: Settings) => void;
}

export interface OverlayToServerEvents {
  'visit:done': (visitId: string) => void;
}

export interface ServerToAdminEvents {
  'queue:update': (nextVisits: Visit[]) => void;
  'admin:state': (state: AdminStatePayload) => void;
  'admin:preview': (preview: AdminPreviewPayload) => void;
  'state:pause': (paused: boolean) => void;
}

export interface AdminToServerEvents {
  'admin:skip': (visitId: string) => void;
  'admin:promote': (visitId: string) => void;
  'admin:replay': (visitId?: string) => void;
  'admin:pause': (paused: boolean) => void;
  'admin:manual': (payload: AdminManualPayload) => void;
  'admin:switchSource': (source: SourceName) => void;
  'admin:replaceBlessing': (visitId: string) => void;
  'admin:settingsUpdate': (partial: Partial<Settings>) => void;
}
