import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

// Logo ATHLY (mark + wordmark) pour rester pixel-perfect avec la maquette.
function AthlyLogo() {
  return (
    <View style={styles.logoWrap} accessible accessibilityLabel="Athly">
      <Text style={styles.logoMark}>△</Text>
      <Text style={styles.logoText}>ATHLY</Text>
    </View>
  );
}

export default function WorkoutHeader({ title = 'Séance', subtitle = null }) {
  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <AthlyLogo />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 14,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f1f27',
  },
  titleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  logoMark: {
    color: Colors.primary,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '900',
    marginBottom: 2,
  },
  logoText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
