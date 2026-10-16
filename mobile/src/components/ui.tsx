import React, { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../lib/theme';
import { BATCH_STATUS_TONE, statusLabel } from '../lib/format';

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={edges}>
      {footer}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: spacing }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

type Tone = 'grey' | 'info' | 'success' | 'warning' | 'danger';

export function Badge({ text, tone = 'grey' }: { text: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`] as object]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`] as object]}>{text}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const tone = (status && BATCH_STATUS_TONE[status]) || 'grey';
  return <Badge text={statusLabel(status)} tone={tone} />;
}

export function ProgressBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent || 0));
  return (
    <View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${p}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{p}%</Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  editable = true,
  multiline,
  autoCapitalize,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText?: (t: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address' | 'url';
  placeholder?: string;
  editable?: boolean;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 88, textAlignVertical: 'top' }, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        editable={!!onChangeText && editable}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? 'none'}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

export function Checkbox({
  label,
  checked,
  onToggle,
  disabled,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      style={({ pressed }) => [styles.checkboxRow, pressed && { opacity: 0.8 }]}
      disabled={disabled}
    >
      <View style={[styles.checkboxBox, checked && styles.checkboxOn]}>
        {checked ? <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text> : null}
      </View>
      <Text style={{ color: colors.text, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`] as object,
        (disabled || loading) && { opacity: 0.45 },
        pressed && !disabled && !loading && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, styles[`buttonText_${variant}`] as object]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 8 }}>{children}</View>;
}

export function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoTile}>
      <Text style={styles.infoTileLabel}>{label}</Text>
      <Text style={styles.infoTileValue}>{value}</Text>
    </View>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text style={styles.kvValue}>{String(value)}</Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={{ color: colors.danger, flex: 1 }}>{message}</Text>
    </View>
  );
}

export function NoticeBanner({ message, tone = 'info' }: { message: string; tone?: 'info' | 'warning' | 'success' }) {
  if (!message) return null;
  return (
    <View style={[styles.notice, styles[`notice_${tone}`] as object]}>
      <Text style={{ color: colors.text, flex: 1 }}>{message}</Text>
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ marginTop: 8, color: colors.muted }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <Text style={{ color: colors.muted, textAlign: 'center', padding: 8 }}>{text}</Text>
    </Card>
  );
}

/** Simple modal-backed option picker (matches web <select> behaviour) */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Select…',
}: {
  label: string;
  value: T | '' | null;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ marginBottom: spacing }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={disabled ? undefined : () => setOpen(true)}
        style={[styles.input, styles.selectInput, disabled && styles.inputDisabled]}
      >
        <Text style={{ color: selected ? colors.text : colors.muted }}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={{ color: colors.muted }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={styles.modalOption}
              >
                <Text style={{ color: colors.text, fontSize: 15 }}>
                  {o.label}
                  {o.value === value ? '  ●' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export const OBSERVATION_PRESETS = [
  'Within limits',
  'Complies with SOP',
  'No deviation observed',
  'Satisfactory',
  'Pass as per specification',
  'Parameters maintained',
  'Visual condition acceptable',
  'As per batch record',
  'No abnormality found',
  'Clean and contamination-free',
  'Conforms to standards',
  'Other',
];

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: spacing,
    marginBottom: spacing,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
    marginTop: 4,
  },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badge_grey: { backgroundColor: colors.greyLight },
  badge_info: { backgroundColor: colors.primaryLight },
  badge_success: { backgroundColor: colors.successLight },
  badge_warning: { backgroundColor: colors.warningLight },
  badge_danger: { backgroundColor: colors.dangerLight },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeText_grey: { color: colors.grey },
  badgeText_info: { color: colors.primary },
  badgeText_success: { color: colors.success },
  badgeText_warning: { color: colors.warning },
  badgeText_danger: { color: colors.danger },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.greyLight, overflow: 'hidden', flex: 1 },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  progressLabel: { fontSize: 12, color: colors.muted, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  inputDisabled: { backgroundColor: colors.greyLight, color: colors.muted },
  selectInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '60%',
  },
  modalOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    flex: 1,
    marginBottom: 8,
  },
  button_primary: { backgroundColor: colors.primary },
  button_secondary: { backgroundColor: colors.primaryLight },
  button_danger: { backgroundColor: colors.danger },
  button_success: { backgroundColor: colors.success },
  button_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 15, fontWeight: '700' },
  buttonText_primary: { color: '#fff' },
  buttonText_secondary: { color: colors.primary },
  buttonText_danger: { color: '#fff' },
  buttonText_success: { color: '#fff' },
  buttonText_ghost: { color: colors.text },
  infoTile: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    marginBottom: 8,
    minWidth: 100,
    flex: 1,
  },
  infoTileLabel: { fontSize: 11, color: colors.muted, marginBottom: 2 },
  infoTileValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  kvLabel: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  kvValue: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  errorBanner: {
    backgroundColor: colors.dangerLight,
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing,
  },
  notice: { borderRadius: 8, padding: 10, marginBottom: spacing },
  notice_info: { backgroundColor: colors.primaryLight },
  notice_warning: { backgroundColor: colors.warningLight },
  notice_success: { backgroundColor: colors.successLight },
});
