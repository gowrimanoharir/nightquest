import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Shape mirrors backend schemas.py exactly ---

export type EventType = 'meteor_shower' | 'eclipse' | 'moon' | 'planet' | 'milky_way';

export interface Location {
  lat: number;
  lon: number;
  name?: string;
  source?: 'gps' | 'ip' | 'timezone' | 'manual';
  timezone?: string;
}

export interface ActiveEvent {
  name: string;
  date: string;
  type: EventType;
}

export interface ConditionsSummary {
  score: number;
  label: string;
  data_type?: 'forecast' | 'historical_average';
  cloud_pct?: number;
  moon_illumination?: number;
  wind_kmh?: number;
}

export interface DarkSpotSite {
  name: string;
  lat: number;
  lon: number;
  bortle_estimate?: number;
  certified?: boolean;
  website?: string;
  country?: string;
  state?: string;
  address?: string;
  // Phase 3A: enriched fields from /api/spots
  distance?: number;    // km from user location
  score?: number;       // composite ranking score 0–100
  rank?: number;        // 1-based position
  // Phase 3B: conditions summary for spot cards
  conditions_summary?: ConditionsSummary;
}

export interface ActiveSpot {
  name: string;
  lat: number;
  lon: number;
  bortle?: number;
  distance?: number;
  certified?: boolean;
  website?: string;
}

export interface VisibilityConditions {
  available: boolean;
  for_date?: string;
  for_location?: Pick<Location, 'lat' | 'lon'>;
}

export interface ContextObject {
  tab: 'explore' | 'stargaze';
  location: Location | null;
  date: string | null;
  active_event: ActiveEvent | null;
  spots: DarkSpotSite[];
  active_spot: ActiveSpot | null;
  visibility_conditions: VisibilityConditions | null;
}

interface ContextStore extends ContextObject {
  setTab: (tab: ContextObject['tab']) => void;
  setLocation: (location: Location) => void;
  setDate: (date: string) => void;
  setActiveEvent: (event: ActiveEvent | null) => void;
  setSpots: (spots: DarkSpotSite[]) => void;
  setActiveSpot: (spot: ActiveSpot | null) => void;
  setVisibilityConditions: (conditions: VisibilityConditions) => void;
  // Straight replace — called when any API response has context_updated: true
  applyContextUpdates: (updated: ContextObject) => void;
  // UI-only flag: not part of ContextObject, not sent to backend, not reset by applyContextUpdates
  trigger_spot_search: boolean;
  setTriggerSpotSearch: (val: boolean) => void;
  // AsyncStorage hydration — called once on app start from _layout.tsx
  hydrate: () => Promise<void>;
}

const defaultContext: ContextObject = {
  tab: 'explore',
  location: null,
  date: null,
  active_event: null,
  spots: [],
  active_spot: null,
  visibility_conditions: null,
};

// Persist: location, date, active_event, active_spot, spots.
// visibility_conditions is intentionally excluded — always stale after app close.
// Chat history is never persisted (session-only per architecture rules).
const PERSIST_KEY = 'nq_context_v1';

type PersistedFields = Pick<ContextObject, 'location' | 'date' | 'active_event' | 'active_spot' | 'spots'>;

function extractPersisted(state: ContextObject): PersistedFields {
  return {
    location: state.location,
    date: state.date,
    active_event: state.active_event,
    active_spot: state.active_spot,
    spots: state.spots,
  };
}

async function persistContext(state: ContextObject): Promise<void> {
  try {
    await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(extractPersisted(state)));
  } catch {
    // Silently ignore — app works without persistence
  }
}

export const useContextStore = create<ContextStore>((set, get) => ({
  ...defaultContext,

  setTab: (tab) => { set({ tab }); persistContext(get()); },

  setLocation: (location) => { set({ location }); persistContext(get()); },

  setDate: (date) => { set({ date }); persistContext(get()); },

  setActiveEvent: (active_event) => { set({ active_event }); persistContext(get()); },

  setSpots: (spots) => { set({ spots }); persistContext(get()); },

  setActiveSpot: (active_spot) => { set({ active_spot }); persistContext(get()); },

  setVisibilityConditions: (visibility_conditions) => set({ visibility_conditions }),

  applyContextUpdates: (updated) => {
    set({
      tab: updated.tab,
      location: updated.location,
      date: updated.date,
      active_event: updated.active_event,
      spots: updated.spots,
      active_spot: updated.active_spot,
      visibility_conditions: updated.visibility_conditions,
      // trigger_spot_search intentionally NOT reset here — UI-only flag
    });
    persistContext(updated);
  },

  trigger_spot_search: false,
  setTriggerSpotSearch: (trigger_spot_search) => set({ trigger_spot_search }),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(PERSIST_KEY);
      if (!raw) return;
      const saved: Partial<PersistedFields> = JSON.parse(raw);
      set({
        location:     saved.location     ?? null,
        date:         saved.date         ?? null,
        active_event: saved.active_event ?? null,
        active_spot:  saved.active_spot  ?? null,
        spots:        saved.spots        ?? [],
        // visibility_conditions stays null — stale on reopen
      });
    } catch {
      // Corrupt storage — fall back to defaults silently
    }
  },
}));
