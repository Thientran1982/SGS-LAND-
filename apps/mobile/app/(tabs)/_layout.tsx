import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { colors, typography } from '../../src/theme/tokens';
// Lightweight emoji-based tab icons. We deliberately avoid pulling
// @expo/vector-icons (≈3MB) for the first cut — the buyer flow has 5 tabs
// and emojis render consistently across iOS/Android with zero deps.
function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 22,
        opacity: focused ? 1 : 0.55,
      }}
    >
      {glyph}
    </Text>
  );
}
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: typography.xs, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Khám phá',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Tìm kiếm',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🔎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Yêu thích',
          tabBarIcon: ({ focused }) => <TabIcon glyph="♥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Tin nhắn',
          tabBarIcon: ({ focused }) => <TabIcon glyph="💬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ focused }) => <TabIcon glyph="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}