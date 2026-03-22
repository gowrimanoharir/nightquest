/**
 * SuggestedPrompts — row of context-driven prompt chips.
 *
 * Fetches from GET /api/prompts on mount (and when contextKey changes).
 * Hidden once conversation has started; reappears on significant context change.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { fetchPrompts } from '@/services/api';
import { ContextObject } from '@/store/context';

interface SuggestedPromptsProps {
  visible: boolean;
  context?: Partial<ContextObject> | null;
  onSelect: (prompt: string) => void;
}

export default function SuggestedPrompts({ visible, context, onSelect }: SuggestedPromptsProps) {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const prevKeyRef = useRef<string>('');

  const contextKey = [
    context?.tab ?? '',
    context?.active_event?.name ?? '',
    context?.active_spot?.name ?? '',
    context?.location?.name ?? '',
  ].join('|');

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPrompts(context ?? undefined);
      setPrompts(res.prompts);
    } catch {
      // Non-fatal — show nothing if fetch fails
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }, [contextKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (contextKey !== prevKeyRef.current) {
      prevKeyRef.current = contextKey;
      loadPrompts();
    }
  }, [contextKey, loadPrompts]);

  // Trigger initial load
  useEffect(() => {
    loadPrompts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.celestial.ai} />
      </View>
    );
  }
  if (prompts.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
    >
      {prompts.map((prompt, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          onPress={() => onSelect(prompt)}
        >
          <Text style={styles.chipText}>{prompt}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.xl,
    gap: spacing.md,
    flexDirection: 'row',
  },
  loadingWrap: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  chip: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  chipPressed: {
    backgroundColor: 'rgba(167,139,250,0.10)',
    borderColor: colors.celestial.ai,
  },
  chipText: {
    ...typography.scale.label.medium,
    color: colors.text.secondary,
    fontSize: 13,
  },
});
