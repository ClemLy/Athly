import React, { createContext, useState, useContext, useEffect } from 'react';
import { getToken, removeToken, saveToken, setSessionOnly, getSessionOnly } from '../utils/authStorage';
import { setSignOutCallback } from '../api/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const sessionOnly = await getSessionOnly();
        if (sessionOnly) {
          await removeToken();
        } else {
          const token = await getToken();
          if (token) setUserToken(token);
        }
      } catch {
        // storage error — proceed unauthenticated
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, []);

  // rememberMe: true → token persists across restarts; false → session only
  const signIn = async (token, rememberMe = true) => {
    await saveToken(token);
    await setSessionOnly(!rememberMe);
    setUserToken(token);
  };

  const signOut = async () => {
    await removeToken();
    await setSessionOnly(false);
    setUserToken(null);
  };

  // Enregistre signOut dans l'intercepteur Axios pour que les erreurs 401
  // (JWT expiré) déclenchent une déconnexion propre sans passer par React.
  useEffect(() => {
    setSignOutCallback(signOut);
    return () => setSignOutCallback(null);
  // signOut est stable (pas de dépendances variables), l'effet tourne une seule fois.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ userToken, setUserToken, signIn, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
