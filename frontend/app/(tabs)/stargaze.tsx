/**
 * Stargaze Tab Screen — Phase 3A
 *
 * Layout:
 *   Header:         Location picker + Date picker
 *   Planning banner: "Planning for: [event]" if arriving from Explore
 *   What's Visible: Moon / Meteor Showers / Planets / Milky Way (MVP)
 *   Find Dark Skies CTA → distance picker modal → POST /api/spots → SpotMap
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography, breakpoints } from '@/constants/theme';
import { useContextStore, DarkSpotSite } from '@/store/context';
import LocationPicker from '@/components/shared/LocationPicker';
import DatePicker from '@/components/shared/DatePicker';
import SpotMap from '@/components/stargaze/SpotMap';
import { fetchSpots } from '@/services/api';
import { useRouter } from 'expo-router';

// ISO date helper
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- Distance option chips ---
const DISTANCE_OPTIONS = [20, 50, 80, 150, 200, 300];

// --- What's Visible items (MVP static + event-aware) ---
interface VisibleData {
  icon: string;
  label: string;
  detail: string;
}

function buildVisibleItems(
  selectedDate: string,
  activeEventName?: string | null,
): VisibleData[] {
  const d = new Date(selectedDate + 'T00:00:00');
  const month = d.getMonth() + 1; // 1-12

  // Milky Way seasonal window (Northern Hemisphere; April–September core visible)
  const milkyWayVisible = month >= 4 && month <= 10;
  const milkyWayDetail = milkyWayVisible
    ? 'Galactic core visible after astronomical twilight. Look south.'
    : 'Below the horizon — best viewed April through October.';

  const items: VisibleData[] = [
    {
      icon: '🌙',
      label: 'Moon',
      detail: 'Phase and rise/set times loaded with conditions (Phase 3B).',
    },
    {
      icon: '🌌',
      label: 'Milky Way',
      detail: milkyWayDetail,
    },
    {
      icon: '🪐',
      label: 'Planets',
      detail: 'Jupiter and Saturn visible in the evening sky. Mars rising after midnight.',
    },
  ];

  // If an active event is a meteor shower, highlight it
  if (activeEventName) {
    items.unshift({
      icon: '☄️',
      label: activeEventName,
      detail: 'Peak activity tonight. Best viewing after midnight under dark skies.',
    });
  } else {
    // Generic meteor shower note
    const showerMonth = month >= 7 && month <= 8;
    if (showerMonth) {
      items.unshift({
        icon: '☄️',
        label: 'Meteor Showers',
        detail: 'Perseid season (July–August). Up to 100 meteors/hour at peak.',
      });
    }
  }

  return items;
}

function VisibleItem({ item }: { item: VisibleData }) {
  return (
    <View style={visStyles.row}>
      <Text style={visStyles.icon}>{item.icon}</Text>
      <View style={visStyles.text}>
        <Text style={visStyles.label}>{item.label}</Text>
        <Text style={visStyles.detail}>{item.detail}</Text>
      </View>
    </View>
  );
}

const visStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing['3xl'],
    alignItems: 'flex-start',
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  icon: { fontSize: 22, lineHeight: 28 },
  text: { flex: 1, gap: spacing.xs },
  label: {
    ...typography.scale.label.large,
    color: colors.text.primary,
  },
  detail: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});

// --- Distance Picker Modal ---
interface DistanceModalProps {
  visible: boolean;
  distance: number;
  onDistanceChange: (d: number) => void;
  onSearch: () => void;
  onClose: () => void;
}

function DistanceModal({ visible, distance, onDistanceChange, onSearch, onClose }: DistanceModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={modalStyles.backdrop} onPress={onClose} />
      <View style={modalStyles.sheet}>
        <View style={modalStyles.handle} />
        <Text style={modalStyles.title}>Search Radius</Text>
        <Text style={modalStyles.subtitle}>
          Find dark sky spots within this distance from your location
        </Text>

        <View style={modalStyles.options}>
          {DISTANCE_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              style={[modalStyles.option, distance === opt && modalStyles.optionActive]}
              onPress={() => onDistanceChange(opt)}
            >
              <Text style={[modalStyles.optionText, distance === opt && modalStyles.optionTextActive]}>
                {opt} km
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={modalStyles.searchBtn} onPress={onSearch}>
          <Text style={modalStyles.searchBtnText}>🔭  Search</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,5,8,0.7)',
  },
  sheet: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: colors.border.default,
    padding: spacing['3xl'],
    gap: spacing['3xl'],
    paddingBottom: spacing['7xl'],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.background.elevated,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.scale.heading.small,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  option: {
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  optionActive: {
    backgroundColor: 'rgba(212,120,10,0.12)',
    borderColor: colors.accent.primary,
  },
  optionText: {
    ...typography.scale.label.medium,
    color: colors.text.secondary,
  },
  optionTextActive: {
    color: colors.accent.primary,
  },
  searchBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  searchBtnText: {
    ...typography.scale.label.large,
    color: colors.text.inverse,
  },
});

// --- Main Screen ---
export default function StargazeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTabletOrWeb = width >= breakpoints.tablet;
  const isWeb = width >= breakpoints.web;
  const insets = useSafeAreaInsets();

  const location = useContextStore((s) => s.location);
  const activeEvent = useContextStore((s) => s.active_event);
  const contextDate = useContextStore((s) => s.date);
  const setSpots = useContextStore((s) => s.setSpots);
  const setActiveSpot = useContextStore((s) => s.setActiveSpot);
  const triggerSpotSearch = useContextStore((s) => s.trigger_spot_search);
  const setTriggerSpotSearch = useContextStore((s) => s.setTriggerSpotSearch);

  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [distanceKm, setDistanceKm] = useState(80);
  const [modalVisible, setModalVisible] = useState(false);
  const [spots, setLocalSpots] = useState<DarkSpotSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotsShown, setSpotsShown] = useState(false);

  // If arriving from Explore with context date set, use it
  useEffect(() => {
    if (contextDate) setSelectedDate(contextDate);
  }, [contextDate]);

  // Auto-trigger search when arriving from Explore with active_event.
  // distanceKm is intentionally excluded — we want the initial default (80km),
  // not to re-run every time the user adjusts the slider.
  const autoTriggered = useRef(false);
  useEffect(() => {
    if (activeEvent && location && !autoTriggered.current) {
      autoTriggered.current = true;
      doSearch(80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent, location]);

  // Auto-trigger search when the AI chat action card sends the user to this tab.
  useEffect(() => {
    if (triggerSpotSearch && location) {
      setTriggerSpotSearch(false);
      doSearch(distanceKm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSpotSearch]);

  const doSearch = useCallback(async (km: number) => {
    if (!location) return;
    setLoading(true);
    setError(null);
    setModalVisible(false);
    try {
      const res = await fetchSpots(
        location,
        selectedDate,
        activeEvent?.type,
        km,
      );
      setLocalSpots(res.spots);
      setSpots(res.spots);
      setSpotsShown(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to find dark sky spots';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [location, selectedDate, activeEvent, setSpots]);

  const handleSearch = useCallback(() => {
    doSearch(distanceKm);
  }, [doSearch, distanceKm]);

  const handleViewDetails = useCallback((_spot: DarkSpotSite) => {
    setActiveSpot({
      name: _spot.name,
      lat: _spot.lat,
      lon: _spot.lon,
      bortle: _spot.bortle_estimate,
      distance: _spot.distance,
      certified: _spot.certified,
      website: _spot.website,
    });
    router.push('/spot-detail');
  }, [setActiveSpot, router]);

  const visibleItems = useMemo(
    () => buildVisibleItems(selectedDate, activeEvent?.name),
    [selectedDate, activeEvent],
  ) as VisibleData[];

  return (
    <View style={styles.screen}>
      {/* Header — hidden on web (≥1280px) where WebHeader in _layout.tsx takes over */}
      {!isWeb && (
        <View style={[
          styles.header,
          isTabletOrWeb && styles.headerTablet,
          { paddingTop: Math.max(spacing['4xl'], insets.top + spacing.xl) },
        ]}>
          <View style={styles.headerLeft}>
            <Text style={styles.logoText}>⭐ Stargaze</Text>
            {activeEvent && (
              <Text style={styles.planningBanner}>
                Planning for: {activeEvent.name}
              </Text>
            )}
          </View>
          <LocationPicker compact />
        </View>
      )}

      {/* Date picker */}
      <View style={[styles.datePicker, isTabletOrWeb && styles.datePickerTablet]}>
        <DatePicker value={selectedDate} onChange={setSelectedDate} />
      </View>

      {/* Spot map fills remaining space when spots loaded */}
      {spotsShown && location ? (
        <View style={styles.mapContainer}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.accent.primary} size="large" />
              <Text style={styles.loadingText}>Finding dark skies…</Text>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={handleSearch}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
              <Pressable onPress={() => setSpotsShown(false)}>
                <Text style={styles.backLink}>← Back</Text>
              </Pressable>
            </View>
          ) : spots.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>🌌</Text>
              <Text style={styles.emptyTitle}>No spots found nearby</Text>
              <Text style={styles.emptyText}>
                Try increasing the search radius or choosing a different location.
              </Text>
              <Pressable
                style={styles.retryBtn}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.retryText}>Adjust distance</Text>
              </Pressable>
            </View>
          ) : (
            <SpotMap
              spots={spots}
              userLocation={location}
              onViewDetails={handleViewDetails}
            />
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            isTabletOrWeb && { paddingHorizontal: spacing['5xl'] },
            { paddingBottom: spacing['7xl'] + insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* What's Visible Tonight */}          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{"What's Visible Tonight"}</Text>
            <View style={styles.visibleCard}>
              {visibleItems.map((item) => (
                <VisibleItem key={item.label} item={item} />
              ))}
            </View>
          </View>

          {/* Find Dark Skies CTA */}
          {!location ? (
            <View style={styles.noLocation}>
              <Text style={styles.noLocationText}>Detecting your location…</Text>
            </View>
          ) : (
            <Pressable
              style={styles.findBtn}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.findBtnText}>🌑  Find Dark Skies</Text>
            </Pressable>
          )}

          {loading && (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.accent.primary} size="large" />
              <Text style={styles.loadingText}>Finding dark skies…</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={handleSearch}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* Distance picker modal */}
      <DistanceModal
        visible={modalVisible}
        distance={distanceKm}
        onDistanceChange={setDistanceKm}
        onSearch={handleSearch}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['4xl'],
    paddingBottom: spacing['3xl'],
    gap: spacing['3xl'],
  },
  headerTablet: {
    paddingHorizontal: spacing['5xl'],
  },
  headerLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  logoText: {
    ...typography.scale.heading.small,
    color: colors.accent.primary,
    letterSpacing: 0.5,
  },
  planningBanner: {
    ...typography.scale.label.medium,
    color: colors.celestial.glow,
  },

  // Date picker
  datePicker: {
    paddingHorizontal: spacing['3xl'],
    marginBottom: spacing['3xl'],
  },
  datePickerTablet: {
    paddingHorizontal: spacing['5xl'],
    maxWidth: 340,
  },

  // Map container
  mapContainer: {
    flex: 1,
  },

  // Scroll content
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['7xl'],
    gap: spacing['4xl'],
  },

  // Section
  section: { gap: spacing.xl },
  sectionTitle: {
    ...typography.scale.label.large,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  visibleCard: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius['3xl'],
    paddingHorizontal: spacing['3xl'],
    overflow: 'hidden',
  },

  // Find button
  findBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing['4xl'],
    alignItems: 'center',
    marginTop: spacing.md,
  },
  findBtnText: {
    ...typography.scale.label.large,
    color: colors.text.inverse,
    fontSize: 16,
  },

  // States
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['3xl'],
    padding: spacing['6xl'],
  },
  loadingText: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
  },
  errorBox: {
    alignItems: 'center',
    gap: spacing['3xl'],
    padding: spacing['3xl'],
  },
  errorText: {
    ...typography.scale.body.small,
    color: colors.status.poor,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing.xl,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
  },
  retryText: {
    ...typography.scale.label.medium,
    color: colors.text.primary,
  },
  backLink: {
    ...typography.scale.label.medium,
    color: colors.accent.secondary,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    ...typography.scale.heading.small,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  noLocation: {
    padding: spacing['4xl'],
    alignItems: 'center',
  },
  noLocationText: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
  },
});
