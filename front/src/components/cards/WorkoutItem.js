// ============================================================================================
// Composant REUTILISABLE : WorkoutItem
// ============================================================================================
// Carte affichant une séance :
//    - titre (Push, Pull...)
//    - informations complémentaires (nombre d'exercices, durée...)
//    - action au clic (ouvrir la séance)
// ============================================================================================
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Colors } from "../../constants/theme";

export default function WorkoutItem({ title, info, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.info}>{info}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    padding: 18,
    borderRadius: 14,
    marginBottom: 12,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "bold",
  },
  info: {
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
