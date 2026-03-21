/**
 * LeafletMapView.web.tsx
 * Tile-based map using Leaflet + OpenStreetMap — only bundled for web
 * (Metro resolves this file over LeafletMapView.tsx on web builds).
 *
 * Features:
 *   - Dark OSM tile layer matching the app's dark theme
 *   - Numbered circle markers matching the NightQuest pin design
 *   - Pulsing amber dot for user location
 *   - AutoFit: fits bounds to show all spots + user location on mount
 *   - Marker click → calls onSelectIdx for parent to handle selection state
 */
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { DarkSpotSite, Location } from '@/store/context';

export interface LeafletMapViewProps {
  spots: DarkSpotSite[];
  userLocation: Location;
  selectedIdx: number | null;
  onSelectIdx: (idx: number | null) => void;
}

// ── CSS injection (once per session) ──────────────────────────────────────
function injectLeafletCSS() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('#nq-leaflet-link')) return;

  const link = document.createElement('link');
  link.id = 'nq-leaflet-link';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.id = 'nq-leaflet-styles';
  style.textContent = `
    /* Dark tile layer base */
    .leaflet-container { background: #080B18 !important; font-family: inherit; }

    /* Zoom controls — match app theme */
    .leaflet-control-zoom a {
      background: #110D0A !important;
      color: #F5F0E8 !important;
      border-color: #2A1F18 !important;
    }
    .leaflet-control-zoom a:hover { background: #1A1310 !important; }

    /* Hide attribution (not needed for OSM tile usage on a dev project) */
    .leaflet-control-attribution { display: none !important; }

    /* Pulsing ring animation for user location dot */
    @keyframes nq-pulse {
      0%, 100% { transform: scale(1); opacity: 0.6; }
      50%       { transform: scale(1.8); opacity: 0; }
    }
    .nq-pulse-ring { animation: nq-pulse 1.8s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
}

// ── Marker icon factories ──────────────────────────────────────────────────
function makeSpotIcon(rank: number, selected: boolean): L.DivIcon {
  const bg    = selected ? '#D4780A' : '#110D0A';
  const fg    = selected ? '#1A0C00' : '#D4780A';
  const border = '#D4780A';
  return L.divIcon({
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${bg};border:2.5px solid ${border};
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:700;color:${fg};
      cursor:pointer;box-sizing:border-box;
    ">${rank}</div>`,
    className: '',
    iconSize:   [28, 28],
    iconAnchor: [14, 14],
  });
}

function makeUserIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
      <div class="nq-pulse-ring" style="
        position:absolute;width:20px;height:20px;border-radius:50%;
        background:rgba(212,120,10,0.25);border:1px solid rgba(212,120,10,0.5);
      "></div>
      <div style="
        position:relative;z-index:1;
        width:10px;height:10px;border-radius:50%;
        background:#D4780A;border:2px solid #F5F0E8;
      "></div>
    </div>`,
    className: '',
    iconSize:   [20, 20],
    iconAnchor: [10, 10],
  });
}

// ── AutoFit: fits the map to show all spots + user on mount ───────────────
function AutoFit({
  spots,
  userLocation,
}: {
  spots: DarkSpotSite[];
  userLocation: Location;
}) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [
      [userLocation.lat, userLocation.lon],
      ...spots.map((s): [number, number] => [s.lat, s.lon]),
    ];
    if (points.length === 1) {
      map.setView(points[0], 10);
    } else {
      map.fitBounds(points, { padding: [40, 40] });
    }
  // Only run once on mount — spots/userLocation stable after initial load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function LeafletMapView({
  spots,
  userLocation,
  selectedIdx,
  onSelectIdx,
}: LeafletMapViewProps) {
  useEffect(() => { injectLeafletCSS(); }, []);

  return (
    <MapContainer
      center={[userLocation.lat, userLocation.lon]}
      zoom={8}
      style={{ width: '100%', height: '100%', borderRadius: 14 }}
      zoomControl
      attributionControl={false}
    >
      {/* Dark OSM tile layer — free, no API key */}
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* Auto-fit viewport to all markers on first render */}
      <AutoFit spots={spots} userLocation={userLocation} />

      {/* User location — pulsing amber dot */}
      <Marker
        position={[userLocation.lat, userLocation.lon]}
        icon={makeUserIcon()}
        zIndexOffset={1000}
      />

      {/* Spot markers — numbered circles, highlight on selection */}
      {spots.map((spot, i) => (
        <Marker
          key={`${spot.name}-${i}`}
          position={[spot.lat, spot.lon]}
          icon={makeSpotIcon(spot.rank ?? i + 1, selectedIdx === i)}
          eventHandlers={{
            click: () => onSelectIdx(selectedIdx === i ? null : i),
          }}
        />
      ))}
    </MapContainer>
  );
}
