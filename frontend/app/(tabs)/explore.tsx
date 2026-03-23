import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography, breakpoints } from '@/constants/theme';
import { useContextStore } from '@/store/context';
import { useAutoDetectLocation } from '@/components/shared/LocationPicker';
import LocationPicker from '@/components/shared/LocationPicker';
import MonthSection from '@/components/explore/MonthSection';
import { CelestialEvent, EventType, fetchEvents } from '@/services/api';
import LogoMark from '@/components/shared/LogoMark';



type FilterOption = 'all' | EventType;

const FILTER_OPTIONS: { id: FilterOption; label: string; icon: string }[] = [
  { id: 'all',           label: 'All',            icon: '✨' },
  { id: 'meteor_shower', label: 'Meteor Showers',  icon: '☄️' },
  { id: 'eclipse',       label: 'Eclipses',        icon: '🌑' },
  { id: 'moon',          label: 'Moon',            icon: '🌕' },
  { id: 'planet',        label: 'Planets',         icon: '🪐' },
  { id: 'milky_way',     label: 'Milky Way',       icon: '🌌' },
];

function groupByMonth(events: CelestialEvent[]): Map<string, CelestialEvent[]> {
  const map = new Map<string, CelestialEvent[]>();
  for (const event of events) {
    const d = new Date(event.date + 'T00:00:00');
    const key = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }
  return map;
}

