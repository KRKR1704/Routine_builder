import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontSize, Spacing, Radius } from '../../constants/theme';
import { RoutineBlock, Priority } from '../../types/routine';
import { formatTime, getDurationMinutes, formatDuration } from '../../utils/time';
import PriorityBadge from '../../components/PriorityBadge';
import ModeSelector from '../../components/ModeSelector';
import AppButton from '../../components/AppButton';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../utils/api';
import { toRoutineBlocks } from '../../utils/transforms';

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

type BlockFormState = {
  title: string;
  startTime: string;
  endTime: string;
  priority: Priority;
  isFixed: boolean;
  canShift: boolean;
  canCompress: boolean;
  canSkip: boolean;
  recoverIfMissed: boolean;
  reminderOffsetMinutes: string;
};

const defaultForm: BlockFormState = {
  title: '',
  startTime: '09:00',
  endTime: '10:00',
  priority: 'medium',
  isFixed: false,
  canShift: true,
  canCompress: true,
  canSkip: false,
  recoverIfMissed: false,
  reminderOffsetMinutes: '10',
};

export default function RoutineScreen() {
  const { userId } = useUser();
  const [blocks, setBlocks] = useState<RoutineBlock[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlockFormState>(defaultForm);

  const loadRoutine = useCallback(async () => {
    if (!userId) return;
    try {
      const raw = await api.routine.list(userId);
      setBlocks(toRoutineBlocks(raw));
    } catch {
      // Keep existing state on error
    }
  }, [userId]);

  useEffect(() => {
    loadRoutine();
  }, [loadRoutine]);

  const openAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setModalVisible(true);
  };

  const openEdit = (block: RoutineBlock) => {
    setEditingId(block.id);
    setForm({
      title: block.title,
      startTime: block.startTime,
      endTime: block.endTime,
      priority: block.priority,
      isFixed: block.isFixed,
      canShift: block.canShift,
      canCompress: block.canCompress,
      canSkip: block.canSkip,
      recoverIfMissed: block.recoverIfMissed,
      reminderOffsetMinutes: block.reminderOffsetMinutes.toString(),
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Missing title', 'Please enter a block title.');
      return;
    }
    const reminder = parseInt(form.reminderOffsetMinutes, 10) || 0;
    setModalVisible(false);

    try {
      if (editingId) {
        const raw = await api.routine.update(parseInt(editingId, 10), {
          title: form.title.trim(),
          start_time: form.startTime,
          end_time: form.endTime,
          priority: form.priority,
          is_fixed: form.isFixed,
          can_shift: form.canShift,
          can_compress: form.canCompress,
          can_skip: form.canSkip,
          recover_if_missed: form.recoverIfMissed,
          reminder_offset_minutes: reminder,
        });
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === editingId
              ? { ...b, ...form, reminderOffsetMinutes: reminder, id: String(raw.id) }
              : b,
          ),
        );
      } else {
        if (!userId) return;
        const raw = await api.routine.create(userId, {
          title: form.title.trim(),
          start_time: form.startTime,
          end_time: form.endTime,
          priority: form.priority,
          is_fixed: form.isFixed,
          can_shift: form.canShift,
          can_compress: form.canCompress,
          can_skip: form.canSkip,
          recover_if_missed: form.recoverIfMissed,
          reminder_offset_minutes: reminder,
        });
        const newBlock: RoutineBlock = {
          id: String(raw.id),
          title: raw.title,
          startTime: raw.start_time,
          endTime: raw.end_time,
          priority: raw.priority as Priority,
          isFixed: raw.is_fixed,
          canShift: raw.can_shift,
          canCompress: raw.can_compress,
          canSkip: raw.can_skip,
          recoverIfMissed: raw.recover_if_missed,
          reminderOffsetMinutes: raw.reminder_offset_minutes ?? 0,
        };
        setBlocks((prev) => [...prev, newBlock]);
      }
    } catch {
      Alert.alert('Error', 'Failed to save routine block. Please try again.');
      loadRoutine(); // Refresh to sync state
    }
  };

  const handleMoveUp = async (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx <= 0) return;
    const newBlocks = [...blocks];
    [newBlocks[idx - 1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx - 1]];
    setBlocks(newBlocks);
    try {
      await Promise.all([
        api.routine.update(parseInt(newBlocks[idx - 1].id, 10), { sort_order: idx - 1 }),
        api.routine.update(parseInt(newBlocks[idx].id, 10), { sort_order: idx }),
      ]);
    } catch {
      setBlocks(blocks); // Revert on failure
    }
  };

  const handleMoveDown = async (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx >= blocks.length - 1) return;
    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[idx + 1]] = [newBlocks[idx + 1], newBlocks[idx]];
    setBlocks(newBlocks);
    try {
      await Promise.all([
        api.routine.update(parseInt(newBlocks[idx].id, 10), { sort_order: idx }),
        api.routine.update(parseInt(newBlocks[idx + 1].id, 10), { sort_order: idx + 1 }),
      ]);
    } catch {
      setBlocks(blocks); // Revert on failure
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Block', 'Remove this block from your routine?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBlocks((prev) => prev.filter((b) => b.id !== id));
          try {
            await api.routine.delete(parseInt(id, 10));
          } catch {
            Alert.alert('Error', 'Failed to delete block.');
            loadRoutine();
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Routine Builder</Text>
          <Text style={styles.subtitle}>{blocks.length} blocks · ideal daily schedule</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.75}>
          <Ionicons name="add" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {blocks.map((block, index) => {
          const duration = getDurationMinutes(block.startTime, block.endTime);
          const isFirst = index === 0;
          const isLast = index === blocks.length - 1;
          return (
            <View key={block.id} style={styles.card}>
              <View style={[styles.cardAccent, { backgroundColor: accentForPriority(block.priority) }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.blockTime}>
                      {formatTime(block.startTime)} – {formatTime(block.endTime)}
                      <Text style={styles.blockDuration}> · {formatDuration(duration)}</Text>
                    </Text>
                    <Text style={styles.blockTitle}>{block.title}</Text>
                    <View style={styles.badgeRow}>
                      <PriorityBadge priority={block.priority} />
                      <FlagBadge label={block.isFixed ? 'Fixed' : 'Flexible'} active={block.isFixed} />
                      {block.recoverIfMissed && (
                        <FlagBadge label="Recoverable" accent />
                      )}
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    {/* Reorder buttons */}
                    <View style={styles.reorderCol}>
                      <TouchableOpacity
                        onPress={() => handleMoveUp(block.id)}
                        style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
                        hitSlop={4}
                        disabled={isFirst}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={14}
                          color={isFirst ? Colors.textDisabled : Colors.textSecondary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleMoveDown(block.id)}
                        style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
                        hitSlop={4}
                        disabled={isLast}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={14}
                          color={isLast ? Colors.textDisabled : Colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                    {/* Edit / Delete */}
                    <TouchableOpacity onPress={() => openEdit(block)} style={styles.iconBtn} hitSlop={6}>
                      <Ionicons name="pencil-outline" size={17} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(block.id)} style={styles.iconBtn} hitSlop={6}>
                      <Ionicons name="trash-outline" size={17} color={Colors.missed} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.addBlockBtn} onPress={openAdd} activeOpacity={0.75}>
          <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.addBlockBtnText}>Add Routine Block</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingId ? 'Edit Block' : 'New Routine Block'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <ModalField
              label="Block Title"
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="e.g. Deep Study"
            />
            <ModalField
              label="Start Time (HH:MM)"
              value={form.startTime}
              onChangeText={(v) => setForm((f) => ({ ...f, startTime: v }))}
              placeholder="09:00"
            />
            <ModalField
              label="End Time (HH:MM)"
              value={form.endTime}
              onChangeText={(v) => setForm((f) => ({ ...f, endTime: v }))}
              placeholder="10:00"
            />

            <Text style={styles.modalFieldLabel}>Priority</Text>
            <ModeSelector
              options={PRIORITY_OPTIONS}
              value={form.priority}
              onChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}
            />

            <Text style={styles.modalFieldLabel}>Timing Type</Text>
            <ModeSelector
              options={[
                { value: 'false', label: 'Flexible' },
                { value: 'true', label: 'Fixed' },
              ]}
              value={form.isFixed ? 'true' : 'false'}
              onChange={(v) => setForm((f) => ({ ...f, isFixed: v === 'true' }))}
            />

            <View style={styles.togglesSection}>
              <ToggleRow
                label="Can Shift"
                value={form.canShift}
                onChange={(v) => setForm((f) => ({ ...f, canShift: v }))}
              />
              <ToggleRow
                label="Can Compress"
                value={form.canCompress}
                onChange={(v) => setForm((f) => ({ ...f, canCompress: v }))}
              />
              <ToggleRow
                label="Can Skip"
                value={form.canSkip}
                onChange={(v) => setForm((f) => ({ ...f, canSkip: v }))}
              />
              <ToggleRow
                label="Recover if Missed"
                value={form.recoverIfMissed}
                onChange={(v) => setForm((f) => ({ ...f, recoverIfMissed: v }))}
                accent
              />
            </View>

            <ModalField
              label="Reminder Offset (minutes before)"
              value={form.reminderOffsetMinutes}
              onChangeText={(v) => setForm((f) => ({ ...f, reminderOffsetMinutes: v }))}
              placeholder="10"
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <AppButton label={editingId ? 'Save Changes' : 'Add Block'} onPress={handleSave} />
              <AppButton
                label="Cancel"
                onPress={() => setModalVisible(false)}
                variant="ghost"
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function ModalField({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={modalFieldStyles.container}>
      <Text style={modalFieldStyles.label}>{label}</Text>
      <TextInput
        style={modalFieldStyles.input}
        placeholderTextColor={Colors.textMuted}
        keyboardAppearance="dark"
        {...props}
      />
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  accent = false,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  accent?: boolean;
}) {
  return (
    <View style={toggleStyles.row}>
      <Text style={[toggleStyles.label, accent && toggleStyles.labelAccent]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primaryDim }}
        thumbColor={value ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}

function FlagBadge({ label, active = false, accent = false }: { label: string; active?: boolean; accent?: boolean }) {
  return (
    <View
      style={[
        flagStyles.badge,
        active ? flagStyles.badgeActive : null,
        accent ? flagStyles.badgeAccent : null,
      ]}
    >
      <Text
        style={[
          flagStyles.label,
          active ? flagStyles.labelActive : null,
          accent ? flagStyles.labelAccent : null,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function accentForPriority(p: Priority): string {
  const map: Record<Priority, string> = {
    critical: Colors.critical,
    high: Colors.high,
    medium: Colors.medium,
    low: Colors.low,
  };
  return map[p];
}

const modalFieldStyles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
});

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: '500' },
  labelAccent: { color: Colors.primary },
});

const flagStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  badgeActive: { backgroundColor: Colors.primaryBg },
  badgeAccent: { backgroundColor: Colors.completedBg },
  label: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  labelActive: { color: Colors.primary },
  labelAccent: { color: Colors.completed },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  cardAccent: { width: 3 },
  cardBody: { flex: 1, padding: Spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardInfo: { flex: 1 },
  blockTime: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 3,
    fontVariant: ['tabular-nums'],
  },
  blockDuration: { color: Colors.textDisabled },
  blockTitle: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  cardActions: { flexDirection: 'row', gap: Spacing.xs, marginLeft: Spacing.sm, alignItems: 'center' },
  reorderCol: { flexDirection: 'column', gap: 2 },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: { opacity: 0.35 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  addBlockBtnText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.primary,
  },
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  modalContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  modalFieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  togglesSection: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    marginVertical: Spacing.md,
    overflow: 'hidden',
  },
  modalActions: { gap: Spacing.sm, marginTop: Spacing.xl },
});
