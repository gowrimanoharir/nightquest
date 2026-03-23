/**
 * LogoMark — NightQuest brand icon + optional wordmark / tagline.
 *
 * Web:    renders the planet SVG from /favicon.svg (React Native Web maps
 *         Image to <img>, so SVG URIs work natively — no extra lib needed).
 * Native: falls back to a styled ✦ view (no react-native-svg required).
 *         Replace assets/icon.png with an exported PNG of logo.svg to get
 *         the planet on the native home screen / splash.
 *
 * Sizes:
 *   sm  28 × 28  — chat header, list items
 *   md  40 × 40  — standalone usage
 *   lg  64 × 64  — onboarding / splash overlays
 */
import React from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

type LogoSize = 'sm' | 'md' | 'lg';

interface LogoMarkProps {
  size?: LogoSize;
  /** Show "NightQuest" wordmark beside the mark */
  showName?: boolean;
  /** Show tagline below the name */
  showTagline?: boolean;
  tagline?: string;
}

const SIZE = {
  sm: { box: 28, star: 13, dot: 5,  radius: 7  },
  md: { box: 40, star: 18, dot: 7,  radius: 10 },
  lg: { box: 64, star: 28, dot: 11, radius: 16 },
} as const;

export default function LogoMark({
  size = 'md',
  showName = false,
  showTagline = false,
  tagline = 'Your night sky awaits',
}: LogoMarkProps) {
  const s = SIZE[size];

  return (
    <View style={styles.root}>
      {/* ── Mark ── */}
      {Platform.OS === 'web' ? (
        // Web: render the real planet SVG
        <Image
          source={{ uri: '/favicon.svg' }}
          style={{ width: s.box, height: s.box }}
          accessibilityLabel="NightQuest"
        />
      ) : (
        // Native fallback: styled ✦ mark
        <View style={[styles.mark, { width: s.box, height: s.box, borderRadius: s.radius }]}>
          <View style={[styles.glow, { width: s.dot * 3.2, height: s.dot * 3.2, borderRadius: s.dot * 1.6 }]} />
          <Text style={[styles.star, { fontSize: s.star, lineHeight: s.star * 1.1 }]}>✦</Text>
        </View>
      )}

      {/* ── Text block ── */}
      {(showName || showTagline) && (
        <View style={styles.textBlock}>
          {showName && (
            <Text style={[styles.name, size === 'sm' && styles.nameSm]}>NightQuest</Text>
          )}
          {showTagline && (
            <Text style={styles.tagline}>{tagline}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  mark: {
    backgroundColor: 'rgba(8,11,24,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  glow: {
    position: 'absolute',
    backgroundColor: colors.celestial.ai,
    opacity: 0.18,
    borderRadius: 999,
  },
  star: {
    color: colors.accent.primary,
    textAlign: 'center',
  },
  textBlock: {
    gap: 2,
  },
  name: {
    ...typography.scale.label.large,
    color: colors.text.primary,
    fontSize: 15,
  },
  nameSm: {
    fontSize: 13,
  },
  tagline: {
    ...typography.scale.label.small,
    color: colors.celestial.ai,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
