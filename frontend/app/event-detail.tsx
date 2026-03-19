import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import EventDetail from '@/components/explore/EventDetail';
import { CelestialEvent } from '@/services/api';
import theme from '@/constants/theme';

const { colors, typography } = theme;

export default function EventDetailRoute() {
  const { data } = useLocalSearchParams<{ data: string }>();

  if (!data) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>Event not found.</Text>
      </View>
    );
  }

  let event: CelestialEvent;
  try {
    event = JSON.parse(data);
  } catch {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>Invalid event data.</Text>
      </View>
    );
  }

  return <EventDetail event={event} />;
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  errorText: {
    ...typography.scale.body.medium,
    color: colors.status.poor,
  },
});
