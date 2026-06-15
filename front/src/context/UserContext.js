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
      // 401 expiré : l'intercepteur Axios a déjà appelé signOut (isSessionExpired = true).
      // Erreur réseau / timeout (Render cold-start) : on déclenche signOut manuellement
      // pour éviter l'état silencieux "Athlète" sans chemin de récupération.
      if (!error?.isSessionExpired) triggerSignOut();
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
