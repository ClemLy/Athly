// ============================================================================================
// Composant StatBox
// Petite carte affichant une statistique : valeur + label
// ============================================================================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/theme";

export default function StatBox({ value, label }) {
  return (
    <View style={styles.box}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Colors.card,
    width: "30%",
    padding: 14,
    borderRadius: 14,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: "bold",
  },
  label: {
    color: Colors.textSecondary,
    marginTop: 4,
    fontSize: 12,
  },
});