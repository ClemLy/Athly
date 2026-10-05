import React, { createContext, useState, useContext, useCallback } from 'react';
import API, { triggerSignOut } from '../api/api';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/users/me');
      if (res?.data?.success) setUser(res.data.user);
    } catch (error) {
      // 401 (session expirée) : l'intercepteur Axios a déjà déconnecté.
      // 404 : le compte n'existe plus (supprimé depuis un autre appareil).
      // Toute autre erreur (réseau coupé, serveur qui démarre, erreur serveur)
      // ne doit JAMAIS déconnecter : le profil sera rechargé au prochain
      // affichage d'écran, et les données locales restent utilisables.
      if (!error?.isSessionExpired && error?.status === 404) triggerSignOut();
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading, refetch }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside <UserProvider>');
  return ctx;
}
