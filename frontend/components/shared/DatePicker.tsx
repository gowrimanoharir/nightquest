/**
 * DatePicker — single-date selector with prev/next day arrows.
 * Shows a warning label for dates beyond 16 days from today
 * (historical averages territory per spec).
 * Used in the Stargaze tab header.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

interface DatePickerProps {
  value: string;          // ISO date string "YYYY-MM-DD"
  onChange: (date: string) => void;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDisplay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysDiffFromToday(isoDate: string): number {
  const d = new Date(isoDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const diff = useMemo(() => daysDiffFromToday(value), [value]);
  const isHistorical = diff > 16;

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Pressable
          style={styles.arrow}
          onPress={() => onChange(addDays(value, -1))}
          accessibilityLabel="Previous day"
        >
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>

        <View style={styles.dateBox}>
          <Text style={styles.dateText}>{formatDisplay(value)}</Text>
          <Text style={styles.isoText}>{value}</Text>
        </View>

        <Pressable
          style={styles.arrow}
          onPress={() => onChange(addDays(value, 1))}
          accessibilityLabel="Next day"
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      {isHistorical && (
        <Text style={styles.historicalLabel}>
          Historical averages — no live forecast available for this date
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  arrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  arrowText: {
    fontSize: 18,
    color: colors.text.primary,
    lineHeight: 20,
  },
  dateBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  dateText: {
    ...typography.scale.label.large,
    color: colors.text.primary,
  },
  isoText: {
    ...typography.scale.caption.regular,
    fontSize: 11,
    color: colors.text.secondary,
  },
  historicalLabel: {
    ...typography.scale.caption.small,
    fontSize: 10,
    color: colors.status.moderate,
    textAlign: 'center',
    letterSpacing: 0,
    textTransform: 'none',
    fontWeight: '400',
  },
});
