/**
 * SpotMap — full-screen map with numbered spot pins and list.
 *
 * Native (iOS/Android): react-native-maps with animated user-location dot,
 *   numbered spot pins, list-mode toggle, slide-up summary card on pin tap.
 * Web desktop (≥ breakpoints.web): Leaflet map left + ranked list right.
 * Web mobile (< breakpoints.web): Leaflet map top + scrollable list below,
 *   slide-up summary card on pin tap.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, spacing, borderRadius, typography, breakpoints } from '@/constants/theme';
import { DarkSpotSite, Location } from '@/store/context';
import SpotCard from './SpotCard';
import LeafletMapView from './LeafletMapView';

// Conditionally import react-native-maps (not supported on web)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MapView: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Marker: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
  } catch {
    // maps unavailable in this environment
  }
}

interface SpotMapProps {
  spots: DarkSpotSite[];
  userLocation: Location;
  onViewDetails: (spot: DarkSpotSite) => void;
}

// --- Native Pulsing Dot ---
function PulsingDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.8, duration: 900, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
    // scale and opacity are stable Animated.Value refs — no re-run needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={dotStyles.container}>
      <Animated.View style={[dotStyles.ring, { transform: [{ scale }], opacity }]} />
      <View style={dotStyles.dot} />
    </View>
  );
}

const dotStyles = StyleSheet.create({
  container: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: `rgba(52,211,153,0.25)`,
    borderWidth: 1,
    borderColor: `rgba(52,211,153,0.5)`,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent.primary,
    borderWidth: 2,
    borderColor: colors.text.primary,
  },
});

// --- Numbered Pin ---
function SpotPin({ rank, selected }: { rank: number; selected: boolean }) {
  return (
    <View style={[pinStyles.pin, selected && pinStyles.pinSelected]}>
      <Text style={[pinStyles.text, selected && pinStyles.textSelected]}>{rank}</Text>
    </View>
  );
}

const pinStyles = StyleSheet.create({
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.surface,
    borderWidth: 2,
    borderColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSelected: {
    backgroundColor: colors.accent.primary,
  },
  text: {
    ...typography.scale.label.small,
    fontSize: 11,
    color: colors.accent.primary,
    fontWeight: '700',
  },
  textSelected: {
    color: colors.text.inverse,
  },
});

// --- Slide-up Summary Card ---
interface SummaryCardProps {
  spot: DarkSpotSite;
  onClose: () => void;
  onViewDetails: (spot: DarkSpotSite) => void;
}

function SummaryCard({ spot, onClose, onViewDetails }: SummaryCardProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
    // slideAnim is a stable Animated.Value ref — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot]);

  return (
    <Animated.View style={[cardStyles.wrap, { transform: [{ translateY: slideAnim }] }]}>
      <Pressable style={cardStyles.handle} onPress={onClose}>
        <View style={cardStyles.handleBar} />
      </Pressable>
      <SpotCard
        spot={spot}
        showViewDetails
        onViewDetails={onViewDetails}
      />
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: colors.border.default,
    padding: spacing['3xl'],
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  handle: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.background.elevated,
  },
});

// --- Map View (native only) ---
function NativeMap({ spots, userLocation, onViewDetails }: SpotMapProps) {
  const [showList, setShowList] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<DarkSpotSite | null>(null);
  const listScrollRef = useRef<ScrollView>(null);

  const handlePinPress = useCallback((spot: DarkSpotSite) => {
    setSelectedSpot(spot);
  }, []);

  const handleListPress = useCallback((spot: DarkSpotSite) => {
    // List tap: set selected (shows in active state), switch to map to show pin
    setSelectedSpot(spot);
    setShowList(false);
  }, []);

  const initialRegion = {
    latitude: userLocation.lat,
    longitude: userLocation.lon,
    latitudeDelta: 3.0,
    longitudeDelta: 3.0,
  };

  if (!MapView) {
    return (
      <View style={mapStyles.fallback}>
        <Text style={mapStyles.fallbackText}>Map unavailable</Text>
      </View>
    );
  }

  return (
    <View style={mapStyles.container}>
      {showList ? (
        <ScrollView
          ref={listScrollRef}
          style={mapStyles.listScroll}
          contentContainerStyle={mapStyles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {spots.map((spot) => (
            <SpotCard
              key={spot.name + spot.lat}
              spot={spot}
              selected={selectedSpot?.name === spot.name}
              onPress={() => handleListPress(spot)}
              showViewDetails
              onViewDetails={onViewDetails}
            />
          ))}
          {spots.length === 0 && (
            <Text style={mapStyles.emptyText}>No spots in this area.</Text>
          )}
        </ScrollView>
      ) : (
        <MapView
          style={mapStyles.map}
          initialRegion={initialRegion}
          customMapStyle={darkMapStyle}
          showsUserLocation={false}
          showsCompass={false}
          onPress={() => setSelectedSpot(null)}
        >
          {/* User location */}
          {Marker && (
            <Marker
              coordinate={{ latitude: userLocation.lat, longitude: userLocation.lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <PulsingDot />
            </Marker>
          )}

          {/* Spot pins */}
          {Marker && spots.map((spot, i) => (
            <Marker
              key={spot.name + spot.lat}
              coordinate={{ latitude: spot.lat, longitude: spot.lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => handlePinPress(spot)}
            >
              <SpotPin rank={spot.rank ?? i + 1} selected={selectedSpot?.name === spot.name} />
            </Marker>
          ))}
        </MapView>
      )}

      {/* List toggle */}
      <Pressable
        style={mapStyles.toggleBtn}
        onPress={() => { setShowList((v) => !v); setSelectedSpot(null); }}
      >
        <Text style={mapStyles.toggleText}>{showList ? '🗺 Map' : '≡ List'}</Text>
      </Pressable>

      {/* Slide-up summary card when pin tapped */}
      {!showList && selectedSpot && (
        <SummaryCard
          spot={selectedSpot}
          onClose={() => setSelectedSpot(null)}
          onViewDetails={onViewDetails}
        />
      )}
    </View>
  );
}

