import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

// Wrapper visuel groupant N exercices en superset (label "SUPERSET A", bordure orange douce).
// Les enfants (ExerciseCard) sont rendus à l'intérieur, sans marge horizontale.
export default function SupersetGroup({ label = 'A', children }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.dot} />
        <Text style={styles.title}>SUPERSET {label}</Text>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(254, 116, 57, 0.45)',
    backgroundColor: 'rgba(254, 116, 57, 0.05)',
    paddingTop: 10,
    paddingBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginRight: 8,
  },
  title: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  body: {
    // les enfants gèrent leur propre margin verticale
  },
});
