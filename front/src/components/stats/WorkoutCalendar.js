import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// Calendrier mensuel léger : grille 7×N, points orange sur les jours avec séance.
// Pas de dépendance externe.
//
// Props :
//   - workoutDates : { 'YYYY-MM-DD': true }  (issu de aggregateGlobal)
//   - onSelectDate : (dateKey) => void  (optionnel)
//
const DAYS_LABEL = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function dayKey(year, month, day) {
  // mois 0-indexé
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Tableau de cells : null pour les vides (avant le 1er ou après le dernier jour)
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  // Pad fin pour compléter la dernière semaine
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function WorkoutCalendar({ workoutDates = {}, onSelectDate }) {
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());

  const previous = useCallback(() => {
    setCursor(({ year, month }) => {
      if (month === 0) return { year: year - 1, month: 11 };
      return { year, month: month - 1 };
    });
  }, []);

  const next = useCallback(() => {
    setCursor(({ year, month }) => {
      if (month === 11) return { year: year + 1, month: 0 };
      return { year, month: month + 1 };
    });
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <TouchableOpacity onPress={previous} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {MONTH_LABELS[cursor.month]} {cursor.year}
        </Text>
        <TouchableOpacity onPress={next} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdays}>
        {DAYS_LABEL.map((d, i) => (
          <Text key={`w-${i}`} style={styles.weekdayLabel}>{d}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (d === null) {
            return <View key={`c-${i}`} style={styles.cell} />;
          }
          const k = dayKey(cursor.year, cursor.month, d);
          const hasWorkout = !!workoutDates[k];
          const isToday = k === todayKey;
          return (
            <TouchableOpacity
              key={`c-${i}`}
              style={[styles.cell, isToday && styles.cellToday]}
              onPress={() => onSelectDate && onSelectDate(k)}
              activeOpacity={0.7}
              disabled={!onSelectDate}
            >
              <Text style={[styles.cellText, isToday && styles.cellTextToday]}>{d}</Text>
              {hasWorkout ? <View style={styles.dot} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 16,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  weekdays: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  cellToday: {
    backgroundColor: 'rgba(254, 116, 57, 0.10)',
    borderRadius: 8,
  },
  cellText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  cellTextToday: {
    color: Colors.primary,
    fontWeight: '800',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
    marginTop: 2,
  },
});
