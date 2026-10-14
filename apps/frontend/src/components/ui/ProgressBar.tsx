import React from 'react';
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string | undefined;
  trackColor?: string | undefined;
  height?: number | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  testID?: string | undefined;
  accessibilityLabel?: string | undefined;
}

export function ProgressBar({
  progress,
  color,
  trackColor,
  height = 8,
  style,
  testID = 'progress-bar',
  accessibilityLabel
}: ProgressBarProps): React.JSX.Element {
  const { theme } = useTheme();

  const clamped = Math.min(Math.max(progress, 0), 1);
  const percentage = `${Math.round(clamped * 100)}%` as const;

  const barColor = color ?? theme.income;
  const background = trackColor ?? theme.bgElevated;

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? `Progresso ${Math.round(clamped * 100)}%`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        styles.track,
        { backgroundColor: background, height, borderRadius: height / 2 },
        style
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: barColor,
            width: percentage,
            borderRadius: height / 2
          }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    height: '100%'
  },
  track: {
    overflow: 'hidden',
    width: '100%'
  }
});
