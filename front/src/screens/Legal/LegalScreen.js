import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { LEGAL_INFO, LEGAL_DOCS } from '../../constants/legal';

// ─── Pages légales ────────────────────────────────────────────────────────────
// Confidentialité (RGPD), conditions d'utilisation et mentions légales (LCEN).
// Accessibles sans compte (lien depuis l'inscription) et depuis les réglages.
// Route : /legal/:doc avec doc ∈ confidentialite | conditions | mentions-legales

const contactLine = LEGAL_INFO.contactEmail
  ? `par email à ${LEGAL_INFO.contactEmail}`
  : `via la page du projet : ${LEGAL_INFO.contactUrl}`;

const PRIVACY = [
  {
    title: 'En bref',
    body: [
      "Athly collecte uniquement ce qui sert à faire fonctionner l'app : ton compte, tes séances, ton profil sportif et tes interactions avec tes amis.",
      "Aucune donnée n'est vendue, louée ni utilisée pour de la publicité. Il n'y a ni pisteur publicitaire ni outil de mesure d'audience.",
      'Tu peux supprimer ton compte et toutes tes données à tout moment depuis Réglages, en un geste.',
    ],
  },
  {
    title: 'Responsable du traitement',
    body: [
      `${LEGAL_INFO.editorName}, éditeur d'Athly à titre personnel et non commercial. Pour toute question ou demande liée à tes données, contacte-le ${contactLine}.`,
    ],
  },
  {
    title: 'Données collectées',
    body: [
      'Compte : pseudo, adresse email, mot de passe (stocké chiffré de façon irréversible, jamais lisible).',
      'Profil sportif, si tu le renseignes : âge, sexe, taille, poids, poids cible, date de naissance, niveau, objectif, rythme et équipement.',
      'Activité : séances, séries, records, historique de pesées, progression (XP, niveau, trophées, titres, objets).',
      'Social : liste d\'amis, groupes, séances Multi, réactions et notifications échangées.',
      'Technique : identifiant de notification de ton appareil (si tu les autorises) et date de dernière activité.',
      "Une partie de tes données (historique local, quêtes, préférences) est stockée uniquement sur ton appareil, dans le stockage de l'application.",
    ],
  },
  {
    title: 'Pourquoi ces données',
    body: [
      "Fournir le service : enregistrer tes séances, calculer ta progression, afficher tes statistiques.",
      'Les fonctions sociales : permettre à tes amis de voir ton profil public, ton niveau et tes records mis en avant.',
      'La sécurité de ton compte : codes de vérification par email, protection contre les tentatives de connexion abusives.',
      'Les notifications que tu as acceptées : rappels, invitations, réactions de tes amis.',
    ],
  },
  {
    title: 'Base légale',
    body: [
      "L'exécution du service que tu demandes en créant un compte (conditions d'utilisation).",
      "Ton consentement, donné à l'inscription, pour les informations liées à ta santé physique (poids, taille). Tu peux le retirer à tout moment en effaçant ces informations ou en supprimant ton compte.",
    ],
  },
  {
    title: 'Qui y a accès',
    body: [
      "Tes amis acceptés voient ton profil public : pseudo, niveau, rang, cadre, titre, trophées et records mis en avant. Ton email, ton poids et ta date de naissance ne leur sont jamais montrés.",
      'Prestataires techniques, uniquement pour faire tourner le service : Vercel (hébergement de l\'application web), Render (hébergement du serveur), MongoDB Atlas (base de données), Brevo (envoi des emails de code), Expo (notifications), Google (seulement si tu utilises la connexion Google).',
      "Certains de ces prestataires peuvent traiter des données hors de l'Union européenne. Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou le Data Privacy Framework.",
    ],
  },
  {
    title: 'Durée de conservation',
    body: [
      "Tes données sont conservées tant que ton compte existe. À la suppression du compte, elles sont effacées immédiatement et définitivement du serveur.",
      'Les codes de vérification expirent après 10 à 15 minutes.',
    ],
  },
  {
    title: 'Tes droits',
    body: [
      "Tu disposes des droits d'accès, de rectification, d'effacement, de portabilité, de limitation et d'opposition sur tes données.",
      `Tu peux modifier ton profil et supprimer ton compte directement dans l'app. Pour toute autre demande, contacte l'éditeur ${contactLine}. Une réponse t'est apportée sous un mois.`,
      'Si tu estimes que tes droits ne sont pas respectés, tu peux adresser une réclamation à la CNIL (cnil.fr).',
    ],
  },
  {
    title: 'Stockage local et cookies',
    body: [
      "Athly n'utilise aucun cookie publicitaire ni de mesure d'audience. L'app utilise le stockage de ton navigateur ou de ton téléphone pour te garder connecté et conserver tes données hors ligne. Ce stockage est indispensable au fonctionnement et ne nécessite pas de consentement.",
    ],
  },
  {
    title: 'Sécurité',
    body: [
      'Les échanges sont chiffrés (HTTPS), les mots de passe et codes de vérification sont stockés hachés, et une réinitialisation du mot de passe déconnecte toutes les sessions ouvertes.',
    ],
  },
];

