import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing } from '@/constants/theme';



// Phase 3A builds this screen. Placeholder until then.
export default function StargazeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Stargaze</Text>
      <Text style={styles.sub}>Dark sky spot finder — coming in Phase 3A</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    padding: spacing['6xl'],
  },
  heading: {
    ...typography.scale.heading.large,
    color: colors.text.primary,
    marginBottom: spacing.xl,
  },
  sub: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
