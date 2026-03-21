/**
 * SpotMap — full-screen map with numbered spot pins and list toggle.
 *
 * Mobile/Tablet: react-native-maps with animated user-location dot,
 *   numbered spot pins, list-mode toggle, slide-up summary card on pin tap.
 * Web: side-by-side layout (map placeholder left, ranked list right).
 *   react-native-maps is not supported on web; we render a styled fallback.
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

  const initialRegion = {
    latitude: userLocation.lat,
    longitude: userLocation.lon,
    latitudeDelta: 3.0,
    longitudeDelta: 3.0,
  };

  const handlePinPress = useCallback((spot: DarkSpotSite) => {
    setSelectedSpot(spot);
  }, []);

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
          style={mapStyles.listScroll}
          contentContainerStyle={mapStyles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {spots.map((spot) => (
            <SpotCard
              key={spot.name + spot.lat}
              spot={spot}
              onPress={() => setSelectedSpot(spot)}
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

// --- Web fallback: relative position spots by lat/lon ---
const MAP_SIZE = 280; // px
const MAP_PAD = 24;   // px padding inside map area

function spotsToMapPositions(
  spots: DarkSpotSite[],
  userLat: number,
  userLon: number,
): (DarkSpotSite & { px: number; py: number })[] {
  if (spots.length === 0) return [];

  // Collect all lat/lon including user location
  const allLats = [userLat, ...spots.map((s) => s.lat)];
  const allLons = [userLon, ...spots.map((s) => s.lon)];
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLon = Math.min(...allLons);
  const maxLon = Math.max(...allLons);
  const latRange = maxLat - minLat || 0.1;
  const lonRange = maxLon - minLon || 0.1;
  const inner = MAP_SIZE - MAP_PAD * 2;

  return spots.map((s) => ({
    ...s,
    // x: left→right as lon increases; y: top→bottom as lat decreases
    px: ((s.lon - minLon) / lonRange) * inner + MAP_PAD,
    py: ((maxLat - s.lat) / latRange) * inner + MAP_PAD,
  }));
}

function userMapPosition(
  spots: DarkSpotSite[],
  userLat: number,
  userLon: number,
): { px: number; py: number } {
  const allLats = [userLat, ...spots.map((s) => s.lat)];
  const allLons = [userLon, ...spots.map((s) => s.lon)];
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLon = Math.min(...allLons);
  const maxLon = Math.max(...allLons);
  const latRange = maxLat - minLat || 0.1;
  const lonRange = maxLon - minLon || 0.1;
  const inner = MAP_SIZE - MAP_PAD * 2;
  return {
    px: ((userLon - minLon) / lonRange) * inner + MAP_PAD,
    py: ((maxLat - userLat) / latRange) * inner + MAP_PAD,
  };
}

function WebMapPlaceholder({ spots, userLocation, onViewDetails }: SpotMapProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const positioned = spotsToMapPositions(spots, userLocation.lat, userLocation.lon);
  const userPos = userMapPosition(spots, userLocation.lat, userLocation.lon);

  return (
    <View style={webStyles.container}>
      {/* Left: relative position map */}
      <View style={webStyles.mapArea}>
        <Text style={webStyles.mapLabel}>Dark Sky Map</Text>

        <View style={[webStyles.dotField, { width: MAP_SIZE, height: MAP_SIZE }]}>
          {/* User location dot */}
          <View
            style={[
              webStyles.userDot,
              { left: userPos.px - 6, top: userPos.py - 6 },
            ]}
          />

          {/* Spot dots */}
          {positioned.map((spot, i) => (
            <Pressable
              key={spot.name}
              style={[
                webStyles.spotDot,
                selectedIdx === i && webStyles.spotDotSelected,
                { left: spot.px - 14, top: spot.py - 14 },
              ]}
              onPress={() => setSelectedIdx(i === selectedIdx ? null : i)}
            >
              <Text style={[
                webStyles.spotDotText,
                selectedIdx === i && webStyles.spotDotTextSelected,
              ]}>
                {spot.rank ?? i + 1}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={webStyles.mapLegend}>
          <View style={webStyles.legendRow}>
            <View style={webStyles.userDotSmall} />
            <Text style={webStyles.legendText}>Your location</Text>
          </View>
          <View style={webStyles.legendRow}>
            <View style={webStyles.pinDotSmall} />
            <Text style={webStyles.legendText}>Dark sky spot</Text>
          </View>
        </View>
      </View>

      {/* Right: ranked list */}
      <ScrollView
        style={webStyles.listScroll}
        contentContainerStyle={webStyles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {spots.map((spot, i) => (
          <SpotCard
            key={spot.name + spot.lat}
            spot={spot}
            onPress={() => setSelectedIdx(i === selectedIdx ? null : i)}
            showViewDetails
            onViewDetails={onViewDetails}
          />
        ))}
        {spots.length === 0 && (
          <Text style={webStyles.emptyText}>No spots found in this area.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const webStyles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', gap: spacing['6xl'], padding: spacing['3xl'] },
  mapArea: {
    width: MAP_SIZE + spacing['6xl'],
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius['3xl'],
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    padding: spacing['3xl'],
    gap: spacing['3xl'],
    flexShrink: 0,
  },
  mapLabel: {
    ...typography.scale.label.large,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dotField: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius['2xl'],
    borderWidth: 1,
    borderColor: colors.border.default,
    position: 'relative',
    overflow: 'hidden',
  },
  userDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent.primary,
    borderWidth: 2,
    borderColor: colors.text.primary,
  },
  spotDot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.surface,
    borderWidth: 2,
    borderColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotDotSelected: {
    backgroundColor: colors.accent.primary,
  },
  spotDotText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  spotDotTextSelected: {
    color: colors.text.inverse,
  },
  mapLegend: {
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  userDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent.primary,
    borderWidth: 1.5,
    borderColor: colors.text.primary,
  },
  pinDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.background.surface,
    borderWidth: 1.5,
    borderColor: colors.accent.primary,
  },
  legendText: {
    ...typography.scale.caption.regular,
    fontSize: 11,
    color: colors.text.secondary,
  },
  listScroll: { flex: 1 },
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

// --- Main export ---
export default function SpotMap(props: SpotMapProps) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' || width >= breakpoints.web;

  if (isWeb) {
    return <WebMapPlaceholder {...props} />;
  }
  return <NativeMap {...props} />;
}
