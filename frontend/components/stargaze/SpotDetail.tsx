/**
 * SpotDetail — full conditions screen for a selected dark sky spot.
 *
 * Sections:
 *  1. Header — back button, spot name, Bortle / distance / certified badges
 *  2. Overall Score — animated score ring + label + "How is this calculated?" expandable
 *  3. 8 Conditions Factors — ConditionsRow per factor
 *  4. Moon Info — phase, illumination, rise/set times, best viewing window
 *  5. Getting There — distance, estimated drive time, Get Directions, View Website
 *  6. AI Take — auto-generated, loading state, "Ask a follow-up" link
 *  7. Historical Averages label when data_type === 'historical_average'
 *
 * Web layout (≥ 1280px): two-column
 *   Left:  conditions breakdown + moon
 *   Right: score + getting there + AI Take
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
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
import { useContextStore, ActiveSpot } from '@/store/context';
import { fetchConditions, ConditionsResponse } from '@/services/api';
import ConditionsRow from './ConditionsRow';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 85) return colors.status.good;
  if (score >= 70) return '#86EFAC'; // still good range
  if (score >= 50) return colors.status.moderate;
  return colors.status.poor;
}

function openDirections(lat: number, lon: number) {
  const url = Platform.select({
    ios: `maps://app?daddr=${lat},${lon}`,
    android: `google.navigation:q=${lat},${lon}`,
    default: `https://maps.google.com/?q=${lat},${lon}`,
  });
  if (url) Linking.openURL(url);
}

function estimateDriveTime(distKm: number): string {
  const hours = distKm / 80; // rough ~80 km/h average
  if (hours < 1) return `~${Math.round(hours * 60)} min drive`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `~${h}h ${m}min drive` : `~${h}h drive`;
}

// ---------------------------------------------------------------------------
// Score Ring (SVG on web, plain view on native)
// ---------------------------------------------------------------------------

interface ScoreRingProps {
  score: number;
  label: string;
}

function ScoreRing({ score, label }: ScoreRingProps) {
  const accent = scoreColor(score);

  if (Platform.OS === 'web') {
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    const filled = (score / 100) * circumference;
    const dashOffset = circumference - filled;

    return (
      <View style={ringStyles.container}>
        {/* @ts-ignore — SVG works on web React Native */}
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* @ts-ignore */}
          <circle cx="70" cy="70" r={radius} fill="none" stroke={colors.background.elevated} strokeWidth="8" />
          {/* @ts-ignore */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={accent}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 70 70)"
            style={{ filter: `drop-shadow(0 0 8px ${accent}80)` }}
          />
          {/* @ts-ignore */}
          <text x="70" y="65" textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 36, fontWeight: '700', fill: colors.text.primary, fontFamily: 'Space Grotesk, sans-serif' }}>
            {score}
          </text>
          {/* @ts-ignore */}
          <text x="70" y="90" textAnchor="middle"
            style={{ fontSize: 12, fill: colors.text.secondary, fontFamily: 'DM Sans, sans-serif' }}>
            / 100
          </text>
        </svg>
        <Text style={[ringStyles.label, { color: accent }]}>{label}</Text>
      </View>
    );
  }

  // Native: simple filled circle with number
  return (
    <View style={ringStyles.container}>
      <View style={[ringStyles.nativeRing, { borderColor: accent }]}>
        <Text style={[ringStyles.nativeScore, { color: accent }]}>{score}</Text>
        <Text style={ringStyles.nativeOf}>/ 100</Text>
      </View>
      <Text style={[ringStyles.label, { color: accent }]}>{label}</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  nativeRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.elevated,
  },
  nativeScore: {
    fontSize: 36,
    fontWeight: '700',
  },
  nativeOf: {
    fontSize: 12,
    color: colors.text.secondary,
  },
});

// ---------------------------------------------------------------------------
// Score Breakdown (expandable)
// ---------------------------------------------------------------------------

interface BreakdownProps {
  factors: ConditionsResponse['factors'];
}

