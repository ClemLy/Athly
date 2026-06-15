import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { SHAPE_DEFS, COLOR_DEFS, ColorPreview, ShapePreview } from './AvatarFrame';
import AvatarFrame from './AvatarFrame';

// ─── Item components (memoized) ───────────────────────────────────────────────

const ShapeItem = React.memo(function ShapeItem({ shape, previewColor, selected, locked, onPress }) {
  const safeColor = previewColor !== 'none' ? previewColor : 'bronze';
  return (
    <TouchableOpacity
      style={[styles.item, selected && styles.itemSelected]}
      onPress={() => !locked && onPress(shape.id)}
      activeOpacity={locked ? 1 : 0.75}
    >
      <View style={styles.previewWrap}>
        <ShapePreview shapeId={shape.id} colorId={safeColor} size={36} locked={locked} />
        {locked && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.55)" />
          </View>
        )}
        {selected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={9} color="#fff" />
          </View>
        )}
      </View>
      <Text style={[styles.itemName, { color: locked ? Colors.textMuted : Colors.textPrimary }]} numberOfLines={1}>
        {shape.name}
      </Text>
      <Text style={styles.itemUnlock}>{shape.unlockLevel === 0 ? 'Dispo' : `Niv. ${shape.unlockLevel}`}</Text>
    </TouchableOpacity>
  );
});

const ColorItem = React.memo(function ColorItem({ colorDef, selected, locked, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.item, selected && styles.itemSelected]}
      onPress={() => !locked && onPress(colorDef.id)}
      activeOpacity={locked ? 1 : 0.75}
    >
      <View style={styles.previewWrap}>
        <ColorPreview colorId={colorDef.id} size={36} locked={locked} />
        {locked && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.55)" />
          </View>
        )}
        {selected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={9} color="#fff" />
          </View>
        )}
      </View>
      <Text style={[styles.itemName, { color: locked ? Colors.textMuted : Colors.textPrimary }]} numberOfLines={1}>
        {colorDef.name}
      </Text>
      <Text style={styles.itemUnlock}>{colorDef.unlockLevel === 0 ? 'Dispo' : `Niv. ${colorDef.unlockLevel}`}</Text>
    </TouchableOpacity>
  );
});

// ─── BorderPicker ─────────────────────────────────────────────────────────────

