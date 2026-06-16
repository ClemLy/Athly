import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const LOGO = require('../../../assets/logo-orange.png');

function StepRow({ n, text }) {
  return (
    <View style={s.stepRow}>
      <View style={s.stepBadge}>
        <Text style={s.stepN}>{n}</Text>
      </View>
      <Text style={s.stepText}>{text}</Text>
    </View>
  );
}

function MethodCard({ icon, title, platform, steps, accent }) {
  return (
    <View style={[s.method, { borderColor: accent + '30' }]}>
      <View style={[s.methodHeader, { borderBottomColor: accent + '20' }]}>
        <Text style={s.methodIcon}>{icon}</Text>
        <View>
          <Text style={[s.methodTitle, { color: accent }]}>{title}</Text>
          <Text style={s.methodPlatform}>{platform}</Text>
        </View>
      </View>
      <View style={s.stepsList}>
        {steps.map((text, i) => (
          <StepRow key={i} n={i + 1} text={text} />
        ))}
      </View>
    </View>
  );
}

export default function DesktopInstallPage() {
  const url = window?.location?.origin ?? '';

  return (
    <View style={s.bg}>
      <View style={s.card}>

        <Image source={LOGO} style={s.logo} resizeMode="contain" />

        <Text style={s.headline}>Athly est une app mobile</Text>
        <Text style={s.subline}>
          Installez-la sur votre téléphone en quelques secondes pour profiter de l'expérience complète.
        </Text>

        {url ? (
          <View style={s.urlBox}>
            <Text style={s.urlLabel}>Adresse à ouvrir sur votre téléphone</Text>
            <Text style={s.urlText} selectable>{url}</Text>
          </View>
        ) : null}

        <View style={s.methods}>
          <MethodCard
            icon="🤖"
            title="Chrome"
            platform="Android"
            accent="#FE7439"
            steps={[
              'Ouvrez ce lien dans Chrome sur votre Android',
              'Appuyez sur ⋮ (3 points) en haut à droite',
              'Sélectionnez « Ajouter à l\'écran d\'accueil »',
            ]}
          />
          <MethodCard
            icon=""
            title="Safari"
            platform="iPhone · iPad"
            accent="#6E6AF0"
            steps={[
              'Ouvrez ce lien dans Safari sur votre iPhone',
              'Appuyez sur l\'icône Partager (□↑) en bas',
              'Choisissez « Sur l\'écran d\'accueil » puis Ajouter',
            ]}
          />
        </View>

        <View style={s.footer}>
          <View style={s.footerDot} />
          <Text style={s.footerText}>
            Déjà installé ? Ouvrez Athly depuis votre écran d'accueil.
          </Text>
          <View style={s.footerDot} />
        </View>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bg: {
    flex: 1,
    minHeight: '100vh',
    backgroundColor: '#030406',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 700,
    backgroundColor: '#080910',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(110,106,240,0.18)',
    padding: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
  },

  logo: {
    width: 160,
    height: 56,
    marginBottom: 28,
  },

  headline: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  subline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 460,
    marginBottom: 32,
  },

  urlBox: {
    backgroundColor: 'rgba(110,106,240,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(110,106,240,0.25)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 36,
    width: '100%',
  },
  urlLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  urlText: {
    fontSize: 15,
    color: '#6E6AF0',
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  methods: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    marginBottom: 32,
  },
  method: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  methodIcon: {
    fontSize: 24,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  methodPlatform: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 1,
  },
  stepsList: {
    padding: 16,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepN: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  stepText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
    flex: 1,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
});
