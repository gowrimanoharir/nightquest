/**
 * ChatSheet — NightQuest AI chat interface.
 *
 * Layout:
 *   Web (≥1280px): 320px persistent right side panel (always visible, no trigger).
 *   Mobile/Tablet:  Reanimated v4 bottom sheet, 90% screen height, drag-to-dismiss.
 *
 * Chat history is local state only — not in Zustand, not in context object.
 * Fresh array on every new session (app restart resets history automatically).
 *
 * Action lines in AI responses are parsed by MessageBubble and rendered as ActionCards.
 * Context updates (context_updated: true) are applied via applyContextUpdates().
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { colors, spacing, borderRadius, typography, breakpoints } from '@/constants/theme';
import { useContextStore } from '@/store/context';
import { useChatUIStore } from '@/store/chat';
import { fetchChat } from '@/services/api';
import type { ChatMessage } from '@/services/api';
import type { ActionType } from './ActionCard';
import MessageBubble from './MessageBubble';
import SuggestedPrompts from './SuggestedPrompts';

// ---------------------------------------------------------------------------
// Subtitle helper
// ---------------------------------------------------------------------------
function useChatSubtitle() {
  const { tab, active_event, active_spot, date, location } = useContextStore();

  if (tab === 'stargaze' && active_spot && active_event) {
    return `Planning for ${active_spot.name} · ${date ?? 'Tonight'}`;
  }
  if (tab === 'stargaze' && active_spot) {
    return `Planning from ${active_spot.name} · Tonight`;
  }
  if (tab === 'stargaze' && location) {
    return `Planning from ${location.name ?? 'your location'} · Tonight`;
  }
  if (tab === 'explore' && active_event) {
    return `Asking about ${active_event.name}`;
  }
  return 'What would you like to explore?';
}

// ---------------------------------------------------------------------------
// Chat content (shared between web panel + mobile sheet)
// ---------------------------------------------------------------------------
interface ChatContentProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

function ChatContent({ onClose, showCloseButton }: ChatContentProps) {
  const router = useRouter();
  const context = useContextStore();
  const applyContextUpdates = useContextStore((s) => s.applyContextUpdates);
  const subtitle = useChatSubtitle();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showPrompts, setShowPrompts] = useState(true);

  const scrollViewRef = useRef<ScrollView>(null);
  const conversationStarted = messages.length > 0;

  // When context changes significantly, restore prompts
  const contextKey = [
    context.tab,
    context.active_event?.name ?? '',
    context.active_spot?.name ?? '',
  ].join('|');
  const prevContextKeyRef = useRef(contextKey);
  useEffect(() => {
    if (contextKey !== prevContextKeyRef.current && conversationStarted) {
      prevContextKeyRef.current = contextKey;
      setShowPrompts(true);
    }
  }, [contextKey, conversationStarted]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) return;
      const trimmed = text.trim();
      setInputText('');
      setShowPrompts(false);

      const userMsg: ChatMessage = { role: 'user', content: trimmed };
      const updatedHistory = [...messages, userMsg];
      setMessages(updatedHistory);
      scrollToBottom();
      setIsSending(true);

      try {
        const res = await fetchChat({
          message: trimmed,
          history: messages,
          context,
        });

        const aiMsg: ChatMessage = { role: 'assistant', content: res.reply };
        setMessages((prev) => [...prev, aiMsg]);

        if (res.context_updated && res.context) {
          applyContextUpdates(res.context);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I ran into an issue. Please try again.' },
        ]);
      } finally {
        setIsSending(false);
        scrollToBottom();
      }
    },
    [messages, isSending, context, applyContextUpdates, scrollToBottom],
  );

  const handleActionPress = useCallback(
    (actionType: ActionType, label: string) => {
      if (actionType === 'view_stargaze') {
        router.push('/(tabs)/stargaze');
        onClose?.();
      } else if (actionType === 'view_spot') {
        // Find the spot by name in context.spots
        const spot = context.spots?.find((s) => s.name === label);
        if (spot) {
          router.push({ pathname: '/spot-detail', params: { data: JSON.stringify(spot) } });
          onClose?.();
        }
      }
    },
    [router, context.spots, onClose],
  );

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Text style={styles.headerIcon}>✦</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>NightQuest AI</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
        {showCloseButton && onClose && (
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close chat">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.divider} />

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>✦</Text>
            <Text style={styles.emptyStateText}>
              Ask anything about the night sky, upcoming events, or finding dark sky spots.
            </Text>
          </View>
        )}
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            showStarIcon={msg.role === 'assistant' && i === 0}
            onActionPress={handleActionPress}
          />
        ))}
        {isSending && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color={colors.celestial.ai} />
            <Text style={styles.typingText}>NightQuest AI is thinking…</Text>
          </View>
        )}
      </ScrollView>

      {/* Suggested prompts */}
      <SuggestedPrompts
        visible={showPrompts}
        context={context}
        onSelect={(prompt) => sendMessage(prompt)}
      />

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing['3xl']) }]}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about the night sky…"
            placeholderTextColor={colors.text.disabled}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(inputText)}
            editable={!isSending}
            testID="chat-input"
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              (!inputText.trim() || isSending) && styles.sendBtnDisabled,
              pressed && styles.sendBtnPressed,
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isSending}
            accessibilityLabel="Send message"
            testID="chat-send-btn"
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Mobile / tablet bottom sheet (Reanimated v4 pattern)
// ---------------------------------------------------------------------------
function MobileBottomSheet() {
  const { height: screenHeight } = useWindowDimensions();
  const { isOpen, close } = useChatUIStore();

  // Track render lifecycle separately from animation so we never read
  // Reanimated shared values in the render phase (unreliable on web).
  const [rendered, setRendered] = useState(false);

  const SHEET_HEIGHT = screenHeight * 0.9;
  const OPEN_Y = 0;
  const CLOSE_Y = SHEET_HEIGHT;

  const translateY = useSharedValue(CLOSE_Y);
  const startY = useSharedValue(CLOSE_Y);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      translateY.value = withSpring(OPEN_Y, { damping: 22, stiffness: 180 });
    } else {
      translateY.value = withSpring(CLOSE_Y, { damping: 22, stiffness: 180 });
      // Unmount after close animation completes (~400ms)
      const t = setTimeout(() => setRendered(false), 450);
      return () => clearTimeout(t);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const doClose = useCallback(() => close(), [close]);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const next = startY.value + e.translationY;
      translateY.value = Math.max(0, next);
    })
    .onEnd((e) => {
      if (e.velocityY > 600 || translateY.value > SHEET_HEIGHT * 0.45) {
        translateY.value = withSpring(CLOSE_Y, { damping: 22, stiffness: 180 });
        runOnJS(doClose)();
      } else {
        translateY.value = withSpring(OPEN_Y, { damping: 22, stiffness: 180 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!rendered) return null;

  return (
    <>
      {/* Backdrop */}
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityLabel="Close chat"
        testID="chat-backdrop"
      />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.mobileSheet,
          { height: SHEET_HEIGHT, bottom: -(SHEET_HEIGHT - screenHeight * 0.9) },
          animatedStyle,
        ]}
        testID="chat-sheet"
      >
        {/* Drag handle */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.dragHandleArea}>
            <View style={styles.dragHandle} />
          </View>
        </GestureDetector>

        <ChatContent onClose={close} showCloseButton={false} />
      </Animated.View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Web side panel (always visible, no trigger needed)
// ---------------------------------------------------------------------------
function WebSidePanel() {
  return (
    <View style={styles.webPanel} testID="chat-side-panel">
      <ChatContent showCloseButton={false} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// ChatSheet — auto-selects layout based on breakpoint
// ---------------------------------------------------------------------------
export default function ChatSheet() {
  const { width } = useWindowDimensions();
  const isWeb = width >= breakpoints.web;

  if (isWeb) return <WebSidePanel />;
  return <MobileBottomSheet />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  // --- Shared content ---
  contentContainer: {
    flex: 1,
    backgroundColor: colors.background.elevated,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    flex: 1,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 16,
    color: colors.celestial.ai,
  },
  headerTitle: {
    ...typography.scale.label.large,
    color: colors.text.primary,
    fontSize: 15,
  },
  headerSubtitle: {
    ...typography.scale.label.small,
    color: colors.celestial.ai,
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: spacing.md,
  },
  closeBtnText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing['3xl'],
  },

  // --- Messages ---
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['7xl'],
    gap: spacing['3xl'],
  },
  emptyStateIcon: {
    fontSize: 32,
    color: colors.celestial.ai,
    opacity: 0.5,
  },
  emptyStateText: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 240,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
    alignSelf: 'flex-start',
  },
  typingText: {
    ...typography.scale.body.small,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },

  // --- Input bar ---
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.background.elevated,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.xl,
    color: colors.text.primary,
    ...typography.scale.body.small,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  sendBtnPressed: {
    opacity: 0.8,
  },
  sendBtnText: {
    fontSize: 18,
    color: colors.text.inverse,
    fontWeight: '700',
    lineHeight: 22,
  },

  // --- Mobile bottom sheet ---
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5,5,8,0.6)',
    zIndex: 998,
  },
  mobileSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: colors.background.elevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 24,
  },
  dragHandleArea: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    flexShrink: 0,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
  },

  // --- Web side panel ---
  webPanel: {
    width: 320,
    flexShrink: 0,
    flexDirection: 'column',    // establish flex column so flex:1 children get height
    alignSelf: 'stretch',       // fill the webRow's cross-axis height
    borderLeftWidth: 1,
    borderLeftColor: colors.border.default,
    backgroundColor: colors.background.elevated,
  },
});
