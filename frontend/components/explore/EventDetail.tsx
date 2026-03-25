import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography, breakpoints } from '@/constants/theme';
import { CelestialEvent, ConditionsResponse, EventType, fetchConditions } from '@/services/api';
import { useContextStore } from '@/store/context';
import { useChatUIStore } from '@/store/chat';


const EVENT_ICONS: Record<EventType, string> = {
  meteor_shower: '☄️',
  eclipse:       '🌑',
  moon:          '🌕',
  planet:        '🪐',
  milky_way:     '🌌',
};

const EVENT_DESCRIPTIONS: Record<EventType, string> = {
  meteor_shower: 'Best viewed lying flat under dark skies, no equipment needed. Peak activity occurs in the hours after midnight. Give your eyes 20 minutes to adjust to the dark.',
  eclipse:       'A rare celestial alignment. Totality lasts only minutes — arrive early and find a clear horizon. Check visibility for your exact location.',
  moon:          'Moon phases affect all night sky viewing. A new moon means darker skies for deep sky objects. A full moon illuminates the landscape beautifully.',
  planet:        'Planets are bright enough to see with the naked eye. Look for steady light that does not twinkle. A pair of binoculars reveals detail.',
  milky_way:     'The Milky Way galactic core is visible from dark sites May–September. Look south after astronomical twilight ends. Requires Bortle 4 or better.',
};

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

interface VisibilityFactor {
  label: string;
  value: string;
  status: 'good' | 'moderate' | 'poor' | 'unknown';
}

function VisibilityRow({ factor }: { factor: VisibilityFactor }) {
  const dotColor =
    factor.status === 'good' ? colors.status.good :
    factor.status === 'moderate' ? colors.status.moderate :
    factor.status === 'poor' ? colors.status.poor :
    colors.text.disabled;

  return (
    <View style={visStyles.row}>
      <View style={[visStyles.dot, { backgroundColor: dotColor }]} />
      <Text style={visStyles.label}>{factor.label}</Text>
      <Text style={[visStyles.value, { color: dotColor }]}>{factor.value}</Text>
    </View>
  );
}

const visStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    flex: 1,
  },
  value: {
    ...typography.scale.label.medium,
  },
});

interface EventDetailProps {
  event: CelestialEvent;
}

