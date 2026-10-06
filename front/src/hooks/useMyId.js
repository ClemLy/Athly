import { useUser } from '../context/UserContext';
import { useAuth } from '../context/AuthContext';
import { userIdFromToken } from '../services/accountScope.service';

// Identifiant de l'utilisateur connecté, disponible tout de suite : le profil
// (UserContext) n'est chargé qu'à l'ouverture de certains écrans, alors que le
// jeton de session le contient déjà. Sans ça, le mode Multi ne reconnaissait
// pas « moi » (bouton « Je ne suis plus prêt » inopérant, « Clem » au lieu de
// « Toi », possibilité de se secouer soi-même dans le groupe).
export function useMyId() {
  const { user } = useUser();
  const { userToken } = useAuth();
  return user?._id || userIdFromToken(userToken) || null;
}
