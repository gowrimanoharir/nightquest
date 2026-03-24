/**
 * SplashOverlay — First-launch onboarding splash.
 *
 * Shows the Saturn logo + "NightQuest" + tagline on the very first app load.
 * Dismisses automatically after 2 seconds or immediately on tap.
 * Persisted via AsyncStorage so it only appears once.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface SplashOverlayProps {
  onDismiss: () => void;
}

export default function SplashOverlay({ onDismiss }: SplashOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Auto-dismiss after 2 seconds
    const timer = setTimeout(() => {
      dismiss();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="box-none">
      <Pressable style={styles.inner} onPress={dismiss}>
        {/* Saturn mark */}
        <View style={styles.logoWrap}>
          {Platform.OS === 'web' ? (
            <Image
              source={{ uri: '/favicon.svg' }}
              style={styles.logoImg}
              accessibilityLabel="NightQuest"
            />
          ) : (
            <View style={styles.logoNative}>
              <View style={styles.logoGlow} />
              <Text style={styles.logoStar}>✦</Text>
            </View>
          )}
        </View>

        {/* Wordmark */}
        <Text style={styles.appName}>NightQuest</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>Your night sky awaits</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.base,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    // Web: cover viewport
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : {}),
  },
  inner: {
    alignItems: 'center',
    gap: spacing['3xl'],
  },

  // Logo mark
  logoWrap: {
    marginBottom: spacing.md,
  },
  logoImg: {
    width: 80,
    height: 80,
  },
  logoNative: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(8,11,24,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.celestial.ai,
    opacity: 0.18,
  },
  logoStar: {
    fontSize: 36,
    color: colors.accent.primary,
    textAlign: 'center',
  },

  // Text
  appName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 36,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    ...typography.scale.label.large,
    color: colors.celestial.ai,
    letterSpacing: 0.4,
    fontSize: 15,
  },
});
