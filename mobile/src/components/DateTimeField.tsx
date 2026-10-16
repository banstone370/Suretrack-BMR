import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radius } from '../lib/theme';

function parseDate(value: string): Date {
  const d = new Date(value || '');
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Date input stored as 'YYYY-MM-DD', matching the web app */
export function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const onEvent = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed' || !selected) return;
    const mm = String(selected.getMonth() + 1).padStart(2, '0');
    const dd = String(selected.getDate()).padStart(2, '0');
    onChange(`${selected.getFullYear()}-${mm}-${dd}`);
  };
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={[styles.box, disabled && styles.disabled]} onPress={disabled ? undefined : () => setOpen(true)}>
        <Text style={{ color: value ? colors.text : colors.muted, fontSize: 15 }}>{value || 'Pick date'}</Text>
        <Text style={{ color: colors.muted }}>📅</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={parseDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onEvent}
        />
      ) : null}
      {open && Platform.OS === 'ios' ? (
        <Pressable onPress={() => setOpen(false)}>
          <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Time input stored as 'HH:mm' */
export function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string; // HH:mm
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const onEvent = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed' || !selected) return;
    const hh = String(selected.getHours()).padStart(2, '0');
    const mi = String(selected.getMinutes()).padStart(2, '0');
    onChange(`${hh}:${mi}`);
  };
  const d = parseDate(`2000-01-01T${value || '00:00'}:00`);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={[styles.box, disabled && styles.disabled]} onPress={disabled ? undefined : () => setOpen(true)}>
        <Text style={{ color: value ? colors.text : colors.muted, fontSize: 15 }}>{value || 'Pick time'}</Text>
        <Text style={{ color: colors.muted }}>🕐</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={d}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onEvent}
        />
      ) : null}
      {open && Platform.OS === 'ios' ? (
        <Pressable onPress={() => setOpen(false)}>
          <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

import { Platform } from 'react-native';

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  box: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disabled: { backgroundColor: colors.greyLight },
});
