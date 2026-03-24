import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { CelestialEvent, EventType } from '@/services/api';



const EVENT_ICONS: Record<EventType, string> = {
  meteor_shower: '☄️',
  eclipse:       '🌑',
  moon:          '🌕',
  planet:        '🪐',
  milky_way:     '🌌',
};

const EVENT_LABELS: Record<EventType, string> = {
  meteor_shower: 'Meteor Shower',
  eclipse:       'Eclipse',
  moon:          'Moon Phase',
  planet:        'Planet',
  milky_way:     'Milky Way',
};

type BadgeVariant = 'tonight' | 'this_week' | 'upcoming' | 'not_visible';

function getBadge(dateStr: string): BadgeVariant {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(dateStr);
  event.setHours(0, 0, 0, 0);
  const diffDays = Math.round((event.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'tonight';
  if (diffDays > 0 && diffDays <= 7) return 'this_week';
  if (diffDays > 7) return 'upcoming';
  return 'not_visible'; // past date
}

const BADGE_LABELS: Record<BadgeVariant, string> = {
  tonight:     'Tonight',
  this_week:   'This Week',
  upcoming:    'Upcoming',
  not_visible: 'Not Visible',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
  };
}

interface EventCardProps {
  event: CelestialEvent;
  onPress: (event: CelestialEvent) => void;
  onAskAI?: (event: CelestialEvent) => void;
  tonightConditions?: { score: number; label: string } | null;
}

function conditionsColor(score: number): string {
  if (score >= 60) return colors.status.good;
  if (score >= 40) return colors.status.moderate;
  return colors.status.poor;
}

const EventCard = React.memo(function EventCard({ event, onPress, onAskAI, tonightConditions }: EventCardProps) {
  const badge = getBadge(event.date);
  const isPast = badge === 'not_visible';
  const { month, day } = formatDate(event.date);
  const showConditionsDot = badge === 'tonight' && tonightConditions != null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, isPast && styles.cardPast, pressed && styles.cardPressed]}
      onPress={() => onPress(event)}
    >
      {/* Date box */}
      <View style={[styles.dateBox, isPast && styles.dateBoxPast]}>
        <Text style={[styles.dateMonth, isPast && styles.datePast]}>{month}</Text>
        <Text style={[styles.dateDay, isPast && styles.datePast]}>{day}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.category, isPast && styles.categoryPast]}>
            {EVENT_ICONS[event.type]}  {EVENT_LABELS[event.type].toUpperCase()}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, styles[`badge_${badge}`]]}>
              <Text style={[styles.badgeText, styles[`badgeText_${badge}`]]}>
                {BADGE_LABELS[badge]}
              </Text>
            </View>
            {showConditionsDot && (
              <View style={[styles.conditionsDot, { backgroundColor: conditionsColor(tonightConditions!.score) }]} />
            )}
          </View>
        </View>

        <Text style={[styles.name, isPast && styles.namePast]} numberOfLines={1}>{event.name}</Text>

        {event.description ? (
          <Text style={[styles.description, isPast && styles.descriptionPast]} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}

        {/* Not-visible AI nudge per style guide */}
        {isPast && onAskAI && (
          <Pressable style={styles.aiNudge} onPress={() => onAskAI(event)}>
            <Text style={styles.aiNudgeText}>✦ Ask where to travel to see this</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});

export default EventCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['3xl'],
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius['3xl'],
    padding: spacing['3xl'],
    marginBottom: spacing.xl,
  },
  // Past events: muted card with dimmed border, noticeably different from active
  cardPast: {
    backgroundColor: 'rgba(17, 13, 10, 0.5)',
    borderColor: 'rgba(255,248,240,0.06)',
    opacity: 0.55,
  },
  cardPressed: {
    backgroundColor: colors.background.elevated,
    transform: [{ translateY: -2 }],
  },

  // Date box
  dateBox: {
    width: 52,
    height: 52,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dateBoxPast: {
    backgroundColor: 'rgba(26, 19, 16, 0.5)',
  },
  dateMonth: {
    ...typography.scale.caption.small,
    color: colors.accent.secondary,
  },
  dateDay: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    lineHeight: 24,
  },
  datePast: {
    color: colors.text.secondary,
  },

  // Content
  content: {
    flex: 1,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  category: {
    ...typography.scale.caption.small,
    color: colors.celestial.glow,
    flex: 1,
  },
  categoryPast: {
    color: colors.text.secondary,
  },
  name: {
    ...typography.scale.heading.small,
    fontSize: 16,
    color: colors.text.primary,
  },
  namePast: {
    color: colors.text.secondary,
  },
  description: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
  },
  descriptionPast: {
    color: colors.text.disabled,
  },

  // Badges
  badge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    ...typography.scale.caption.small,
  },
  badge_tonight: {
    backgroundColor: `rgba(212,120,10,0.15)`,
    borderWidth: 1,
    borderColor: colors.accent.primary,
  },
  badgeText_tonight: {
    color: colors.accent.primary,
  },
  badge_this_week: {
    backgroundColor: `rgba(194,98,45,0.12)`,
    borderWidth: 1,
    borderColor: colors.accent.secondary,
  },
  badgeText_this_week: {
    color: colors.accent.secondary,
  },
  badge_upcoming: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  badgeText_upcoming: {
    color: colors.text.secondary,
  },
  badge_not_visible: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  badgeText_not_visible: {
    color: colors.text.disabled,
  },

  // Badge row: badge + optional conditions dot
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  conditionsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // AI nudge
  aiNudge: {
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  aiNudgeText: {
    fontSize: 12,
    color: colors.celestial.ai,
  },
});