function ScoreBreakdown({ factors }: BreakdownProps) {
  const [expanded, setExpanded] = useState(false);
  const animHeight = useRef(new Animated.Value(0)).current;

  const toggle = useCallback(() => {
    const toVal = expanded ? 0 : factors.length * 36;
    Animated.timing(animHeight, {
      toValue: toVal,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setExpanded((v) => !v);
  }, [expanded, factors.length, animHeight]);

  const totalMax = factors.reduce((s, f) => s + f.max_score, 0);

  return (
    <View style={bdStyles.wrap}>
      <Pressable style={bdStyles.toggle} onPress={toggle}>
        <Text style={bdStyles.toggleText}>
          How is this calculated? {expanded ? '▲' : '▼'}
        </Text>
      </Pressable>
      <Animated.View style={{ height: animHeight, overflow: 'hidden' }}>
        <View style={bdStyles.rows}>
          {factors.map((f) => {
            const fill = totalMax > 0 ? (f.score / totalMax) * 100 : 0;
            const labelColor = f.status === 'good' ? colors.status.good
              : f.status === 'moderate' ? colors.status.moderate : colors.status.poor;
            return (
              <View key={f.name} style={bdStyles.row}>
                <Text style={bdStyles.rowLabel} numberOfLines={1}>{f.name}</Text>
                <View style={bdStyles.barWrap}>
                  <View style={[bdStyles.barFill, { width: `${fill}%` as `${number}%`, backgroundColor: labelColor }]} />
                </View>
                <Text style={[bdStyles.rowScore, { color: labelColor }]}>
                  {f.score}/{f.max_score}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const bdStyles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  toggle: {
    alignSelf: 'flex-start',
  },
  toggleText: {
    ...typography.scale.label.medium,
    color: colors.accent.secondary,
  },
  rows: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 24,
  },
  rowLabel: {
    width: 120,
    fontSize: 12,
    color: colors.text.secondary,
  },
  barWrap: {
    flex: 1,
    height: 6,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.background.elevated,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: borderRadius.xs,
  },
  rowScore: {
    width: 36,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
});

// ---------------------------------------------------------------------------
// Moon Info section
// ---------------------------------------------------------------------------

interface MoonSectionProps {
  moon: ConditionsResponse['moon'];
}

function MoonSection({ moon }: MoonSectionProps) {
  return (
    <View style={moonStyles.card}>
      <View style={moonStyles.header}>
        <View style={moonStyles.iconWrap}>
          <Text style={moonStyles.icon}>🌙</Text>
        </View>
        <View style={moonStyles.titleWrap}>
          <Text style={moonStyles.phase}>{moon.phase}</Text>
          <Text style={moonStyles.illumination}>{moon.illumination}% illuminated</Text>
        </View>
      </View>

      <View style={moonStyles.timesRow}>
        <View style={moonStyles.timeCell}>
          <Text style={moonStyles.timeLabel}>RISES</Text>
          <Text style={moonStyles.timeValue}>{moon.rise_time}</Text>
        </View>
        <View style={moonStyles.timeCell}>
          <Text style={moonStyles.timeLabel}>SETS</Text>
          <Text style={moonStyles.timeValue}>{moon.set_time}</Text>
        </View>
      </View>

      <View style={moonStyles.tipRow}>
        <Text style={moonStyles.tipIcon}>✦</Text>
        <Text style={moonStyles.tipText}>{moon.best_viewing_window}</Text>
      </View>
    </View>
  );
}

const moonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    gap: spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3xl'],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(253,230,138,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    // moon glow
    shadowColor: colors.celestial.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: { fontSize: 22 },
  titleWrap: { flex: 1, gap: 2 },
  phase: {
    ...typography.scale.heading.small,
    fontSize: 16,
    color: colors.text.primary,
  },
  illumination: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
  },
  timesRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  timeCell: {
    flex: 1,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: Platform.OS === 'web' ? 'JetBrains Mono, monospace' : undefined,
  },
  tipRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: 'rgba(134,239,172,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(134,239,172,0.2)',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  tipIcon: {
    fontSize: 13,
    color: colors.status.good,
    lineHeight: 20,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: colors.status.good,
    lineHeight: 18,
  },
});

// ---------------------------------------------------------------------------
// AI Take section
// ---------------------------------------------------------------------------

interface AiTakeProps {
  text: string | null;
  loading: boolean;
}

function AiTake({ text, loading }: AiTakeProps) {
  return (
    <View style={aiStyles.card}>
      <View style={aiStyles.header}>
        <View style={aiStyles.iconWrap}>
          <Text style={aiStyles.icon}>✦</Text>
        </View>
        <Text style={aiStyles.title}>AI Take</Text>
        {loading && <ActivityIndicator size="small" color={colors.celestial.ai} />}
      </View>
      {loading && !text ? (
        <Text style={aiStyles.loading}>Generating recommendation…</Text>
      ) : (
        <Text style={aiStyles.body}>{text}</Text>
      )}
    </View>
  );
}

const aiStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    gap: spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 13, color: colors.celestial.ai },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.celestial.ai,
  },
  loading: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text.primary,
  },
});

// ---------------------------------------------------------------------------
// Getting There section
// ---------------------------------------------------------------------------

interface GettingThereProps {
  spot: ActiveSpot;
}

