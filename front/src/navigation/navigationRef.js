import { createNavigationContainerRef } from '@react-navigation/native';

// Réf globale du conteneur de navigation — permet de naviguer depuis des
// composants montés hors de toute pile (ex: LobbyInviteCheck, qui réagit à
// une notification push reçue au premier plan et n'a pas de prop `navigation`).
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
