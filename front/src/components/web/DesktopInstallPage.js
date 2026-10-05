import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import QRCode from './QRCode';

const LOGO = require('../../../assets/logo-orange.png');

// ─── Page d'accueil sur ordinateur ────────────────────────────────────────────
// Athly s'utilise sur téléphone : on explique comment l'ouvrir (QR code) puis
// l'installer sur l'écran d'accueil, iPhone comme Android. Un lien permet
// quand même d'essayer l'app dans le navigateur.

function Step({ n, children }) {
  return (
    <View style={s.step}>
      <View style={s.stepBadge}><Text style={s.stepN}>{n}</Text></View>
      <Text style={s.stepText}>{children}</Text>
    </View>
  );
}

function InlineIcon({ name }) {
  return <Ionicons name={name} size={14} color={Colors.textPrimary} style={s.inlineIcon} />;
}

function PlatformCard({ icon, title, subtitle, children }) {
  return (
    <View style={s.platform}>
      <View style={s.platformHead}>
        <Ionicons name={icon} size={20} color={Colors.textPrimary} />
        <View>
          <Text style={s.platformTitle}>{title}</Text>
          <Text style={s.platformSub}>{subtitle}</Text>
        </View>
      </View>
      <View style={s.steps}>{children}</View>
    </View>
  );
}

const FEATURES = [
  { icon: 'barbell-outline', label: 'Tes séances guidées, série par série' },
  { icon: 'flash-outline', label: "De l'XP, des niveaux et des trophées à chaque effort" },
  { icon: 'people-outline', label: 'Des défis et des séances à plusieurs avec tes amis' },
];

export default function DesktopInstallPage({ onOpenApp }) {
  const url = typeof window !== 'undefined' ? window.location.origin : '';
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible : l'adresse reste sélectionnable à la main
    }
  };

  return (
    <ScrollView style={s.bg} contentContainerStyle={s.scroll}>
      <View style={[s.wrap, wide && s.wrapWide]}>
        {/* ── Colonne gauche : pitch ─────────────────────────────────────── */}
        <View style={[s.intro, wide && s.introWide]}>
          <Image source={LOGO} style={s.logo} resizeMode="contain" accessibilityLabel="Athly" />
          <Text style={s.headline} accessibilityRole="header">
            Ta progression en salle,{'\n'}en mode jeu.
          </Text>
          <Text style={s.subline}>
            Athly est une application mobile. Ouvre-la sur ton téléphone et ajoute-la à ton
            écran d'accueil : elle s'utilise comme une app classique, gratuitement.
          </Text>

          <View style={s.features}>
            {FEATURES.map((f) => (
              <View key={f.label} style={s.feature}>
                <View style={s.featureIcon}>
                  <Ionicons name={f.icon} size={18} color={Colors.primary} />
                </View>
                <Text style={s.featureTxt}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Colonne droite : QR code + installation ────────────────────── */}
        <View style={[s.card, wide && s.cardWide]}>
          <View style={s.qrRow}>
            <View style={s.qrBox}>
              <QRCode value={url} size={148} />
            </View>
            <View style={s.qrText}>
              <Text style={s.cardTitle}>Scanne avec ton téléphone</Text>
              <Text style={s.cardBody}>Ouvre l'appareil photo et vise le code, ou tape cette adresse :</Text>
              <Pressable
                onPress={copyUrl}
                style={({ hovered }) => [s.urlBox, hovered && s.urlBoxHover]}
                accessibilityRole="button"
                accessibilityLabel={`Copier l'adresse ${url}`}
              >
                <Text style={s.urlText} selectable numberOfLines={1}>{url.replace(/^https?:\/\//, '')}</Text>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? Colors.success : Colors.textSecondary} />
              </Pressable>
              <Text style={[s.copied, !copied && s.hidden]} accessibilityLiveRegion="polite">
                {copied ? 'Adresse copiée' : ' '}
              </Text>
            </View>
          </View>

          <View style={s.divider} />

          <Text style={s.installTitle}>Puis installe-la en 3 gestes</Text>
          <View style={[s.platforms, wide && s.platformsWide]}>
            <PlatformCard icon="logo-apple" title="iPhone" subtitle="avec Safari">
              <Step n={1}>Ouvre l'adresse dans Safari</Step>
              <Step n={2}>Touche <InlineIcon name="share-outline" /> Partager, en bas de l'écran</Step>
              <Step n={3}>Choisis « Sur l'écran d'accueil », puis Ajouter</Step>
            </PlatformCard>
            <PlatformCard icon="logo-android" title="Android" subtitle="avec Chrome">
              <Step n={1}>Ouvre l'adresse dans Chrome</Step>
              <Step n={2}>Touche <InlineIcon name="ellipsis-vertical" /> en haut à droite</Step>
              <Step n={3}>Choisis « Installer l'application » ou « Ajouter à l'écran d'accueil »</Step>
            </PlatformCard>
          </View>

          <Pressable
            onPress={onOpenApp}
            style={({ hovered }) => [s.tryBtn, hovered && s.tryBtnHover]}
            accessibilityRole="button"
          >
            <Text style={s.tryTxt}>Essayer dans le navigateur</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: Colors.backgroundDeep },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  wrap: { width: '100%', maxWidth: 560, gap: 32 },
  wrapWide: { maxWidth: 1080, flexDirection: 'row', alignItems: 'center', gap: 64 },

  intro: {},
  introWide: { flex: 1 },
  logo: { width: 132, height: 88, marginLeft: -14, marginBottom: 20 },
  headline: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1.2,
    marginBottom: 16,
  },
  subline: {
    fontSize: 17,
    lineHeight: 27,
    color: Colors.textSecondary,
    maxWidth: 460,
    marginBottom: 28,
  },
  features: { gap: 14 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(254,116,57,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureTxt: { color: Colors.textPrimary, fontSize: 15, fontWeight: '500' },

  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.separator,
    padding: 28,
  },
  cardWide: { width: 500 },

  qrRow: { flexDirection: 'row', gap: 22, alignItems: 'center' },
  // Fond blanc obligatoire : un QR code doit garder un fort contraste pour être lu
  qrBox: { padding: 10, borderRadius: 16, backgroundColor: Colors.textPrimary },
  qrText: { flex: 1 },
  cardTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  cardBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  urlBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: Colors.separator,
    borderRadius: 10, paddingHorizontal: 12, height: 40,
    cursor: 'pointer',
  },
  urlBoxHover: { borderColor: Colors.borderDim },
  urlText: { flex: 1, color: Colors.primary, fontSize: 14, fontWeight: '700' },
  copied: { color: Colors.success, fontSize: 12, marginTop: 6, fontWeight: '600' },
  hidden: { opacity: 0 },

  divider: { height: 1, backgroundColor: Colors.separator, marginVertical: 24 },

  installTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 14 },
  platforms: { gap: 12 },
  platformsWide: {},
  platform: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.separator,
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 16,
  },
  platformHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  platformTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  platformSub: { color: Colors.textMuted, fontSize: 12 },
  steps: { gap: 10 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepN: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary },
  stepText: { flex: 1, fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
  inlineIcon: { marginHorizontal: 2, top: 2 },

  tryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 20, height: 44, borderRadius: 12,
    cursor: 'pointer',
  },
  tryBtnHover: { backgroundColor: 'rgba(255,255,255,0.04)' },
  tryTxt: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
