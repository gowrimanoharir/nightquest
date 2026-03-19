import React from 'react';
import { DimensionValue, StyleSheet, View } from 'react-native';

// Tier 3 bright star positions from style guide spec
const TIER3_POSITIONS = [
  { top: '12%', left: '8%' },
  { top: '28%', left: '72%' },
  { top: '45%', left: '25%' },
  { top: '62%', left: '85%' },
  { top: '78%', left: '42%' },
  { top: '35%', left: '55%' },
  { top: '88%', left: '15%' },
] as const;

export default function StarBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      {/* Tier 1 & 2 are CSS-only on web via the style sheet below.
          On native, we render inline background views since RN doesn't
          support repeating-gradient. The SVG-based tiling approach
          keeps it GPU-composited and non-blocking. */}

      {/* Tier 1: dense small warm stars — simulated via many tiny dots */}
      {TIER1_DOTS.map((dot, i) => (
        <View
          key={`t1-${i}`}
          style={[
            styles.starTier1,
            { top: dot.top as DimensionValue, left: dot.left as DimensionValue, opacity: dot.opacity },
          ]}
        />
      ))}

      {/* Tier 2: medium gold-tinted stars */}
      {TIER2_DOTS.map((dot, i) => (
        <View
          key={`t2-${i}`}
          style={[
            styles.starTier2,
            { top: dot.top as DimensionValue, left: dot.left as DimensionValue, opacity: dot.opacity },
          ]}
        />
      ))}

      {/* Tier 3: 7 bright accent stars with glow */}
      {TIER3_POSITIONS.map((pos, i) => (
        <View
          key={`t3-${i}`}
          style={[styles.starTier3, { top: pos.top as DimensionValue, left: pos.left as DimensionValue }]}
        />
      ))}
    </View>
  );
}

// Pre-computed Tier 1 positions (20 stars across a 200px tile pattern)
const TIER1_DOTS = [
  { top: '10%',  left: '10%',  opacity: 0.30 },
  { top: '25%',  left: '35%',  opacity: 0.25 },
  { top: '40%',  left: '15%',  opacity: 0.30 },
  { top: '55%',  left: '55%',  opacity: 0.20 },
  { top: '70%',  left: '25%',  opacity: 0.30 },
  { top: '85%',  left: '85%',  opacity: 0.25 },
  { top: '15%',  left: '65%',  opacity: 0.30 },
  { top: '30%',  left: '80%',  opacity: 0.20 },
  { top: '45%',  left: '70%',  opacity: 0.30 },
  { top: '60%',  left: '5%',   opacity: 0.25 },
  { top: '75%',  left: '75%',  opacity: 0.30 },
  { top: '90%',  left: '40%',  opacity: 0.20 },
  { top: '5%',   left: '90%',  opacity: 0.30 },
  { top: '20%',  left: '50%',  opacity: 0.25 },
  { top: '35%',  left: '30%',  opacity: 0.30 },
  { top: '50%',  left: '60%',  opacity: 0.20 },
  { top: '65%',  left: '10%',  opacity: 0.30 },
  { top: '80%',  left: '95%',  opacity: 0.25 },
  { top: '95%',  left: '5%',   opacity: 0.30 },
  { top: '12%',  left: '42%',  opacity: 0.20 },
  { top: '48%',  left: '88%',  opacity: 0.28 },
  { top: '67%',  left: '48%',  opacity: 0.22 },
  { top: '83%',  left: '22%',  opacity: 0.27 },
  { top: '37%',  left: '92%',  opacity: 0.24 },
  { top: '72%',  left: '62%',  opacity: 0.29 },
];

// Pre-computed Tier 2 positions (8 stars across a 300px tile pattern)
const TIER2_DOTS = [
  { top: '18%', left: '28%', opacity: 0.50 },
  { top: '42%', left: '62%', opacity: 0.45 },
  { top: '68%', left: '18%', opacity: 0.50 },
  { top: '88%', left: '72%', opacity: 0.40 },
  { top: '8%',  left: '82%', opacity: 0.50 },
  { top: '52%', left: '38%', opacity: 0.45 },
  { top: '78%', left: '48%', opacity: 0.50 },
  { top: '32%', left: '92%', opacity: 0.40 },
];

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  starTier1: {
    position: 'absolute',
    width: 1,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,248,240,1)',
  },
  starTier2: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(253,230,138,1)',
  },
  starTier3: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,248,240,0.8)',
    shadowColor: '#FDE68A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 2,
  },
});
