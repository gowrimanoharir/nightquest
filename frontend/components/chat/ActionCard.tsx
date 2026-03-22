/**
 * ActionCard — tappable card rendered inline inside AI messages.
 *
 * Supported types:
 *  - view_stargaze: navigate to stargaze tab (+ apply context updates)
 *  - view_spot: navigate to spot-detail for a named spot
 */
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

export type ActionType = 'view_stargaze' | 'view_spot';

export interface ActionCardProps {
  actionType: ActionType;
  label: string;
  onPress: () => void;
}

export default function ActionCard({ actionType, label, onPress }: ActionCardProps) {
  const icon = actionType === 'view_stargaze' ? '⭐' : '📍';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(167,139,250,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.xl,
    marginTop: spacing.xl,
    alignSelf: 'flex-start',
  },
  cardPressed: {
    backgroundColor: 'rgba(167,139,250,0.18)',
  },
  icon: {
    fontSize: 14,
  },
  label: {
    ...typography.scale.label.large,
    color: colors.celestial.ai,
    flex: 1,
  },
  arrow: {
    fontSize: 18,
    color: colors.celestial.ai,
    fontWeight: '600',
  },
});
