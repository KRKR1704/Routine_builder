import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { FontSize, Spacing, Radius } from '../constants/theme';
import { ScheduleBlock } from '../types/schedule';
import { getDurationMinutes, formatDuration } from '../utils/time';

// ── Mock debt categories (visual only — not connected to recovery screen state) ──
const MOCK_DEBT_CATEGORIES = [
  { id: 'debt_study', label: 'Study', remaining: 45 },
  { id: 'debt_gym', label: 'Gym', remaining: 60 },
  { id: 'debt_project', label: 'Project Work', remaining: 30 },
];

const TIME_SAVED_OPTIONS = [5, 10, 15, 20, 30, 45];

type ActionChoice = 'debt' | 'free' | 'move';

interface EarlyCompletionModalProps {
  visible: boolean;
  block: ScheduleBlock | null;
  totalDebtMinutes: number;
  onClose: () => void;
  /** savedMinutes = time saved; debtApplied = how much to subtract from debt counter */
  onConfirm: (savedMinutes: number, debtApplied: number) => void;
}

export default function EarlyCompletionModal({
  visible,
  block,
  totalDebtMinutes,
  onClose,
  onConfirm,
}: EarlyCompletionModalProps) {
  const [savedMinutes, setSavedMinutes] = useState<number | null>(null);
  const [choice, setChoice] = useState<ActionChoice | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!block) return null;

  const plannedMins = getDurationMinutes(block.plannedStart, block.plannedEnd);
  const hasDebt = totalDebtMinutes > 0;
  const canConfirm = savedMinutes !== null && choice !== null;

  const getDebtApplied = (): number => {
    if (choice !== 'debt' || !savedMinutes) return 0;
    return Math.min(savedMinutes, totalDebtMinutes);
  };

  const selectedDebt = MOCK_DEBT_CATEGORIES.find((d) => d.id === selectedDebtId);

  const handleConfirm = () => {
    if (!canConfirm) return;
    setConfirmed(true);
  };

  const handleDone = () => {
    onConfirm(savedMinutes ?? 0, getDebtApplied());
    reset();
  };

  const handleClose = () => {
    onClose();
    reset();
  };

  const reset = () => {
    setSavedMinutes(null);
    setChoice(null);
    setSelectedDebtId(null);
    setConfirmed(false);
  };

  const resultMessage = (): string => {
    if (!savedMinutes) return '';
    if (choice === 'debt') {
      const applied = getDebtApplied();
      const cat = selectedDebt?.label ?? 'Routine';
      const before = selectedDebt?.remaining ?? totalDebtMinutes;
      return `${applied}m assigned to ${cat} recovery. ${cat} debt reduced from ${before}m to ${Math.max(0, before - applied)}m.`;
    }
    if (choice === 'free') return `${savedMinutes}m of free time earned. No schedule changes.`;
    return `Next block shifted ${savedMinutes} min earlier. Great pace!`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.earlyDot} />
            <Text style={styles.headerTitle}>Completed Early</Text>
          </View>
          <TouchableOpacity onPress={handleClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Block info */}
          <View style={styles.blockCard}>
            <Text style={styles.blockTitle} numberOfLines={1}>{block.title}</Text>
            <View style={styles.blockMeta}>
              <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.blockMetaText}>
                Planned: {formatDuration(plannedMins)}
                {savedMinutes !== null && (
                  <Text style={styles.actualText}>
                    {' '}→ Actual: {formatDuration(Math.max(1, plannedMins - savedMinutes))}
                  </Text>
                )}
              </Text>
            </View>
          </View>

          {!confirmed ? (
            <>
              {/* Step 1: Time saved */}
              <Text style={styles.sectionLabel}>HOW MUCH TIME DID YOU SAVE?</Text>
              <View style={styles.chipsRow}>
                {TIME_SAVED_OPTIONS.filter((m) => m < plannedMins).map((m) => {
                  const active = savedMinutes === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.timeChip, active && styles.timeChipActive]}
                      onPress={() => setSavedMinutes(m)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.timeChipLabel, active && styles.timeChipLabelActive]}>
                        {m}m early
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Step 2: What to do with saved time */}
              {savedMinutes !== null && (
                <>
                  {/* Saved time summary strip */}
                  <View style={styles.savedSummary}>
                    <View style={styles.savedItem}>
                      <Text style={styles.savedItemLabel}>Planned</Text>
                      <Text style={styles.savedItemValue}>{formatDuration(plannedMins)}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={14} color={Colors.textDisabled} />
                    <View style={styles.savedItem}>
                      <Text style={styles.savedItemLabel}>Actual</Text>
                      <Text style={styles.savedItemValue}>
                        {formatDuration(Math.max(1, plannedMins - savedMinutes))}
                      </Text>
                    </View>
                    <View style={styles.savedHighlight}>
                      <Text style={styles.savedHighlightLabel}>Saved</Text>
                      <Text style={styles.savedHighlightValue}>{savedMinutes}m</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionLabel}>
                    WHAT TO DO WITH {savedMinutes} MIN?
                  </Text>

                  {/* Option: Apply to debt */}
                  {hasDebt && (
                    <TouchableOpacity
                      style={[styles.optionCard, choice === 'debt' && styles.optionCardActive]}
                      onPress={() => setChoice('debt')}
                      activeOpacity={0.75}
                    >
                      <View style={styles.optionRow}>
                        <View style={[styles.optionRadio, choice === 'debt' && styles.optionRadioActive]}>
                          {choice === 'debt' && <View style={styles.optionRadioDot} />}
                        </View>
                        <View style={styles.optionContent}>
                          <Text style={[styles.optionLabel, choice === 'debt' && styles.optionLabelActive]}>
                            Use saved time for routine debt
                          </Text>
                          <Text style={styles.optionDesc}>
                            Reduce your {formatDuration(totalDebtMinutes)} routine debt right now
                          </Text>
                        </View>
                        <View style={styles.debtTag}>
                          <Text style={styles.debtTagText}>−{savedMinutes}m</Text>
                        </View>
                      </View>

                      {choice === 'debt' && (
                        <View style={styles.debtList}>
                          <Text style={styles.debtListLabel}>Apply to which category?</Text>
                          {MOCK_DEBT_CATEGORIES.map((d) => {
                            const sel = selectedDebtId === d.id;
                            return (
                              <TouchableOpacity
                                key={d.id}
                                style={[styles.debtItem, sel && styles.debtItemActive]}
                                onPress={() => setSelectedDebtId(sel ? null : d.id)}
                                activeOpacity={0.75}
                              >
                                <View style={[styles.debtDot, sel && styles.debtDotActive]} />
                                <Text style={[styles.debtItemLabel, sel && styles.debtItemLabelActive]}>
                                  {d.label}
                                </Text>
                                <Text style={styles.debtItemRemaining}>{d.remaining}m left</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Option: Keep as free time */}
                  <TouchableOpacity
                    style={[styles.optionCard, choice === 'free' && styles.optionCardActive]}
                    onPress={() => setChoice('free')}
                    activeOpacity={0.75}
                  >
                    <View style={styles.optionRow}>
                      <View style={[styles.optionRadio, choice === 'free' && styles.optionRadioActive]}>
                        {choice === 'free' && <View style={styles.optionRadioDot} />}
                      </View>
                      <View style={styles.optionContent}>
                        <Text style={[styles.optionLabel, choice === 'free' && styles.optionLabelActive]}>
                          Keep as free time
                        </Text>
                        <Text style={styles.optionDesc}>No changes. Enjoy the extra {savedMinutes} min.</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Option: Shift next earlier */}
                  <TouchableOpacity
                    style={[styles.optionCard, choice === 'move' && styles.optionCardActive]}
                    onPress={() => setChoice('move')}
                    activeOpacity={0.75}
                  >
                    <View style={styles.optionRow}>
                      <View style={[styles.optionRadio, choice === 'move' && styles.optionRadioActive]}>
                        {choice === 'move' && <View style={styles.optionRadioDot} />}
                      </View>
                      <View style={styles.optionContent}>
                        <Text style={[styles.optionLabel, choice === 'move' && styles.optionLabelActive]}>
                          Shift next block earlier
                        </Text>
                        <Text style={styles.optionDesc}>
                          Start your next task {savedMinutes} min ahead of schedule.
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Confirm button */}
                  {canConfirm && (
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      onPress={handleConfirm}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#071a0e" />
                      <Text style={styles.confirmBtnLabel}>Confirm</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </>
          ) : (
            /* Result view */
            <View style={styles.resultCard}>
              <Ionicons name="checkmark-circle" size={32} color={Colors.completed} />
              <Text style={styles.resultTitle}>
                {choice === 'debt' ? 'Debt Reduced' : choice === 'free' ? 'Free Time Logged' : 'Schedule Shifted'}
              </Text>
              <Text style={styles.resultMessage}>{resultMessage()}</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.8}>
                <Text style={styles.doneBtnLabel}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  earlyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.completed,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  blockCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  blockTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 5,
    letterSpacing: -0.3,
  },
  blockMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  blockMetaText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  actualText: { color: Colors.completed },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  timeChipActive: {
    backgroundColor: Colors.completedBg,
    borderColor: Colors.completedBorder,
  },
  timeChipLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  timeChipLabelActive: { color: Colors.completed },
  savedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  savedItem: { alignItems: 'center', flex: 1 },
  savedItemLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 3,
  },
  savedItemValue: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  savedHighlight: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: Colors.completedBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.completedBorder,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  savedHighlightLabel: {
    fontSize: FontSize.xs,
    color: Colors.completed,
    fontWeight: '600',
    marginBottom: 2,
  },
  savedHighlightValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.completed,
    fontVariant: ['tabular-nums'],
  },
  optionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  optionCardActive: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primaryDim,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  optionRadioActive: { borderColor: Colors.primary },
  optionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  optionContent: { flex: 1 },
  optionLabel: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 3,
    lineHeight: 20,
  },
  optionLabelActive: { color: Colors.primary },
  optionDesc: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 18 },
  debtTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.completedBg,
    borderWidth: 1,
    borderColor: Colors.completedBorder,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  debtTagText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.completed,
  },
  debtList: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.xs,
  },
  debtListLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  debtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  debtItemActive: {
    backgroundColor: Colors.completedBg,
    borderColor: Colors.completedBorder,
  },
  debtDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  debtDotActive: {
    backgroundColor: Colors.completed,
    borderColor: Colors.completed,
  },
  debtItemLabel: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  debtItemLabelActive: { color: Colors.completed },
  debtItemRemaining: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.completed,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  confirmBtnLabel: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: '#071a0e',
  },
  resultCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  resultTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.completed,
    letterSpacing: -0.3,
  },
  resultMessage: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  doneBtn: {
    backgroundColor: Colors.completed,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 13,
    marginTop: Spacing.sm,
  },
  doneBtnLabel: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: '#071a0e',
  },
});
