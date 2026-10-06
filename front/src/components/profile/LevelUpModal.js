import React from 'react';
import { Modal } from 'react-native';
import LevelUpOverlay from './LevelUpOverlay';

// ─── LevelUpModal ─────────────────────────────────────────────────────────────
// Modale globale — déclenchée par LevelUpCelebration.js quelle que soit la
// source du gain de niveau (objet d'inventaire, bonus de groupe…). Même
// célébration que le récap de séance : niveau classique ou nouveau rang.
//
// Props :
//   visible     bool
//   prevLevel   number
//   level       number
//   userInitial string
//   onClose     () => void

export default function LevelUpModal({ visible, prevLevel, level, userInitial, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {visible ? (
        <LevelUpOverlay
          prevLevel={prevLevel}
          newLevel={level}
          userInitial={userInitial}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
