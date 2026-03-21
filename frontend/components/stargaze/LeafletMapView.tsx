/**
 * LeafletMapView.tsx — native stub.
 * Metro resolves LeafletMapView.web.tsx on web builds and this file on
 * iOS/Android builds. SpotMap routes Platform.OS !== 'web' to NativeMap
 * before this component is ever rendered, so it is intentionally empty.
 */
import type { } from 'react';

export interface LeafletMapViewProps {
  spots: unknown[];
  userLocation: unknown;
  selectedIdx: number | null;
  onSelectIdx: (idx: number | null) => void;
}

export default function LeafletMapView(_props: LeafletMapViewProps) {
  return null;
}
