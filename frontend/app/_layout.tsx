import React, { useEffect } from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import StarBackground from '@/components/shared/StarBackground';
import LocationPicker from '@/components/shared/LocationPicker';
import { useAutoDetectLocation } from '@/components/shared/LocationPicker';
import { useContextStore } from '@/store/context';
import theme from '@/constants/theme';

const { colors, spacing, typography, breakpoints } = theme;

function WebHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const setTab = useContextStore((s) => s.setTab);

  const navItems = [
    { label: 'Explore',  href: '/(tabs)/explore',  tab: 'explore' as const  },
    { label: 'Stargaze', href: '/(tabs)/stargaze', tab: 'stargaze' as const },
  ];

  return (
    <View style={webStyles.header}>
      <Pressable style={webStyles.logo} onPress={() => router.push('/(tabs)/explore')}>
        <Text style={webStyles.logoStar}>✦</Text>
        <Text style={webStyles.logoText}>NightQuest</Text>
      </Pressable>

      <View style={webStyles.nav}>
        {navItems.map((item) => {
          const active = pathname.includes(item.tab);
          return (
            <Pressable
              key={item.href}
              onPress={() => { router.push(item.href as any); setTab(item.tab); }}
            >
              <Text style={[webStyles.navItem, active && webStyles.navItemActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
        {/* Chat button in web header — Phase 4 wires this */}
        <Pressable style={webStyles.chatBtn}>
          <Text style={webStyles.chatBtnText}>✦  Ask AI</Text>
        </Pressable>
      </View>

      <LocationPicker compact />
    </View>
  );
}

const webStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['6xl'],
    paddingVertical: spacing['3xl'],
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    zIndex: 10,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  logoStar: {
    fontSize: 20,
    color: colors.accent.primary,
  },
  logoText: {
    ...typography.scale.heading.small,
    color: colors.text.primary,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['6xl'],
  },
  navItem: {
    ...typography.scale.label.large,
    color: colors.text.secondary,
  },
  navItemActive: {
    color: colors.accent.primary,
  },
  chatBtn: {
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing.lg,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: 'rgba(212,120,10,0.3)',
    borderRadius: 12,
  },
  chatBtnText: {
    ...typography.scale.label.medium,
    color: colors.accent.primary,
  },
});

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isWeb = width >= breakpoints.web;
  const { run: autoDetect } = useAutoDetectLocation();

  // Trigger silent location detection once at app root
  useEffect(() => { autoDetect(); }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />

      {/* Star field — fixed, behind everything */}
      <View style={styles.starWrap} pointerEvents="none">
        <StarBackground />
      </View>

      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        {isWeb && <WebHeader />}

        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="event-detail"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors.background.primary },
            }}
          />
        </Stack>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  starWrap: {
    position: 'absolute',
    inset: 0 as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    backgroundColor: colors.background.base,
  },
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
