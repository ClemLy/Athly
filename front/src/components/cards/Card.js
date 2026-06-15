// -------------------------------------------------------------
// Composant Card réutilisable
// -------------------------------------------------------------
// Ce composant sert de conteneur "carte" pour afficher
// du contenu avec un style uniforme (fond, arrondi, padding, margin).
// Il utilise `props.children` pour englober n'importe quel contenu.
// -------------------------------------------------------------

import React from "react";
import { View, StyleSheet } from "react-native";
import { Colors } from "../../constants/theme";

export default function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,  // Couleur de fond des cartes
    padding: 20,                   // Padding interne
    borderRadius: 16,              // Arrondi des coins
    marginBottom: 16,              // Marge en bas
    shadowColor: "#000",           // Optionnel : ombre légère pour iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,                  // Ombre pour Android
  },
});