function GettingThere({ spot }: GettingThereProps) {
  const distLabel = spot.distance != null ? `${Math.round(spot.distance)} km away` : null;
  const driveTime = spot.distance != null ? estimateDriveTime(spot.distance) : null;

  return (
    <View style={gtStyles.card}>
      <Text style={gtStyles.sectionTitle}>GETTING THERE</Text>

      {(distLabel || driveTime) && (
        <View style={gtStyles.distRow}>
          <Text style={gtStyles.distIcon}>📍</Text>
          <View>
            {distLabel && <Text style={gtStyles.distMain}>{distLabel}</Text>}
            {driveTime && <Text style={gtStyles.distSub}>{driveTime}</Text>}
          </View>
        </View>
      )}

      <Pressable
        style={gtStyles.dirBtn}
        onPress={() => openDirections(spot.lat, spot.lon)}
        accessibilityLabel="Get Directions"
      >
        <Text style={gtStyles.dirBtnText}>🧭  Get Directions</Text>
      </Pressable>

      {spot.website && (
        <Pressable
          style={gtStyles.webBtn}
          onPress={() => Linking.openURL(spot.website!)}
          accessibilityLabel="View Website"
        >
          <Text style={gtStyles.webBtnText}>🔗  View Website</Text>
        </Pressable>
      )}
    </View>
  );
}

const gtStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    gap: spacing.xl,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
  },
  distIcon: { fontSize: 18, lineHeight: 22 },
  distMain: {
    ...typography.scale.label.large,
    color: colors.text.primary,
  },
  distSub: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
  },
  dirBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  dirBtnText: {
    ...typography.scale.label.large,
    color: colors.text.inverse,
  },
  webBtn: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  webBtnText: {
    ...typography.scale.label.large,
    color: colors.text.primary,
  },
});

// ---------------------------------------------------------------------------
// Main SpotDetail component
// ---------------------------------------------------------------------------

