import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ExpoLocation from 'expo-location';
import { useContextStore, Location } from '@/store/context';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';



interface LocationPickerProps {
  /** When true, renders only the tappable header chip — sheet opens on press */
  compact?: boolean;
}

// Timezone → city fallback map (approximate centres)
const TIMEZONE_FALLBACK: Record<string, { name: string; lat: number; lon: number }> = {
  'America/New_York':    { name: 'New York, NY',    lat: 40.71, lon: -74.01 },
  'America/Chicago':     { name: 'Chicago, IL',     lat: 41.88, lon: -87.63 },
  'America/Denver':      { name: 'Denver, CO',      lat: 39.74, lon: -104.98 },
  'America/Los_Angeles': { name: 'Los Angeles, CA', lat: 34.05, lon: -118.24 },
  'America/Phoenix':     { name: 'Phoenix, AZ',     lat: 33.45, lon: -112.07 },
  'America/Anchorage':   { name: 'Anchorage, AK',   lat: 61.22, lon: -149.90 },
  'Pacific/Honolulu':    { name: 'Honolulu, HI',    lat: 21.31, lon: -157.86 },
  'Europe/London':       { name: 'London, UK',      lat: 51.51, lon: -0.13  },
  'Europe/Paris':        { name: 'Paris, France',   lat: 48.85, lon: 2.35   },
  'Asia/Tokyo':          { name: 'Tokyo, Japan',    lat: 35.68, lon: 139.69 },
  'Australia/Sydney':    { name: 'Sydney, AU',      lat: -33.87, lon: 151.21 },
};

async function detectViaIP(): Promise<Location | null> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.latitude || !data.longitude) return null;
    return {
      lat: data.latitude,
      lon: data.longitude,
      name: data.city ? `${data.city}, ${data.region_code ?? data.country_code}` : undefined,
      source: 'ip',
    };
  } catch {
    return null;
  }
}

function detectViaTimezone(): Location | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fallback = TIMEZONE_FALLBACK[tz];
    if (!fallback) return null;
    return { ...fallback, source: 'timezone' };
  } catch {
    return null;
  }
}

export function useAutoDetectLocation() {
  const setLocation = useContextStore((s) => s.setLocation);
  const location = useContextStore((s) => s.location);

  const run = useCallback(async () => {
    if (location) return; // already have one

    // 1. GPS
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        const [geocode] = await ExpoLocation.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }).catch(() => [null]);
        const name = geocode
          ? [geocode.city, geocode.region].filter(Boolean).join(', ')
          : undefined;
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, name, source: 'gps' });
        return;
      }
    } catch { /* permission denied or unavailable — fall through */ }

    // 2. IP geolocation
    const ipLoc = await detectViaIP();
    if (ipLoc) { setLocation(ipLoc); return; }

    // 3. Timezone mapping
    const tzLoc = detectViaTimezone();
    if (tzLoc) { setLocation(tzLoc); return; }

    // 4. No automatic detection succeeded — UI shows manual search
  }, [location, setLocation]);

  return { run };
}

