import React, { createContext, useState, useContext, useCallback, useRef } from 'react';
import API, { triggerSignOut } from '../api/api';
import { prefsCloud, seedFromProfile } from '../services/cloudPrefs.service';
import { reloadAvatarFrame } from '../hooks/useAvatarFrame';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(false);
  // Vrai dès qu'une première réponse (ou un échec) est arrivée : distingue
  // "pas encore chargé" (silhouette) de "chargement impossible" (message).
  const [loaded,  setLoaded]  = useState(false);

  // Une fois par session : préférences sauvegardées dans le compte, et cadre
  // ou vitrine connus du serveur quand le téléphone n'en a pas (nouvel appareil).
  const restoredRef = useRef(false);
  // Change quand des préférences viennent d'être restaurées : les écrans qui
  // les lisent (profil) se rechargent.
  const [restoredAt, setRestoredAt] = useState(0);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/users/me');
      if (res?.data?.success) {
        setUser(res.data.user);
        if (!restoredRef.current && !res.fromCache) {
          restoredRef.current = true;
          Promise.all([prefsCloud.pullAndMerge(), seedFromProfile(res.data.user)])
            .then(([prefs, seeded]) => {
              if (seeded.frame) reloadAvatarFrame();
              if (prefs?.changed || seeded.featured) setRestoredAt(Date.now());
            })
            .catch(() => {});
        }
      }
    } catch (error) {
      // 401 (session expirée) : l'intercepteur Axios a déjà déconnecté.
      // 404 : le compte n'existe plus (supprimé depuis un autre appareil).
      // Toute autre erreur (réseau coupé, serveur qui démarre, erreur serveur)
      // ne doit JAMAIS déconnecter : le profil sera rechargé au prochain
      // affichage d'écran, et les données locales restent utilisables.
      if (!error?.isSessionExpired && error?.status === 404) triggerSignOut();
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading, loaded, refetch, restoredAt }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside <UserProvider>');
  return ctx;
}