export default function BorderPicker({
  visible,
  onClose,
  currentShapeId = 'circle',
  currentColorId = 'none',
  playerLevel = 0,
  userInitial = 'A',
  onSelectShape,
  onSelectColor,
}) {
  const [previewShape, setPreviewShape] = useState(currentShapeId);
  const [previewColor, setPreviewColor] = useState(currentColorId);

  React.useEffect(() => {
    if (visible) {
      setPreviewShape(currentShapeId);
      setPreviewColor(currentColorId);
    }
  }, [visible, currentShapeId, currentColorId]);

  const handleShape = useCallback((id) => {
    setPreviewShape(id);
    if (onSelectShape) onSelectShape(id);
  }, [onSelectShape]);

  const handleColor = useCallback((id) => {
    setPreviewColor(id);
    if (onSelectColor) onSelectColor(id);
  }, [onSelectColor]);

  const unlockedShapes = SHAPE_DEFS.filter((s) => playerLevel >= s.unlockLevel).length;
  const unlockedColors = COLOR_DEFS.filter((c) => playerLevel >= c.unlockLevel).length;

  // Build flat FlatList data: no nested ScrollViews → no scroll-grip issues
  const flatData = useMemo(() => {
    const rows = [];

    rows.push({ type: 'preview' });

    rows.push({ type: 'sectionHeader', title: 'FORME', count: `${unlockedShapes}/${SHAPE_DEFS.length} débloquées` });
    // Group shapes into rows of 4
    for (let i = 0; i < SHAPE_DEFS.length; i += 4) {
      rows.push({ type: 'shapeRow', items: SHAPE_DEFS.slice(i, i + 4) });
    }

    rows.push({ type: 'sectionHeader', title: 'COULEUR', count: `${unlockedColors}/${COLOR_DEFS.length} débloquées`, topGap: true });
    // Group colors into rows of 4
    for (let i = 0; i < COLOR_DEFS.length; i += 4) {
      rows.push({ type: 'colorRow', items: COLOR_DEFS.slice(i, i + 4) });
    }

    rows.push({ type: 'spacer' });
    return rows;
  }, [previewShape, previewColor, playerLevel, unlockedShapes, unlockedColors]);

  const renderItem = useCallback(({ item }) => {
    switch (item.type) {
      case 'preview':
        return (
          <View style={styles.previewSection}>
            <View style={styles.previewCard}>
              {/*
                Pass userInitial so AvatarFrame renders the letter as SVG <Text> at
                (cx,cy) — perfectly centred for every shape. The ghost circle is gone:
                no more borderRadius/borderColor wrapper passed as children.
                The fallback View (for colorId='none') keeps a plain circle appearance.
              */}
              <AvatarFrame
                shapeId={previewShape}
                colorId={previewColor}
                size={72}
                userInitial={(userInitial || 'A').slice(0, 1).toUpperCase()}
              >
                {/* Shown only when colorId='none' (AvatarFrame returns <>children</>) */}
                <View style={styles.previewAvatarFallback}>
                  <Text style={styles.previewInitial}>{(userInitial || 'A').slice(0, 1).toUpperCase()}</Text>
                </View>
              </AvatarFrame>
              <View style={styles.previewInfo}>
                <Text style={styles.previewLabel}>
                  {SHAPE_DEFS.find((s) => s.id === previewShape)?.name || 'Cercle'}
                </Text>
                <Text style={styles.previewSub}>
                  {COLOR_DEFS.find((c) => c.id === previewColor)?.name || 'Défaut'}
                </Text>
              </View>
            </View>
          </View>
        );

      case 'sectionHeader':
        return (
          <View style={[styles.sectionHeader, item.topGap && { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>{item.title}</Text>
            <Text style={styles.sectionCount}>{item.count}</Text>
          </View>
        );

      case 'shapeRow':
        return (
          <View style={styles.gridRow}>
            {item.items.map((shape) => (
              <ShapeItem
                key={shape.id}
                shape={shape}
                previewColor={previewColor}
                selected={shape.id === previewShape}
                locked={playerLevel < shape.unlockLevel}
                onPress={handleShape}
              />
            ))}
            {/* Pad row to 4 items so widths are consistent */}
            {item.items.length < 4 && Array.from({ length: 4 - item.items.length }).map((_, i) => (
              <View key={`pad-${i}`} style={styles.item} />
            ))}
          </View>
        );

      case 'colorRow':
        return (
          <View style={styles.gridRow}>
            {item.items.map((colorDef) => (
              <ColorItem
                key={colorDef.id}
                colorDef={colorDef}
                selected={colorDef.id === previewColor}
                locked={playerLevel < colorDef.unlockLevel}
                onPress={handleColor}
              />
            ))}
            {item.items.length < 4 && Array.from({ length: 4 - item.items.length }).map((_, i) => (
              <View key={`pad-${i}`} style={styles.item} />
            ))}
          </View>
        );

      case 'spacer':
        return <View style={{ height: 32 }} />;

      default:
        return null;
    }
  }, [previewShape, previewColor, playerLevel, userInitial, handleShape, handleColor]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop — tap to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      {/* Sheet — isolated from backdrop touch */}
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>Personnalisation</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/*
          FlatList replaces ScrollView:
          - nestedScrollEnabled prevents Android gesture conflicts
          - No Pressable wrapper → no gesture interception
          - keyExtractor uses index to avoid key collisions across row types
        */}
        <FlatList
          data={flatData}
          renderItem={renderItem}
          keyExtractor={(_, index) => String(index)}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={false}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#13131C',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '88%',
  },
  listContent: { paddingBottom: 16 },

  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignSelf: 'center', marginBottom: 14,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  title:    { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 4 },

  previewSection: { alignItems: 'center', marginBottom: 20 },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18, paddingVertical: 16, paddingHorizontal: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', width: '100%',
  },
  // Fallback shown only when colorId='none' (AvatarFrame returns children as-is).
  // Keeps the plain-circle look for the "Défaut" colour option.
  previewAvatarFallback: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#0D0D15',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewInitial: { color: Colors.textPrimary, fontSize: 28, fontWeight: '900' },
  previewInfo:    { flex: 1 },
  previewLabel:   { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  previewSub:     { color: Colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 3 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  sectionCount: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },

  gridRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },

  item: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  itemSelected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  previewWrap: {
    position: 'relative', marginBottom: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  lockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#13131C',
  },
  itemName:   { fontSize: 9, fontWeight: '700', textAlign: 'center', color: Colors.textPrimary },
  itemUnlock: { color: Colors.textMuted, fontSize: 8, fontWeight: '500', marginTop: 1, textAlign: 'center' },
});