const mapStyles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  listScroll: { flex: 1 },
  listContent: {
    padding: spacing['3xl'],
    gap: spacing.xl,
    paddingBottom: spacing['7xl'],
  },
  emptyText: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingTop: spacing['6xl'],
  },
  toggleBtn: {
    position: 'absolute',
    top: spacing['4xl'],
    right: spacing['3xl'],
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.lg,
  },
  toggleText: {
    ...typography.scale.label.medium,
    color: colors.text.primary,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.surface,
  },
  fallbackText: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
  },
});

// Dark map style for Google Maps on Android
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#080B18' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#A89880' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#080B18' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A1310' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050508' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// ── Web layouts (Leaflet-based) ────────────────────────────────────────────

// Desktop: Leaflet map left (40%) + ranked list right (60%)
function DesktopWebLayout({ spots, userLocation, onViewDetails }: SpotMapProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const listScrollRef = useRef<ScrollView>(null);
  const itemHeightRef = useRef<number>(0);

  // When pin is tapped (selectedIdx changes from Leaflet), scroll list to that item
  useEffect(() => {
    if (selectedIdx !== null && listScrollRef.current && itemHeightRef.current > 0) {
      listScrollRef.current.scrollTo({
        y: selectedIdx * (itemHeightRef.current + 12), // 12 = gap
        animated: true,
      });
    }
  }, [selectedIdx]);

  return (
    <View style={webStyles.container}>
      {/* Left pane — Leaflet map */}
      <View style={webStyles.mapPane}>
        <LeafletMapView
          spots={spots}
          userLocation={userLocation}
          selectedIdx={selectedIdx}
          onSelectIdx={setSelectedIdx}
        />
      </View>

      {/* Right pane — ranked spot list */}
      <ScrollView
        ref={listScrollRef}
        style={webStyles.listPane}
        contentContainerStyle={webStyles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {spots.map((spot, i) => (
          <View
            key={spot.name + spot.lat}
            onLayout={(e) => {
              if (i === 0) itemHeightRef.current = e.nativeEvent.layout.height;
            }}
          >
            <SpotCard
              spot={spot}
              selected={selectedIdx === i}
              onPress={() => setSelectedIdx(i === selectedIdx ? null : i)}
              showViewDetails
              onViewDetails={onViewDetails}
            />
          </View>
        ))}
        {spots.length === 0 && (
          <Text style={webStyles.emptyText}>No spots found in this area.</Text>
        )}
      </ScrollView>
    </View>
  );
}

// Mobile web: Leaflet map on top (300 px) + slide-up card on pin tap + list below
function MobileWebLayout({ spots, userLocation, onViewDetails }: SpotMapProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const selectedSpot = selectedIdx !== null ? spots[selectedIdx] : null;
  const listScrollRef = useRef<ScrollView>(null);
  const itemHeightRef = useRef<number>(0);

  // Scroll list to selected item when pin tapped
  useEffect(() => {
    if (selectedIdx !== null && listScrollRef.current && itemHeightRef.current > 0) {
      listScrollRef.current.scrollTo({
        y: selectedIdx * (itemHeightRef.current + 12),
        animated: true,
      });
    }
  }, [selectedIdx]);

  return (
    <ScrollView
      ref={listScrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={mobileStyles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Map area with slide-up card overlay on pin tap */}
      <View style={mobileStyles.mapWrap}>
        <LeafletMapView
          spots={spots}
          userLocation={userLocation}
          selectedIdx={selectedIdx}
          onSelectIdx={setSelectedIdx}
        />
        {selectedSpot && (
          <SummaryCard
            spot={selectedSpot}
            onClose={() => setSelectedIdx(null)}
            onViewDetails={onViewDetails}
          />
        )}
      </View>

      {/* Scrollable spot list below map */}
      <View style={mobileStyles.list}>
        {spots.map((spot, i) => (
          <View
            key={spot.name + spot.lat}
            onLayout={(e) => {
              if (i === 0) itemHeightRef.current = e.nativeEvent.layout.height;
            }}
          >
            <SpotCard
              spot={spot}
              selected={selectedIdx === i}
              onPress={() => setSelectedIdx(i === selectedIdx ? null : i)}
              showViewDetails
              onViewDetails={onViewDetails}
            />
          </View>
        ))}
        {spots.length === 0 && (
          <Text style={mobileStyles.emptyText}>No spots found in this area.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const webStyles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing['6xl'],
    padding: spacing['3xl'],
  },
  mapPane: {
    flex: 2,
    minWidth: 300,
    borderRadius: borderRadius['3xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  listPane: { flex: 3 },
  listContent: {
    gap: spacing.xl,
    paddingBottom: spacing['7xl'],
  },
  emptyText: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingTop: spacing['6xl'],
  },
});

const mobileStyles = StyleSheet.create({
  content: {
    padding: spacing['3xl'],
    gap: spacing['4xl'],
    paddingBottom: spacing['7xl'],
  },
  mapWrap: {
    height: 320,
    borderRadius: borderRadius['3xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
    position: 'relative',
  },
  list: { gap: spacing.xl },
  emptyText: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingTop: spacing['6xl'],
  },
});

// ── Main export ────────────────────────────────────────────────────────────
export default function SpotMap(props: SpotMapProps) {
  const { width } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <NativeMap {...props} />;
  }

  if (width < breakpoints.web) {
    return <MobileWebLayout {...props} />;
  }

  return <DesktopWebLayout {...props} />;
}
