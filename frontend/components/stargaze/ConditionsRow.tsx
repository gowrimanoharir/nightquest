/**
 * ConditionsRow — single condition factor row for the SpotDetail conditions list.
 *
 * Layout:
 *   [Icon]  FACTOR NAME          value text
 *           ████████████░░░░     score/max bar
 *
 * Left border accent color matches the factor status (good/moderate/poor).
 * Matches the "Conditions Grid Cell" pattern from the style guide.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { ConditionFactor } from '@/services/api';

const ICONS: Record<string, string> = {
  'Cloud Cover': '☁️',
  'Transparency': '🔭',
  'Atmospheric Seeing': '🌬️',
  'Darkness': '🌑',
  'Smoke / AQI': '💨',
  'Wind': '🌀',
  'Humidity': '💧',
  'Temperature': '🌡️',
};

function statusColor(status: ConditionFactor['status']): string {
  if (status === 'good') return colors.status.good;
  if (status === 'moderate') return colors.status.moderate;
  return colors.status.poor;
}

interface ConditionsRowProps {
  factor: ConditionFactor;
}

export default function ConditionsRow({ factor }: ConditionsRowProps) {
  const accent = statusColor(factor.status);
  const fillPct = factor.max_score > 0
    ? Math.min(1, factor.score / factor.max_score) * 100
    : 0;
  const icon = ICONS[factor.name] ?? '✦';

  return (
    <View style={[styles.cell, { borderLeftColor: accent }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.label}>{factor.name.toUpperCase()}</Text>
        <View style={[styles.scorePill, { backgroundColor: `${accent}18` }]}>
          <Text style={[styles.scoreText, { color: accent }]}>
            {factor.score}/{factor.max_score}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${fillPct}%` as `${number}%`, backgroundColor: accent }]} />
      </View>

      {/* Detail text */}
      {!!factor.detail && (
        <Text style={styles.detail} numberOfLines={2}>{factor.detail}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    fontSize: 16,
    lineHeight: 20,
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.6,
  },
  scorePill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '700',
  },
  barTrack: {
    height: 6,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.background.elevated,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: borderRadius.xs,
  },
  detail: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});
