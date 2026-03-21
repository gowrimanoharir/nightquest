/**
 * SpotCard — used in list view and in the pin-tap summary sheet.
 * Renders rank, name, score, Bortle, distance, certified badge, and
 * placeholder condition icons (filled in Phase 3B).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { DarkSpotSite } from '@/store/context';

interface SpotCardProps {
  spot: DarkSpotSite;
  onPress?: (spot: DarkSpotSite) => void;
  /** Show full CTA row with "View Details" button */
  showViewDetails?: boolean;
  onViewDetails?: (spot: DarkSpotSite) => void;
}

function scoreColor(score?: number): string {
  if (score == null) return colors.text.secondary;
  if (score >= 75) return colors.status.good;
  if (score >= 50) return colors.status.moderate;
  return colors.status.poor;
}

export default function SpotCard({ spot, onPress, showViewDetails, onViewDetails }: SpotCardProps) {
  const sc = spot.score != null ? Math.round(spot.score) : null;
  const distLabel = spot.distance != null
    ? `${spot.distance < 1 ? '< 1' : Math.round(spot.distance)} km away`
    : '';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress?.(spot)}
    >
      <View style={styles.row}>
        {/* Score box */}
        <View style={styles.scoreBox}>
          {sc != null ? (
            <>
              <Text style={[styles.scoreValue, { color: scoreColor(spot.score) }]}>
                {sc}
              </Text>
              <Text style={styles.scoreLabel}>SCORE</Text>
            </>
          ) : (
            <Text style={styles.scoreValueDash}>—</Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            {spot.rank != null && (
              <Text style={styles.rank}>#{spot.rank} </Text>
            )}
            <Text style={styles.name} numberOfLines={1}>{spot.name}</Text>
          </View>
          {(spot.state || spot.country) && (
            <Text style={styles.location} numberOfLines={1}>
              {[spot.state, spot.country].filter(Boolean).join(', ')}
              {distLabel ? `  ·  ${distLabel}` : ''}
            </Text>
          )}
          {!spot.state && !spot.country && distLabel ? (
            <Text style={styles.location}>{distLabel}</Text>
          ) : null}

          {/* Tags row */}
          <View style={styles.tags}>
            {spot.bortle_estimate != null && (
              <View style={styles.bortleTag}>
                <Text style={styles.bortleTagText}>
                  Bortle {spot.bortle_estimate}
                </Text>
              </View>
            )}
            {spot.certified && (
              <View style={styles.certTag}>
                <Text style={styles.certTagText}>IDA Certified</Text>
              </View>
            )}
            {/* Placeholder condition icons — filled in Phase 3B */}
            <View style={styles.condIcon}>
              <Text style={styles.condIconText}>☁</Text>
            </View>
            <View style={styles.condIcon}>
              <Text style={styles.condIconText}>🌙</Text>
            </View>
            <View style={styles.condIcon}>
              <Text style={styles.condIconText}>💨</Text>
            </View>
          </View>
        </View>
      </View>

      {showViewDetails && (
        <Pressable
          style={styles.viewDetailsBtn}
          onPress={() => onViewDetails?.(spot)}
        >
          <Text style={styles.viewDetailsBtnText}>View Details →</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    gap: spacing.xl,
  },
  cardPressed: {
    borderColor: colors.accent.secondary,
    backgroundColor: colors.background.elevated,
  },
  row: {
    flexDirection: 'row',
    gap: spacing['3xl'],
    alignItems: 'flex-start',
  },

  // Score box
  scoreBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  scoreValueDash: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
  },
  scoreLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Info
  info: {
    flex: 1,
    gap: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  rank: {
    ...typography.scale.label.medium,
    color: colors.text.secondary,
  },
  name: {
    ...typography.scale.heading.small,
    fontSize: 16,
    color: colors.text.primary,
    flex: 1,
  },
  location: {
    ...typography.scale.body.small,
    fontSize: 13,
    color: colors.text.secondary,
  },

  // Tags
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  bortleTag: {
    backgroundColor: 'rgba(253,230,138,0.1)',
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  bortleTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.celestial.glow,
  },
  certTag: {
    backgroundColor: colors.background.elevated,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  certTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.status.good,
  },
  condIcon: {
    backgroundColor: colors.background.elevated,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  condIconText: {
    fontSize: 12,
  },

  // View Details CTA
  viewDetailsBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  viewDetailsBtnText: {
    ...typography.scale.label.large,
    color: colors.text.inverse,
  },
});