export default function SpotDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = width >= breakpoints.web;

  const spot = useContextStore((s) => s.active_spot);
  const date = useContextStore((s) => s.date);
  const setVisibilityConditions = useContextStore((s) => s.setVisibilityConditions);

  const [conditions, setConditions] = useState<ConditionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConditions = useCallback(async () => {
    if (!spot) return;
    setLoading(true);
    setError(null);
    try {
      // Derive timezone from spot location — backend would normally do this;
      // we send a placeholder and let the backend resolve it.
      // The API contract: { spot: {lat, lon}, date, timezone }
      // We derive timezone on backend from lat/lon via timezonefinder.
      // Frontend sends "UTC" as fallback — the tool will correct it internally.
      const observingDate = date ?? new Date().toISOString().slice(0, 10);
      const timezone = 'UTC'; // backend derives actual tz via timezonefinder
      const cond = await fetchConditions(spot.lat, spot.lon, observingDate, timezone);
      setConditions(cond);

      // 3B.5: update context visibility_conditions
      setVisibilityConditions({
        available: true,
        for_date: observingDate,
        for_location: { lat: spot.lat, lon: spot.lon },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load conditions');
    } finally {
      setLoading(false);
    }
  }, [spot, date, setVisibilityConditions]);

  useEffect(() => {
    loadConditions();
  }, [loadConditions]);

  if (!spot) {
    return (
      <View style={styles.screen}>
        <Pressable
          style={[styles.backBtn, { paddingTop: insets.top + spacing['3xl'] }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No spot selected.</Text>
        </View>
      </View>
    );
  }

  const distLabel = spot.distance != null ? `${Math.round(spot.distance)} km` : null;

  // ── Shared content blocks ────────────────────────────────────────────────

  const HeaderBadges = (
    <View style={styles.metaRow}>
      {spot.bortle != null && (
        <View style={styles.bortleTag}>
          <Text style={styles.bortleTagText}>Bortle {spot.bortle}</Text>
        </View>
      )}
      {spot.certified && (
        <View style={styles.certTag}>
          <Text style={styles.certTagText}>IDA Certified</Text>
        </View>
      )}
      {distLabel && <Text style={styles.distText}>{distLabel}</Text>}
    </View>
  );

  const HistoricalBanner = conditions?.data_type === 'historical_average' ? (
    <View style={styles.historicalBanner} testID="historical-averages-banner">
      <Text style={styles.historicalIcon}>📅</Text>
      <Text style={styles.historicalText}>
        Based on historical averages for{' '}
        {new Date((date ?? new Date().toISOString().slice(0, 10)) + 'T00:00:00').toLocaleString('en-US', { month: 'long' })}
        {' '}— live forecast unavailable this far ahead
      </Text>
    </View>
  ) : null;

  const ConditionsBlock = loading ? (
    <View style={styles.loadingBlock}>
      <ActivityIndicator color={colors.accent.primary} size="large" />
      <Text style={styles.loadingText}>Loading conditions…</Text>
    </View>
  ) : error ? (
    <View style={styles.errorBlock}>
      <Text style={styles.errorText}>{error}</Text>
      <Pressable style={styles.retryBtn} onPress={loadConditions}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  ) : conditions ? (
    <View style={styles.conditionsBlock} testID="conditions-block">
      {conditions.factors.map((f) => (
        <ConditionsRow key={f.name} factor={f} />
      ))}
    </View>
  ) : null;

  const ScoreBlock = conditions ? (
    <View style={styles.scoreBlock}>
      <ScoreRing score={conditions.score} label={conditions.label} />
      <ScoreBreakdown factors={conditions.factors} />
    </View>
  ) : loading ? (
    <View style={styles.loadingBlock}>
      <ActivityIndicator color={colors.accent.primary} />
    </View>
  ) : null;

  const MoonBlock = conditions?.moon ? (
    <MoonSection moon={conditions.moon} />
  ) : null;

  const AiBlock = (
    <AiTake
      text={conditions?.ai_take ?? null}
      loading={loading}
    />
  );

  const DirectionsBlock = (
    <GettingThere spot={spot} />
  );

  // ── Two-column web layout ────────────────────────────────────────────────

  if (isWeb) {
    return (
      <View style={styles.screen}>
        {/* Web header */}
        <View style={[styles.header, { paddingTop: Math.max(spacing['4xl'], insets.top + spacing.xl) }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={styles.spotName}>{spot.name}</Text>
            {HeaderBadges}
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.webScrollContent, { paddingBottom: insets.bottom + spacing['7xl'] }]}
          showsVerticalScrollIndicator={false}
        >
          {HistoricalBanner}

          <View style={styles.webColumns}>
            {/* Left — conditions */}
            <View style={styles.webLeft}>
              <Text style={styles.sectionLabel}>CONDITIONS</Text>
              {ConditionsBlock}
              {MoonBlock && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: spacing['4xl'] }]}>MOON</Text>
                  {MoonBlock}
                </>
              )}
            </View>

            {/* Right — score + directions + AI */}
            <View style={styles.webRight}>
              {ScoreBlock}
              {DirectionsBlock}
              {AiBlock}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Single-column mobile/tablet layout ──────────────────────────────────

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(spacing['4xl'], insets.top + spacing.xl) }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing['7xl'] + insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title section */}
        <View style={styles.titleSection}>
          <Text style={styles.spotName}>{spot.name}</Text>
          {HeaderBadges}
        </View>

        {HistoricalBanner}

        {/* Score */}
        {ScoreBlock}

        {/* 8 Conditions */}
        <View>
          <Text style={styles.sectionLabel}>CONDITIONS</Text>
          {ConditionsBlock}
        </View>

        {/* Moon */}
        {MoonBlock && (
          <View>
            <Text style={styles.sectionLabel}>MOON</Text>
            {MoonBlock}
          </View>
        )}

        {/* Getting There */}
        {DirectionsBlock}

        {/* AI Take */}
        {AiBlock}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3xl'],
  },
  headerTitle: {
    flex: 1,
    gap: spacing.xs,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    marginLeft: -spacing.md,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  backIcon: { fontSize: 22, color: colors.text.primary, lineHeight: 22 },
  backText: { ...typography.scale.label.large, color: colors.text.primary },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing['3xl'],
    gap: spacing['4xl'],
  },
  webScrollContent: {
    paddingHorizontal: spacing['6xl'],
    gap: spacing['4xl'],
  },

  titleSection: { gap: spacing.xl },
  spotName: {
    ...typography.scale.heading.large,
    color: colors.text.primary,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  bortleTag: {
    backgroundColor: 'rgba(253,230,138,0.1)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  bortleTagText: { fontSize: 12, fontWeight: '600', color: colors.celestial.glow },
  certTag: {
    backgroundColor: 'rgba(134,239,172,0.1)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  certTagText: { fontSize: 12, fontWeight: '600', color: colors.status.good },
  distText: { ...typography.scale.body.small, color: colors.text.secondary },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.xl,
  },

  scoreBlock: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    alignItems: 'center',
    gap: spacing['4xl'],
  },

  conditionsBlock: { gap: spacing.xl },

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

  loadingBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['6xl'],
    gap: spacing['3xl'],
  },
  loadingText: { ...typography.scale.body.small, color: colors.text.secondary },

  errorBlock: {
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
  retryText: { ...typography.scale.label.medium, color: colors.text.primary },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Web columns
  webColumns: {
    flexDirection: 'row',
    gap: spacing['6xl'],
    alignItems: 'flex-start',
  },
  webLeft: {
    flex: 3,
    gap: spacing['3xl'],
  },
  webRight: {
    flex: 2,
    gap: spacing['4xl'],
    minWidth: 280,
  },
});
