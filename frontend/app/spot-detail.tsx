/**
 * Spot Detail route — stub for Phase 3A.
 * Shows basic spot info from context.active_spot.
 * Full 8-factor conditions, AI Take, and directions are built in Phase 3B
 * via components/stargaze/SpotDetail.tsx.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useContextStore } from '@/store/context';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

export default function SpotDetailRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const spot = useContextStore((s) => s.active_spot);

  if (!spot) {
    return (
      <View style={styles.screen}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No spot selected.</Text>
        </View>
      </View>
    );
  }

  const distLabel = spot.distance != null
    ? `${Math.round(spot.distance)} km away`
    : null;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing['3xl'] }]}>
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
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🌌</Text>
        </View>

        {/* Spot name + meta */}
        <View style={styles.titleSection}>
          <Text style={styles.spotName}>{spot.name}</Text>
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
            {distLabel && (
              <Text style={styles.distText}>{distLabel}</Text>
            )}
          </View>
        </View>

        {/* Coordinates */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>COORDINATES</Text>
          <Text style={styles.cardValue}>
            {spot.lat.toFixed(4)}°, {spot.lon.toFixed(4)}°
          </Text>
        </View>

        {/* Coming soon notice */}
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonIcon}>✦</Text>
          <View style={styles.comingSoonText}>
            <Text style={styles.comingSoonTitle}>Full Conditions Coming Soon</Text>
            <Text style={styles.comingSoonBody}>
              Weather forecast, moon phase, seeing conditions, AI recommendation,
              and directions will be available in the next update.
            </Text>
          </View>
        </View>

        {spot.website && (
          <Pressable
            style={styles.card}
            onPress={() => Linking.openURL(spot.website!)}
          >
            <Text style={styles.cardLabel}>WEBSITE</Text>
            <Text style={[styles.cardLink, styles.cardLinkTappable]}>{spot.website}</Text>
            <Text style={styles.cardLinkHint}>Tap to open ↗</Text>
          </Pressable>
        )}
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
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    marginLeft: -spacing.md,
    alignSelf: 'flex-start',
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing['3xl'],
    gap: spacing['4xl'],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.scale.body.medium,
    color: colors.status.poor,
  },

  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius['3xl'],
  },
  heroIcon: { fontSize: 64 },

  titleSection: { gap: spacing.xl },
  spotName: {
    ...typography.scale.heading.large,
    color: colors.text.primary,
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
  bortleTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.celestial.glow,
  },
  certTag: {
    backgroundColor: 'rgba(134,239,172,0.1)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  certTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.status.good,
  },
  distText: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
  },

  card: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardValue: {
    ...typography.scale.body.medium,
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
  cardLink: {
    ...typography.scale.body.small,
    color: colors.accent.secondary,
  },
  cardLinkTappable: {
    textDecorationLine: 'underline',
  },
  cardLinkHint: {
    fontSize: 11,
    color: colors.text.secondary,
  },

  comingSoon: {
    flexDirection: 'row',
    gap: spacing['3xl'],
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
  },
  comingSoonIcon: {
    fontSize: 20,
    color: colors.celestial.ai,
    lineHeight: 24,
  },
  comingSoonText: { flex: 1, gap: spacing.sm },
  comingSoonTitle: {
    ...typography.scale.label.large,
    color: colors.celestial.ai,
  },
  comingSoonBody: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
