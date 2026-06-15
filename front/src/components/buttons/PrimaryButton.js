// ============================================================================================
// Composant REUTILISABLE : PrimaryButton
// ============================================================================================
// Bouton principal (orange) utilisé partout dans l'app.
// Props : 
//    - label : texte du bouton
//    - onPress : fonction à exécuter au clic
//
// Avantages :
//    ✔ Style centralisé
//    ✔ Reutilisable sur plusieurs écrans
// ============================================================================================

import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

export default function PrimaryButton({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#ff7a33",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});