export default function EventDetail({ event }: EventDetailProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = width >= breakpoints.web;
  const insets = useSafeAreaInsets();
  const setActiveEvent = useContextStore((s) => s.setActiveEvent);
  const setDate = useContextStore((s) => s.setDate);
  const setTab = useContextStore((s) => s.setTab);
  const openChat = useChatUIStore((s) => s.open);
  const location = useContextStore((s) => s.location);
  const spots = useContextStore((s) => s.spots);

  const [visLoading, setVisLoading] = useState(false);
  const [visConditions, setVisConditions] = useState<ConditionsResponse | null>(null);

  const isHistorical = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.date + 'T00:00:00');
    return Math.round((eventDate.getTime() - today.getTime()) / 86400000) > 16;
  })();
  const eventMonth = new Date(event.date + 'T00:00:00').toLocaleString('en-US', { month: 'long' });

  useEffect(() => {
    if (!location) return;
    setVisLoading(true);
    const tz = location.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetchConditions(location.lat, location.lon, event.date, tz)
      .then((res) => setVisConditions(res))
      .catch(() => { /* keep Unknown on error */ })
      .finally(() => setVisLoading(false));
  }, [location?.lat, location?.lon, event.date]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibilityFactors: VisibilityFactor[] = useMemo(() => {
    if (!visConditions) return [
      { label: 'Visible from location', value: 'Unknown', status: 'unknown' },
      { label: 'Moon interference',     value: 'Unknown', status: 'unknown' },
      { label: 'Forecast',              value: 'Unknown', status: 'unknown' },
      { label: 'Bortle rating',         value: 'Unknown', status: 'unknown' },
    ];

    // Moon interference
    const moonPct = visConditions.moon?.illumination ?? 0;
    const moonStatus: VisibilityFactor['status'] =
      moonPct < 25 ? 'good' : moonPct < 75 ? 'moderate' : 'poor';

    // Forecast — amber dot + "Typically X" label when showing historical averages
    const forecastLabel = visConditions.label;
    const forecastValue = isHistorical
      ? `Typically ${forecastLabel} (historical avg)`
      : forecastLabel;
    const forecastStatus: VisibilityFactor['status'] = isHistorical
      ? 'moderate'
      : forecastLabel === 'Excellent' || forecastLabel === 'Good' ? 'good' :
        forecastLabel === 'Fair' ? 'moderate' : 'poor';

    // Bortle — top ranked spot from stargaze context (if any)
    const topSpot = spots?.[0];
    const bortleValue = topSpot?.bortle_estimate != null
      ? `Bortle ${topSpot.bortle_estimate}`
      : 'Set a dark sky spot to see this';
    const bortleStatus: VisibilityFactor['status'] = topSpot?.bortle_estimate != null
      ? topSpot.bortle_estimate <= 3 ? 'good' : topSpot.bortle_estimate <= 5 ? 'moderate' : 'poor'
      : 'unknown';

    return [
      { label: 'Visible from location', value: 'Yes',          status: 'good' },
      { label: 'Moon interference',     value: `${moonPct}% illuminated`, status: moonStatus },
      { label: 'Forecast',              value: forecastValue,  status: forecastStatus },
      { label: 'Bortle rating',         value: bortleValue,    status: bortleStatus },
    ];
  }, [visConditions, spots, isHistorical]);

  const handleFindDarkSkies = () => {
    setActiveEvent({ name: event.name, date: event.date, type: event.type });
    setDate(event.date);
    setTab('stargaze');
    router.replace('/(tabs)/stargaze');
  };

  const handleAskAI = () => {
    setActiveEvent({ name: event.name, date: event.date, type: event.type });
    openChat();
  };

  const description = event.description ?? EVENT_DESCRIPTIONS[event.type];

  const mainContent = (
    <>
      {/* Illustration / icon hero */}
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>{EVENT_ICONS[event.type]}</Text>
      </View>

      {/* Description section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {/* Eclipse note + NASA link — eclipse events only */}
      {event.type === 'eclipse' && (
        <View style={styles.eclipseNote}>
          <Text style={styles.eclipseNoteText}>
            Eclipse visibility varies by location. Your position determines whether you see a total, partial, or no eclipse.
          </Text>
          <Pressable onPress={() => Linking.openURL('https://eclipse.gsfc.nasa.gov')} style={styles.eclipseLink}>
            <Text style={styles.eclipseLinkText}>View eclipse path and totality map →</Text>
          </Pressable>
        </View>
      )}

      {/* Visibility section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visibility from your location</Text>
        {isHistorical && (
          <View style={styles.historicalBanner}>
            <Text style={styles.historicalIcon}>📅</Text>
            <Text style={styles.historicalText}>
              Based on historical averages for {eventMonth} — live forecast unavailable this far ahead
            </Text>
          </View>
        )}
        <View style={styles.visibilityCard}>
          {visLoading ? (
            <View style={styles.visLoadingWrap}>
              <ActivityIndicator color={colors.accent.primary} size="small" />
            </View>
          ) : (
            visibilityFactors.map((f) => (
              <VisibilityRow key={f.label} factor={f} />
            ))
          )}
        </View>
      </View>
    </>
  );

  const ctaSection = (
    <View style={styles.ctaSection}>
      <Pressable style={styles.ctaPrimary} onPress={handleFindDarkSkies}>
        <Text style={styles.ctaPrimaryText}>🔭  Find Dark Skies</Text>
      </Pressable>
      <Pressable style={styles.ctaSecondary} onPress={handleAskAI}>
        <Text style={styles.ctaSecondaryText}>✦  Ask AI about this event</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.eventName}>{event.name}</Text>
        <Text style={styles.eventDate}>{formatFullDate(event.date)}</Text>
      </View>

      {isWeb ? (
        // Two-column web layout
        <View style={styles.webLayout}>
          <ScrollView style={styles.webLeft} contentContainerStyle={styles.webLeftContent}>
            {mainContent}
          </ScrollView>
          <View style={styles.webRight}>
            {ctaSection}
          </View>
        </View>
      ) : (
        // Single-column mobile/tablet
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: spacing['7xl'] + insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {mainContent}
          {ctaSection}
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
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    marginLeft: -spacing.md,
  },
  backIcon: {
    fontSize: 22,
    color: colors.text.primary,
    lineHeight: 22,
  },
  backText: {
    ...typography.scale.label.large,
    color: colors.text.primary,
  },
  titleRow: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['4xl'],
    gap: spacing.sm,
  },
  eventName: {
    ...typography.scale.heading.large,
    color: colors.text.primary,
  },
  eventDate: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['7xl'],
    gap: spacing['4xl'],
  },

  // Hero
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius['3xl'],
    marginBottom: spacing.md,
  },
  heroIcon: {
    fontSize: 72,
  },

  // Sections
  section: {
    gap: spacing.xl,
  },
  sectionTitle: {
    ...typography.scale.label.large,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  description: {
    ...typography.scale.body.medium,
    color: colors.text.primary,
    lineHeight: 24,
  },
  visibilityCard: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing['3xl'],
    overflow: 'hidden',
  },
  visLoadingWrap: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  historicalBanner: {
    flexDirection: 'row',
    gap: spacing.xl,
    backgroundColor: 'rgba(253,230,138,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.2)',
    borderRadius: borderRadius.xl,
    padding: spacing['3xl'],
    alignItems: 'flex-start',
  },
  historicalIcon: { fontSize: 16, lineHeight: 20 },
  historicalText: {
    flex: 1,
    fontSize: 13,
    color: colors.celestial.glow,
    lineHeight: 18,
  },

  // CTA
  ctaSection: {
    gap: spacing.xl,
    marginTop: spacing['4xl'],
  },
  ctaPrimary: {
    backgroundColor: colors.accent.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    ...typography.scale.label.large,
    color: colors.text.inverse,
  },
  ctaSecondary: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    ...typography.scale.label.large,
    color: colors.celestial.ai,
  },

  // Eclipse note
  eclipseNote: {
    backgroundColor: 'rgba(99,102,241,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    gap: spacing.xl,
  },
  eclipseNoteText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  eclipseLink: {
    alignSelf: 'flex-start',
  },
  eclipseLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent.secondary,
  },

  // Web layout
  webLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing['6xl'],
    paddingHorizontal: spacing['6xl'],
  },
  webLeft: {
    flex: 1,
  },
  webLeftContent: {
    gap: spacing['4xl'],
    paddingBottom: spacing['7xl'],
  },
  webRight: {
    width: 320,
    paddingTop: spacing['4xl'],
  },
});
