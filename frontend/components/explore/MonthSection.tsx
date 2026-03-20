import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import EventCard from './EventCard';
import { CelestialEvent } from '@/services/api';



interface MonthSectionProps {
  month: string;         // e.g. "August 2026"
  events: CelestialEvent[];
  defaultExpanded?: boolean;
  onEventPress: (event: CelestialEvent) => void;
  onAskAI?: (event: CelestialEvent) => void;
}

export default function MonthSection({
  month,
  events,
  defaultExpanded = false,
  onEventPress,
  onAskAI,
}: MonthSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.monthLabel}>{month}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.countBadge}>{events.length}</Text>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.eventList}>
          {events.map((event, i) => (
            <EventCard
              key={`${event.name}-${i}`}
              event={event}
              onPress={onEventPress}
              onAskAI={onAskAI}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing['4xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  monthLabel: {
    ...typography.scale.heading.small,
    color: colors.text.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  countBadge: {
    ...typography.scale.caption.small,
    color: colors.text.secondary,
    backgroundColor: colors.background.elevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 100,
    overflow: 'hidden',
  },
  chevron: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  eventList: {
    marginTop: spacing.md,
  },
});
