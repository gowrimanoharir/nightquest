import React, { useEffect } from 'react';
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import StarBackground from '@/components/shared/StarBackground';
import LocationPicker from '@/components/shared/LocationPicker';
import { useAutoDetectLocation } from '@/components/shared/LocationPicker';
import { useContextStore } from '@/store/context';
import { useChatUIStore } from '@/store/chat';
import { colors, spacing, typography, breakpoints } from '@/constants/theme';
import ChatSheet from '@/components/chat/ChatSheet';



function WebHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const setTab = useContextStore((s) => s.setTab);
  const openChat = useChatUIStore((s) => s.open);

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
        {/* Web: chat is always visible as side panel — button is a noop visual only */}
        <Pressable style={webStyles.chatBtn} onPress={openChat}>
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

  useEffect(() => { autoDetect(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />

        {/* Outermost container owns the dark base color — fills the full viewport */}
        <View style={styles.container}>

          {/* Star field — covers the container, behind all content */}
          <View style={styles.starLayer} pointerEvents="none">
            <StarBackground />
          </View>

          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            {isWeb && <WebHeader />}

            {isWeb ? (
              /* Web: Stack + ChatSheet side panel in a flex row */
              <View style={styles.webRow}>
                <View style={styles.webMain}>
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
                    <Stack.Screen
                      name="spot-detail"
                      options={{
                        headerShown: false,
                        animation: 'slide_from_right',
                        contentStyle: { backgroundColor: colors.background.primary },
                      }}
                    />
                  </Stack>
                </View>
                {/* Chat side panel — always visible on web */}
                <ChatSheet />
              </View>
            ) : (
              /* Mobile/Tablet: Stack only */
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
                <Stack.Screen
                  name="spot-detail"
                  options={{
                    headerShown: false,
                    animation: 'slide_from_right',
                    contentStyle: { backgroundColor: colors.background.primary },
                  }}
                />
              </Stack>
            )}
          </SafeAreaView>

          {/* Mobile/Tablet: ChatSheet rendered outside SafeAreaView as an overlay */}
          {!isWeb && <ChatSheet />}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as any } : {}),
  },
  starLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    ...(Platform.OS === 'web' ? {
      position: 'fixed' as any,
      zIndex: 9999,
      mixBlendMode: 'screen' as any,
      pointerEvents: 'none' as any,
    } : {}),
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  // Web layout: horizontal row with main content + chat panel
  webRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',   // explicit: children fill the row's full height
  },
  webMain: {
    flex: 1,
    minWidth: 0,             // allow flex shrinking below content size
  },
});