function getCurrentMonthKey() {
  const d = new Date();
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function isPastMonth(monthKey: string) {
  const [month, year] = monthKey.split(' ');
  const d = new Date(`${month} 1, ${year}`);
  const now = new Date();
  return d.getFullYear() < now.getFullYear() ||
    (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth());
}

export default function ExploreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTabletOrWeb = width >= breakpoints.tablet;

  const location = useContextStore((s) => s.location);
  const { run: autoDetect } = useAutoDetectLocation();

  const [year, setYear] = useState(new Date().getFullYear());
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [showPast, setShowPast] = useState(false);
  const [events, setEvents] = useState<CelestialEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect location on mount
  useEffect(() => { autoDetect(); }, []);

  // Fetch events when location or year changes
  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchEvents(location, year)
      .then((res) => { if (!cancelled) setEvents(res.events); })
      .catch((err) => { if (!cancelled) setError(err.message ?? 'Failed to load events'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [location, year]);

  const filtered = useMemo(() =>
    activeFilter === 'all' ? events : events.filter((e) => e.type === activeFilter),
    [events, activeFilter]
  );

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);
  const currentMonthKey = getCurrentMonthKey();

  const handleEventPress = useCallback((event: CelestialEvent) => {
    router.push({ pathname: '/event-detail', params: { data: JSON.stringify(event) } });
  }, [router]);

  const handleAskAI = useCallback((_event: CelestialEvent) => {
    // Phase 4: open chat with event context pre-loaded
  }, []);

  const yearSelector = (
    <View style={styles.yearSelector}>
      {isTabletOrWeb ? (
        // Tablet/Web: all 3 years visible
        [year - 1, year, year + 1].map((y) => (
          <Pressable
            key={y}
            style={[styles.yearPill, y === year && styles.yearPillActive]}
            onPress={() => setYear(y)}
          >
            <Text style={[styles.yearPillText, y === year && styles.yearPillTextActive]}>{y}</Text>
          </Pressable>
        ))
      ) : (
        // Mobile: prev/next arrows
        <>
          <Pressable style={styles.yearArrow} onPress={() => setYear((y) => y - 1)}>
            <Text style={styles.yearArrowText}>‹</Text>
          </Pressable>
          <Text style={styles.yearValue}>{year}</Text>
          <Pressable style={styles.yearArrow} onPress={() => setYear((y) => y + 1)}>
            <Text style={styles.yearArrowText}>›</Text>
          </Pressable>
        </>
      )}
    </View>
  );

  const pillItems = FILTER_OPTIONS.map((opt) => (
    <Pressable
      key={opt.id}
      style={[styles.filterPill, activeFilter === opt.id && styles.filterPillActive]}
      onPress={() => setActiveFilter(opt.id)}
    >
      <Text style={styles.filterPillIcon}>{opt.icon}</Text>
      <Text style={[styles.filterPillText, activeFilter === opt.id && styles.filterPillTextActive]}>
        {opt.label}
      </Text>
    </Pressable>
  ));

  // Tablet/web: plain View so it doesn't consume flex height like a vertical ScrollView
  const filterPills = isTabletOrWeb ? (
    <View style={[styles.filterRow, styles.filterRowWrap, styles.filterRowWeb]}>
      {pillItems}
    </View>
  ) : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
      style={styles.filterScroll}
    >
      {pillItems}
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      {/* Screen header */}
      <View style={styles.header}>
        <LogoMark size="sm" showName />
        <LocationPicker compact />
      </View>

      {yearSelector}
      {filterPills}

      {/* Show past events toggle */}
      <Pressable style={styles.pastToggle} onPress={() => setShowPast((v) => !v)}>
        <View style={[styles.toggleDot, showPast && styles.toggleDotActive]} />
        <Text style={styles.pastToggleText}>Show past events</Text>
      </Pressable>

      {/* Event calendar */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.primary} size="large" />
          <Text style={styles.loadingText}>Loading events…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => {
              if (location) {
                setError(null);
                setLoading(true);
                fetchEvents(location, year)
                  .then((r) => setEvents(r.events))
                  .catch((e) => setError(e.message))
                  .finally(() => setLoading(false));
              }
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : !location ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Detecting your location…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: isTabletOrWeb ? spacing['5xl'] : spacing['3xl'] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {grouped.size === 0 ? (
            <Text style={styles.emptyText}>No events match this filter.</Text>
          ) : (
            Array.from(grouped.entries()).map(([month, monthEvents]) => {
              const past = isPastMonth(month);
              if (past && !showPast) return null;
              return (
                <MonthSection
                  key={month}
                  month={month}
                  events={monthEvents}
                  defaultExpanded={month === currentMonthKey}
                  onEventPress={handleEventPress}
                  onAskAI={handleAskAI}
                />
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['4xl'],
    paddingBottom: spacing['3xl'],
  },
  logoText: {
    ...typography.scale.heading.small,
    color: colors.accent.primary,
    letterSpacing: 0.5,
  },

  // Year selector
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing['3xl'],
    marginBottom: spacing['3xl'],
  },
  yearArrow: {
    padding: spacing.md,
  },
  yearArrowText: {
    fontSize: 22,
    color: colors.text.primary,
  },
  yearValue: {
    ...typography.scale.heading.medium,
    color: colors.text.primary,
    minWidth: 80,
    textAlign: 'center',
  },
  yearPill: {
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  yearPillActive: {
    backgroundColor: `rgba(212,120,10,0.12)`,
    borderColor: colors.accent.primary,
  },
  yearPillText: {
    ...typography.scale.label.large,
    color: colors.text.secondary,
  },
  yearPillTextActive: {
    color: colors.accent.primary,
  },

  // Filter pills
  filterScroll: {
    flexShrink: 0,
    flexGrow: 0,
    maxHeight: 52,
    overflow: 'hidden',
    marginBottom: spacing['3xl'],
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing['3xl'],
  },
  filterRowWrap: {
    flexWrap: 'wrap',
  },
  filterRowWeb: {
    marginBottom: spacing['3xl'],
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filterPillActive: {
    backgroundColor: `rgba(212,120,10,0.12)`,
    borderColor: colors.accent.primary,
  },
  filterPillIcon: {
    fontSize: 12,
  },
  filterPillText: {
    ...typography.scale.label.small,
    color: colors.text.secondary,
  },
  filterPillTextActive: {
    color: colors.accent.primary,
  },

  // Past toggle
  pastToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing['3xl'],
    marginBottom: spacing['3xl'],
  },
  toggleDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  toggleDotActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  pastToggleText: {
    ...typography.scale.label.small,
    color: colors.text.secondary,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['7xl'],
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
  emptyText: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