export default function LocationPicker({ compact = true }: LocationPickerProps) {
  const location = useContextStore((s) => s.location);
  const setLocation = useContextStore((s) => s.setLocation);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = location?.name ?? (location ? `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}` : 'Set location');

  // Fix 6.2: Nominatim fuzzy geocoding — handles partial names like "Atacama"
  const searchCities = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'NightQuest/1.0' } }
      );
      const data = await res.json();
      const items: Location[] = (data ?? []).map((r: any) => ({
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        name: r.display_name,
        source: 'manual' as const,
      }));
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => searchCities(query), 500); // 500ms debounce
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, searchCities]);

  // Fix 6.5: auto-detect current location (used from planning mode banner)
  const handleAutoDetect = useCallback(async () => {
    setSheetOpen(false);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        const [geocode] = await ExpoLocation.reverseGeocodeAsync({
          latitude: pos.coords.latitude, longitude: pos.coords.longitude,
        }).catch(() => [null]);
        const name = geocode ? [geocode.city, geocode.region].filter(Boolean).join(', ') : undefined;
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, name, source: 'gps' });
        return;
      }
    } catch { /* permission denied — fall through */ }
    const ipLoc = await detectViaIP();
    if (ipLoc) { setLocation(ipLoc); return; }
    const tzLoc = detectViaTimezone();
    if (tzLoc) setLocation(tzLoc);
  }, [setLocation]);

  const selectLocation = (loc: Location) => {
    setLocation(loc);
    setSheetOpen(false);
    setQuery('');
    setResults([]);
  };

  const isManual = location?.source === 'manual';

  return (
    <>
      <Pressable style={[styles.chip, isManual && styles.chipManual]} onPress={() => setSheetOpen(true)}>
        <Text style={styles.pinIcon}>{isManual ? '📌' : '📍'}</Text>
        <View style={styles.chipTextWrap}>
          {isManual && <Text style={styles.viewingFromLabel}>VIEWING FROM</Text>}
          <Text style={styles.chipText} numberOfLines={1}>{displayName}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Modal
        visible={sheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Choose Location</Text>
          {isManual && (
            <View style={styles.planningBanner}>
              <Text style={styles.planningText}>
                You are planning from this location. Tap below to use your current location instead.
              </Text>
              <Pressable style={styles.planningBtn} onPress={handleAutoDetect}>
                <Text style={styles.planningBtnText}>📍  Use my current location</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Search city or place…"
              placeholderTextColor={colors.text.secondary}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {searching && <ActivityIndicator size="small" color={colors.accent.primary} style={styles.inputSpinner} />}
          </View>

          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {results.length === 0 && query.length >= 2 && !searching && (
              <Text style={styles.noResults}>No results for &quot;{query}&quot;</Text>
            )}
            {results.map((loc, i) => (
              <Pressable key={i} style={styles.resultItem} onPress={() => selectLocation(loc)}>
                <Text style={styles.resultName}>{loc.name}</Text>
                <Text style={styles.resultCoords}>{loc.lat.toFixed(2)}, {loc.lon.toFixed(2)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.full,
    maxWidth: 200,
  },
  chipManual: {
    borderColor: 'rgba(253,186,116,0.5)',
    backgroundColor: 'rgba(253,186,116,0.06)',
  },
  pinIcon: {
    fontSize: 12,
  },
  chipTextWrap: {
    flex: 1,
  },
  viewingFromLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: 'rgb(251,146,60)',
    textTransform: 'uppercase',
    lineHeight: 10,
  },
  chipText: {
    ...typography.scale.label.medium,
    color: colors.text.primary,
  },
  chevron: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  planningBanner: {
    backgroundColor: 'rgba(253,186,116,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(253,186,116,0.3)',
    borderRadius: borderRadius.xl,
    padding: spacing['3xl'],
    gap: spacing.xl,
    marginBottom: spacing['3xl'],
  },
  planningText: {
    fontSize: 13,
    color: 'rgb(251,146,60)',
    lineHeight: 18,
  },
  planningBtn: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  planningBtnText: {
    ...typography.scale.label.medium,
    color: colors.text.primary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['7xl'],
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border.default,
    alignSelf: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing['4xl'],
  },
  sheetTitle: {
    ...typography.scale.heading.small,
    color: colors.text.primary,
    marginBottom: spacing['3xl'],
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing['3xl'],
    marginBottom: spacing['3xl'],
  },
  input: {
    flex: 1,
    height: 44,
    ...typography.scale.body.medium,
    color: colors.text.primary,
  },
  inputSpinner: {
    marginLeft: spacing.md,
  },
  results: {
    flex: 1,
  },
  noResults: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing['4xl'],
  },
  resultItem: {
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  resultName: {
    ...typography.scale.label.large,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  resultCoords: {
    ...typography.scale.mono.small,
    color: colors.text.secondary,
  },
});
