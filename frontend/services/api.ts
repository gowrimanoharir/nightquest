// All API calls go through this module. Components never call fetch directly.

import { ContextObject, Location } from '@/store/context';

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

export async function fetchChat(req: ChatRequest): Promise<ChatResponse> {
  return post<ChatResponse>('/api/chat', req);
}

export async function fetchPrompts(context?: Partial<ContextObject>): Promise<PromptsResponse> {
  const params: Record<string, string> = {};
  if (context?.tab) params.tab = context.tab;
  if (context?.location?.name) params.location = context.location.name;
  if (context?.active_event?.name) params.event = context.active_event.name;
  if (context?.active_spot?.name) params.spot = context.active_spot.name;
  return get<PromptsResponse>('/api/prompts', params);
}
