import { Platform } from 'react-native';
import { getPathFromState, getStateFromPath } from '@react-navigation/native';

// ─── Adresses web de l'application ────────────────────────────────────────────
// Sur la PWA, chaque écran a sa propre URL : le bouton retour du navigateur et
// le geste retour Android reviennent à l'écran précédent au lieu de fermer
// l'app, une page peut être rechargée sans revenir à l'accueil, et une
// adresse inconnue affiche la page 404.
//
// Les paramètres de navigation ne sont JAMAIS recopiés dans l'URL (query
// string supprimée) : certains sont des objets (séance en cours) qui ne
// survivraient pas à un rechargement, d'autres sont personnels (email sur
// l'écran de vérification). Seuls les identifiants déclarés dans le chemin
// (ex : ami/:friendId) sont conservés.

const stripQuery = (path) => path.split('?')[0].split('#')[0];

export const linking = {
  enabled: Platform.OS === 'web',
  prefixes: [],
  config: {
    screens: {
      Auth: 'connexion',
      Register: 'inscription',
      EmailVerification: 'confirmation-email',
      ForgotPassword: 'mot-de-passe-oublie',
      Main: {
        path: '',
        screens: {
          Accueil: '',
          'Séances': {
            path: 'seances',
            // Rechargement sur un sous-écran : l'écran racine reste dessous,
            // pour que le bouton retour ait toujours une destination.
            initialRouteName: 'WorkoutList',
            screens: {
              WorkoutList: '',
              WorkoutBuilder: 'creer',
              ManualWorkoutCreator: 'creer-manuellement',
              CustomExercises: 'mes-exercices',
              EditExercise: 'mes-exercices/edition',
              Workout: 'en-cours',
              ExerciseDetail: 'en-cours/exercice',
              ExerciseStats: 'progression-exercice',
            },
          },
          Stats: 'stats',
          SocialTab: {
            path: 'social',
            initialRouteName: 'SocialHub',
            screens: {
              SocialHub: '',
              FriendProfile: 'ami/:friendId',
            },
          },
          ProfileTab: {
            path: 'profil',
            initialRouteName: 'ProfileMain',
            screens: {
              ProfileMain: '',
              EditProfile: 'modifier',
              RankRoadmap: 'rangs',
              TrophyRoom: 'trophees',
              Settings: 'reglages',
              Inventory: 'inventaire',
            },
          },
        },
      },
      Legal: 'legal/:doc',
      NotFound: '*',
    },
  },
  getPathFromState(state, options) {
    return stripQuery(getPathFromState(state, options));
  },
  getStateFromPath(path, options) {
    return getStateFromPath(stripQuery(path), options);
  },
};

// Titre de l'onglet du navigateur (et du sélecteur d'apps)
const TITLES = {
  Auth: 'Connexion',
  Register: 'Créer un compte',
  EmailVerification: 'Confirme ton email',
  ForgotPassword: 'Mot de passe oublié',
  Accueil: 'Accueil',
  WorkoutList: 'Séances',
  WorkoutBuilder: 'Créer une séance',
  ManualWorkoutCreator: 'Créer une séance',
  CustomExercises: 'Mes exercices',
  EditExercise: 'Exercice',
  Workout: 'Séance en cours',
  ExerciseDetail: 'Séance en cours',
  ExerciseStats: 'Progression',
  Stats: 'Statistiques',
  SocialHub: 'Social',
  FriendProfile: 'Profil d\'un ami',
  ProfileMain: 'Profil',
  EditProfile: 'Modifier le profil',
  RankRoadmap: 'Rangs',
  TrophyRoom: 'Trophées',
  Settings: 'Réglages',
  Inventory: 'Inventaire',
  Legal: 'Informations légales',
  NotFound: 'Page introuvable',
};

export const documentTitle = {
  formatter: (_options, route) => {
    const label = route?.name ? TITLES[route.name] : null;
    return label ? `${label} | Athly` : 'Athly';
  },
};
