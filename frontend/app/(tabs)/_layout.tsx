import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography, breakpoints, layout } from '@/constants/theme';
import { useContextStore } from '@/store/context';



function ExploreIcon({ focused }: { focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>🔭</Text>
  );
}

function StargazeIcon({ focused }: { focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>⭐</Text>
  );
}

function TabBar({ state, descriptors, navigation }: any) {
  const { width } = useWindowDimensions();
  const isWeb = width >= breakpoints.web;
  const setTab = useContextStore((s) => s.setTab);
  const router = useRouter();

  if (isWeb) return null; // Web uses top header navigation in _layout.tsx root

  // Build per-route press handler + element
  function renderRouteTab(route: any, index: number) {
    const { options } = descriptors[route.key];
    const focused = state.index === index;

    if (route.name === '__chat__') return null;

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!event.defaultPrevented) {
        navigation.navigate(route.name);
        setTab(route.name === 'explore' ? 'explore' : 'stargaze');
      }
    };

    return (
      <Pressable key={route.key} style={styles.tabItem} onPress={onPress}>
        {options.tabBarIcon?.({ focused, color: focused ? colors.accent.primary : colors.text.secondary, size: 24 })}
        <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
          {options.tabBarLabel ?? options.title ?? route.name}
        </Text>
      </Pressable>
    );
  }

  // Desired order: Explore | ✦ AI (center) | Stargaze
  const exploreRoute = state.routes.find((r: any) => r.name === 'explore');
  const stargazeRoute = state.routes.find((r: any) => r.name === 'stargaze');
  const exploreIdx = state.routes.indexOf(exploreRoute);
  const stargazeIdx = state.routes.indexOf(stargazeRoute);

  return (
    <View style={styles.tabBar}>
      {exploreRoute && renderRouteTab(exploreRoute, exploreIdx)}

      {/* Elevated center chat button — Phase 4 wires this to open ChatSheet */}
      <View style={styles.chatWrap}>
        <Pressable
          style={styles.chatBtn}
          onPress={() => {
            // Phase 4: open chat sheet
          }}
        >
          <Text style={styles.chatIcon}>✦</Text>
        </Pressable>
        <Text style={styles.chatLabel}>AI</Text>
      </View>

      {stargazeRoute && renderRouteTab(stargazeRoute, stargazeIdx)}
    </View>
  );
}

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isWeb = width >= breakpoints.web;
  const setTab = useContextStore((s) => s.setTab);

  // sceneContainerStyle is valid on the underlying React Navigation BottomTabNavigator
  // but Expo Router's Tabs types don't expose it — cast to pass it through
  const extraTabsProps = { sceneContainerStyle: { backgroundColor: 'transparent' } };

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      {...(extraTabsProps as any)}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      screenListeners={{
        tabPress: (_e) => {},
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ focused }) => <ExploreIcon focused={focused} />,
        }}
        listeners={{ focus: () => setTab('explore') }}
      />
      <Tabs.Screen
        name="stargaze"
        options={{
          title: 'Stargaze',
          tabBarIcon: ({ focused }) => <StargazeIcon focused={focused} />,
        }}
        listeners={{ focus: () => setTab('stargaze') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['4xl'],
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    minHeight: layout.mobile.tabBarHeight,
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xs,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.4,
  },
  tabLabelActive: {
    color: colors.accent.primary,
  },

  // Center chat button
  chatWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  chatBtn: {
    width: layout.mobile.chatButtonSize,
    height: layout.mobile.chatButtonSize,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: 'rgba(212,120,10,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    // Elevate above tab bar line
    marginBottom: 8,
    shadowColor: '#D4780A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  chatIcon: {
    fontSize: 22,
    color: colors.accent.primary,
  },
  chatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.4,
  },
});
