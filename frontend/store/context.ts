import { create } from 'zustand';

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

export const useContextStore = create<ContextStore>((set) => ({
  ...defaultContext,

  setTab: (tab) => set({ tab }),
  setLocation: (location) => set({ location }),
  setDate: (date) => set({ date }),
  setActiveEvent: (active_event) => set({ active_event }),
  setSpots: (spots) => set({ spots }),
  setActiveSpot: (active_spot) => set({ active_spot }),
  setVisibilityConditions: (visibility_conditions) => set({ visibility_conditions }),

  applyContextUpdates: (updated) =>
    set({
      tab: updated.tab,
      location: updated.location,
      date: updated.date,
      active_event: updated.active_event,
      spots: updated.spots,
      active_spot: updated.active_spot,
      visibility_conditions: updated.visibility_conditions,
      // trigger_spot_search intentionally NOT reset here — UI-only flag
    }),

  trigger_spot_search: false,
  setTriggerSpotSearch: (trigger_spot_search) => set({ trigger_spot_search }),
}));
