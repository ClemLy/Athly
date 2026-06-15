// ============================================================================================
// Composant SectionTitle
// Affiche un titre de section avec un style uniforme
// ============================================================================================

import React from "react";
import { Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/theme";

export default function SectionTitle({ title }) {
  return <Text style={styles.section}>{title}</Text>;
}

const styles = StyleSheet.create({
  section: {
    color: Colors.textPrimary,
    fontSize: 18,
    marginVertical: 16,
    fontWeight: "bold",
  },
});