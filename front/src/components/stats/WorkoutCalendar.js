import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { formatWeight } from '../../utils/format';
import { indexLogsByDay, monthSummary, longDay, MONTHS_LONG } from '../../services/periodStats';

// ─── WorkoutCalendar ──────────────────────────────────────────────────────────
//
// Calendrier mensuel sur TOUT l'historique : les jours d'entraînement sont des
// pastilles pleines, repérables d'un coup d'œil. Appuyer sur l'une d'elles
// filtre la liste des séances sur ce jour (re-appuyer annule le filtre).
// Pas de mois futurs : il n'y a rien à y voir.
//
// Props :
//   logs        séances
//   selectedDay 'YYYY-MM-DD' | null
//   onSelectDay (dateKey | null) => void

const WEEKDAYS = [
  { short: 'L', long: 'lundi' }, { short: 'M', long: 'mardi' }, { short: 'M', long: 'mercredi' },
  { short: 'J', long: 'jeudi' }, { short: 'V', long: 'vendredi' }, { short: 'S', long: 'samedi' },
  { short: 'D', long: 'dimanche' },
];

function dayKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildMonthGrid(year, month) {
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function WorkoutCalendar({ logs = [], selectedDay = null, onSelectDay }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const byDay = useMemo(() => indexLogsByDay(logs), [logs]);
  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const summary = useMemo(() => monthSummary(logs, cursor.year, cursor.month), [logs, cursor]);

  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());
  const isCurrentMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth();
  const monthName = `${MONTHS_LONG[cursor.month].charAt(0).toUpperCase()}${MONTHS_LONG[cursor.month].slice(1)} ${cursor.year}`;

  const previous = useCallback(() => {
    setCursor(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }));
  }, []);
  const next = useCallback(() => {
    setCursor(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }));
  }, []);

  return (
    <View>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Mois précédent"
          onPress={previous}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} accessibilityRole="header">{monthName}</Text>
          <Text style={styles.headerSub}>
            {summary.sessions > 0
              ? `${summary.sessions} séance${summary.sessions > 1 ? 's' : ''}  ·  ${formatWeight(summary.volume)}`
              : 'Aucune séance'}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Mois suivant"
          accessibilityState={{ disabled: isCurrentMonth }}
          onPress={next}
          disabled={isCurrentMonth}
          style={[styles.navBtn, isCurrentMonth && styles.navBtnDisabled]}
        >
          <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAYS.map((d) => (
          <Text key={d.long} style={styles.weekdayLabel} accessibilityLabel={d.long}>{d.short}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={`c-${i}`} style={styles.cell} />;
          const k = dayKey(cursor.year, cursor.month, d);
          const count = (byDay[k] || []).length;
          const isToday = k === todayKey;
          const isFuture = k > todayKey;
          const isSelected = k === selectedDay;

          if (count === 0) {
            return (
              <View key={`c-${i}`} style={styles.cell} accessible accessibilityLabel={`${longDay(k)}${isToday ? ", aujourd'hui" : ''}, repos`}>
                <View style={[styles.day, isToday && styles.dayToday]}>
                  <Text style={[styles.dayText, isFuture && styles.dayTextFuture, isToday && styles.dayTextToday]}>{d}</Text>
                </View>
              </View>
            );
          }
          return (
            <TouchableOpacity
              key={`c-${i}`}
              style={styles.cell}
              onPress={() => onSelectDay && onSelectDay(isSelected ? null : k)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${longDay(k)}, ${count} séance${count > 1 ? 's' : ''}`}
              accessibilityHint={isSelected ? 'Affiche toutes les séances' : 'Affiche les séances de ce jour'}
            >
              <View style={[styles.day, styles.dayTrained, isSelected && styles.daySelected]}>
                <Text style={styles.dayTextTrained}>{d}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  headerSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  navBtnDisabled: { opacity: 0.3 },

  weekdays: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', color: Colors.textMuted, fontSize: 12, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: '82%', maxWidth: 40, aspectRatio: 1, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  dayToday: { borderWidth: 1.5, borderColor: `${Colors.primary}AA` },
  dayTrained: { backgroundColor: Colors.primary },
  daySelected: { borderWidth: 2.5, borderColor: '#FFFFFF' },
  dayText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'] },
  dayTextFuture: { color: 'rgba(255,255,255,0.22)' },
  dayTextToday: { color: Colors.primary, fontWeight: '800' },
  dayTextTrained: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