const TERMS = [
  {
    title: 'Le service',
    body: [
      'Athly est une application gratuite de suivi d\'entraînement sportif, avec un système de progression (XP, niveaux, trophées) et des fonctions sociales.',
      "En créant un compte, tu acceptes les présentes conditions. Si tu as moins de 15 ans, demande l'accord d'un parent avant de t'inscrire.",
    ],
  },
  {
    title: 'Ta santé avant tout',
    body: [
      "Athly n'est pas un dispositif médical et ne remplace pas l'avis d'un professionnel de santé. Les séances et charges proposées sont indicatives.",
      "Consulte un médecin avant de commencer un programme d'entraînement, surtout en cas de problème de santé, de blessure ou de reprise après une longue pause. Arrête l'exercice en cas de douleur ou de malaise.",
    ],
  },
  {
    title: 'Ton compte',
    body: [
      'Tu es responsable de la confidentialité de ton mot de passe et des actions réalisées depuis ton compte.',
      'Ton pseudo est visible par les autres utilisateurs : il doit rester respectueux. Les pseudos injurieux sont refusés.',
    ],
  },
  {
    title: 'Règles de bonne conduite',
    body: [
      "Pas de harcèlement via les fonctions sociales (notifications, réactions, groupes).",
      "Pas de tentative de contournement des règles du jeu (manipulation de l'XP, des coffres ou des récompenses) ni d'atteinte au fonctionnement du service.",
      "En cas de manquement, l'éditeur peut suspendre ou supprimer le compte concerné.",
    ],
  },
  {
    title: 'Disponibilité',
    body: [
      "Le service est fourni gratuitement, tel quel. L'éditeur fait de son mieux pour qu'il reste disponible et fiable, sans pouvoir le garantir en permanence. Le serveur peut mettre quelques secondes à démarrer après une période d'inactivité.",
      "Les éléments de jeu (XP, objets, trophées) n'ont aucune valeur monétaire et peuvent évoluer avec l'app.",
    ],
  },
  {
    title: 'Suppression',
    body: [
      'Tu peux supprimer ton compte à tout moment depuis Réglages. La suppression est immédiate et définitive.',
    ],
  },
  {
    title: 'Droit applicable',
    body: [
      'Ces conditions sont soumises au droit français. Elles peuvent être mises à jour ; la date de dernière mise à jour figure en haut de cette page.',
    ],
  },
];

const LEGAL_NOTICE = [
  {
    title: 'Éditeur',
    body: [
      `${LEGAL_INFO.appName} est édité par ${LEGAL_INFO.editorName}, à titre personnel et non commercial.`,
      `Contact : ${LEGAL_INFO.contactEmail || LEGAL_INFO.contactUrl}`,
    ],
  },
  {
    title: 'Hébergement',
    body: [
      'Application web : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.',
      'Serveur : Render Services, Inc., 525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis.',
      'Base de données : MongoDB Atlas, service de MongoDB, Inc.',
    ],
  },
  {
    title: 'Propriété intellectuelle',
    body: [
      "Le code source d'Athly est distribué sous licence GNU GPLv3. Le nom Athly, le logo et l'identité visuelle restent la propriété de l'éditeur.",
    ],
  },
];

const DOCS = {
  confidentialite: PRIVACY,
  conditions: TERMS,
  'mentions-legales': LEGAL_NOTICE,
};

export default function LegalScreen({ navigation, route }) {
  const docId = DOCS[route?.params?.doc] ? route.params.doc : 'confidentialite';
  const sections = DOCS[docId];

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={goBack}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1} accessibilityRole="header">
          {LEGAL_DOCS[docId]}
        </Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.updated}>Dernière mise à jour : {LEGAL_INFO.lastUpdated}</Text>

        {sections.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            {section.body.map((p) => (
              <Text key={p.slice(0, 40)} style={s.paragraph} selectable>{p}</Text>
            ))}
          </View>
        ))}

        <View style={s.otherDocs}>
          {Object.entries(LEGAL_DOCS)
            .filter(([id]) => id !== docId)
            .map(([id, label]) => (
              <TouchableOpacity
                key={id}
                style={s.docLink}
                onPress={() => navigation.setParams({ doc: id })}
                accessibilityRole="link"
              >
                <Text style={s.docLinkTxt}>{label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            ))}
          {!LEGAL_INFO.contactEmail && (
            <TouchableOpacity
              style={s.docLink}
              onPress={() => Linking.openURL(LEGAL_INFO.contactUrl)}
              accessibilityRole="link"
            >
              <Text style={s.docLinkTxt}>Contacter l'éditeur</Text>
              <Ionicons name="open-outline" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  content: { padding: 20, paddingBottom: 48 },
  updated: { color: Colors.textMuted, fontSize: 13, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  paragraph: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 10,
  },
  otherDocs: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 8,
  },
  docLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  docLinkTxt: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
});
