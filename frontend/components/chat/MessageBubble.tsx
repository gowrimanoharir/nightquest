/**
 * MessageBubble — renders a single chat message.
 *
 * Parses action lines in the format [ACTION:type:label] from assistant messages
 * and renders them as ActionCard components.
 *
 * User:     right-aligned, accent.primary background
 * Assistant: left-aligned, background.surface card
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import ActionCard, { ActionType } from './ActionCard';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  showStarIcon?: boolean;
  onActionPress?: (actionType: ActionType, label: string) => void;
}

interface ParsedSegment {
  type: 'text' | 'action';
  text: string;
  actionType?: ActionType;
}

const ACTION_LINE_RE = /^\[ACTION:(view_stargaze|view_spot):(.+)\]$/;

function parseContent(content: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let textBuffer: string[] = [];

  for (const line of content.split('\n')) {
    const match = line.trim().match(ACTION_LINE_RE);
    if (match) {
      if (textBuffer.length > 0) {
        segments.push({ type: 'text', text: textBuffer.join('\n').trim() });
        textBuffer = [];
      }
      segments.push({
        type: 'action',
        text: line,
        actionType: match[1] as ActionType,
      });
    } else {
      textBuffer.push(line);
    }
  }

  if (textBuffer.length > 0) {
    const text = textBuffer.join('\n').trim();
    if (text) segments.push({ type: 'text', text });
  }

  return segments;
}

export default function MessageBubble({
  role,
  content,
  showStarIcon = false,
  onActionPress,
}: MessageBubbleProps) {
  const isUser = role === 'user';
  const segments = isUser ? [{ type: 'text' as const, text: content }] : parseContent(content);

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && showStarIcon && (
        <View style={styles.starIconWrap}>
          <Text style={styles.starIcon}>✦</Text>
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          !isUser && showStarIcon ? styles.bubbleWithIcon : null,
        ]}
      >
        {segments.map((seg, i) => {
          if (seg.type === 'action' && seg.actionType) {
            return (
              <ActionCard
                key={i}
                actionType={seg.actionType}
                label={seg.text.replace(ACTION_LINE_RE, '$2')}
                onPress={() => onActionPress?.(seg.actionType!, seg.text.replace(ACTION_LINE_RE, '$2'))}
              />
            );
          }
          return (
            <Text key={i} style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
              {seg.text}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
    maxWidth: '85%',
  },
  rowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },

  starIconWrap: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: spacing.xs,
    flexShrink: 0,
  },
  starIcon: {
    fontSize: 14,
    color: colors.celestial.ai,
  },

  bubble: {
    borderRadius: borderRadius['3xl'],
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.xl,
    flexShrink: 1,
  },
  bubbleUser: {
    backgroundColor: colors.accent.primary,
    borderBottomRightRadius: borderRadius.xs,
  },
  bubbleAssistant: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderBottomLeftRadius: borderRadius.xs,
  },
  bubbleWithIcon: {
    // No extra style needed; the icon sits beside
  },

  text: {
    ...typography.scale.body.small,
    lineHeight: 22,
  },
  textUser: {
    color: colors.text.inverse,
  },
  textAssistant: {
    color: colors.text.primary,
  },
});
