// All API calls go through this module. Components never call fetch directly.

import { ContextObject, DarkSpotSite, Location } from '@/store/context';

// --- Conditions types ---

export interface ConditionFactor {
  name: string;
  score: number;
  max_score: number;
  status: 'good' | 'moderate' | 'poor';
  detail: string;
}

export interface MoonInfo {
  phase: string;
  illumination: number;
  rise_time: string;
  set_time: string;
  best_viewing_window: string;
}

export interface ConditionsResponse {
  score: number;
  label: string;
  factors: ConditionFactor[];
  moon: MoonInfo;
  ai_take: string;
  data_type: 'forecast' | 'historical_average';
}

function normalizeBaseUrl(raw: string | undefined): string {
  const url = (raw ?? 'http://localhost:8000').trim().replace(/\/$/, '');
  // Ensure an absolute URL — add https:// if no protocol is present
  if (!/^https?:\/\//i.test(url)) return `https://${url}`;
  return url;
}
const BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);

// --- Shared types ---

export type EventType = 'meteor_shower' | 'eclipse' | 'moon' | 'planet' | 'milky_way';

export interface CelestialEvent {
  name: string;
  date: string;
  type: EventType;
  description?: string;
}

export interface EventsResponse {
  events: CelestialEvent[];
  generated_at?: string;
}

export interface SpotsRequest {
  location: Location;
  date: string;
  event_type?: string;
  distance_km?: number;
}

export interface SpotsResponse {
  spots: DarkSpotSite[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  context?: ContextObject;
}

export interface ChatResponse {
  reply: string;
  context_updated: boolean;
  context?: ContextObject;
}

export interface PromptsResponse {
  prompts: string[];
}

// --- API helpers ---

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${path} ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${path} ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// --- Endpoint functions ---

export async function fetchEvents(location: Location, year: number): Promise<EventsResponse> {
  return post<EventsResponse>('/api/events', { location, year, filters: [] });
}

export async function fetchSpots(
  location: Location,
  date: string,
  eventType?: string,
  distanceKm?: number,
): Promise<SpotsResponse> {
  return post<SpotsResponse>('/api/spots', {
    location,
    date,
    event_type: eventType,
    distance_km: distanceKm,
  });
}

export async function fetchConditions(
  spotLat: number,
  spotLon: number,
  date: string,
  timezone: string,
): Promise<ConditionsResponse> {
  return post<ConditionsResponse>('/api/conditions', {
    spot: { lat: spotLat, lon: spotLon },
    date,
    timezone,
  });
}

export async function fetchChat(req: ChatRequest): Promise<ChatResponse> {
  return post<ChatResponse>('/api/chat', req);
}

export async function fetchBortle(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await get<{ bortle: number | null }>('/api/bortle', {
      lat: String(lat),
      lon: String(lon),
    });
    return res.bortle;
  } catch {
    return null;
  }
}

export async function fetchPrompts(context?: Partial<ContextObject>): Promise<PromptsResponse> {
  const params: Record<string, string> = {};
  if (context?.tab) params.tab = context.tab;
  if (context?.location?.name) params.location = context.location.name;
  if (context?.active_event?.name) params.event = context.active_event.name;
  if (context?.active_spot?.name) params.spot = context.active_spot.name;
  return get<PromptsResponse>('/api/prompts', params);
}
