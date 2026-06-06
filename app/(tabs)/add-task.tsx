import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontSize, Spacing, Radius } from '../../constants/theme';
import { OneTimeTask, TimingType } from '../../types/task';
import { Priority } from '../../types/routine';
import FormField from '../../components/FormField';
import ModeSelector from '../../components/ModeSelector';
import AppButton from '../../components/AppButton';
import { useRequiredUser } from '../../contexts/UserContext';
import { api } from '../../utils/api';
import { scheduleBlockNotifications } from '../../utils/notifications';

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const TIMING_OPTIONS = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'fixed', label: 'Fixed Time' },
];

// ── Conflict types from backend ────────────────────────────────────────────────
interface ConflictSuggestion {
  option: string;
  protected?: string;
  to_move?: string;
  blocks?: string[];
  message?: string;
  alternatives?: string[];
}

interface ConflictInfo {
  type: 'fixed_task_conflicts_routine' | 'flexible_task_no_slot';
  task: string;
  conflicting_block?: string;
  duration_needed_minutes?: number;
  suggestion: ConflictSuggestion;
}

function conflictLabel(c: ConflictInfo): string {
  if (c.type === 'fixed_task_conflicts_routine') {
    return `"${c.task}" overlaps with "${c.conflicting_block}"`;
  }
  return `No free slot for "${c.task}" (${c.duration_needed_minutes} min needed)`;
}

function conflictMessage(c: ConflictInfo): string {
  if (c.suggestion.message) return c.suggestion.message;
  if (c.type === 'fixed_task_conflicts_routine') {
    const s = c.suggestion;
    if (s.option === 'move_flexible_block' && s.to_move) {
      return `"${s.protected}" is protected. Consider moving "${s.to_move}" to a free slot.`;
    }
    if (s.option === 'user_decision_required') {
      return 'Both blocks have equal priority — decide manually which to keep or move.';
    }
  }
  return 'Consider moving the task to another day or compressing a lower-priority block.';
}

function resolveDate(input: string): string {
  const today = new Date();
  if (input.toLowerCase() === 'today') {
    return today.toISOString().split('T')[0];
  }
  if (input.toLowerCase() === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  return input;
}

export default function AddTaskScreen() {
  const { userId } = useRequiredUser();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('Today');
  const [duration, setDuration] = useState('60');
  const [deadline, setDeadline] = useState('');
  const [timingType, setTimingType] = useState<TimingType>('flexible');
  const [fixedStart, setFixedStart] = useState('');
  const [priority, setPriority] = useState<Priority>('high');
  const [canSplit, setCanSplit] = useState(false);
  const [notes, setNotes] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [tasks, setTasks] = useState<OneTimeTask[]>([]);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const resolvedDate = resolveDate(date);
      const raw = await api.tasks.create(userId, {
        title: title.trim(),
        date: resolvedDate,
        duration_minutes: parseInt(duration, 10) || 60,
        timing_type: timingType,
        priority,
        notes: notes.trim() || null,
      });

      const task: OneTimeTask = {
        id: String(raw.id),
        title: raw.title,
        date: raw.date,
        durationMinutes: raw.duration_minutes,
        deadlineTime: deadline || undefined,
        timingType: raw.timing_type as TimingType,
        fixedStartTime: timingType === 'fixed' ? fixedStart : undefined,
        priority: raw.priority as Priority,
        canSplit,
        notes: raw.notes ?? '',
      };
      setTasks((prev) => [...prev, task]);

      // Regenerate today's schedule — capture real conflicts and reschedule notifications
      try {
        const today = new Date().toISOString().split('T')[0];
        const scheduleResult = await api.schedule.generate(userId, today, true);
        setConflicts((scheduleResult.conflicts ?? []) as ConflictInfo[]);
        // Re-schedule notifications to include the new task
        scheduleBlockNotifications(scheduleResult.blocks).catch(() => {});
      } catch {
        setConflicts([]); // Non-fatal — task was saved
      }

      setSubmitted(true);
    } catch {
      setSaveError('Could not save task. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setDate('Today');
    setDuration('60');
    setDeadline('');
    setTimingType('flexible');
    setFixedStart('');
    setPriority('high');
    setCanSplit(false);
    setNotes('');
    setSubmitted(false);
    setConflicts([]);
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Task Added</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Added task confirmation */}
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.completed} />
            <View style={styles.successText}>
              <Text style={styles.successTitle}>{title} added</Text>
              <Text style={styles.successSub}>{duration} min · {date} · {priority} priority</Text>
            </View>
          </View>

          {/* Conflict section — real data from backend */}
          {conflicts.length === 0 ? (
            <View style={styles.noConflictCard}>
              <Ionicons name="checkmark-circle-outline" size={18} color={Colors.completed} />
              <Text style={styles.noConflictText}>
                No scheduling conflicts — task placed successfully.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>SCHEDULING CONFLICTS</Text>
              {conflicts.map((c, i) => (
                <View key={i} style={styles.conflictCard}>
                  <View style={styles.conflictHeader}>
                    <Ionicons name="warning" size={18} color={Colors.delayed} />
                    <Text style={styles.conflictTitle}>{conflictLabel(c)}</Text>
                  </View>
                  <Text style={styles.conflictDesc}>{conflictMessage(c)}</Text>
                  {c.suggestion.alternatives && c.suggestion.alternatives.length > 0 && (
                    <View style={styles.alternativesRow}>
                      {c.suggestion.alternatives.map((alt) => (
                        <View key={alt} style={styles.altChip}>
                          <Text style={styles.altChipText}>
                            {alt.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              <View style={styles.conflictNote}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.conflictNoteText}>
                  Review your Today schedule to resolve these conflicts.
                </Text>
              </View>
            </>
          )}

          <View style={styles.ctaRow}>
            <AppButton label="Add Another Task" onPress={handleReset} />
          </View>

          {/* Added tasks list */}
          {tasks.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ADDED TODAY</Text>
              {tasks.map((t) => (
                <View key={t.id} style={styles.taskChip}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                  <Text style={styles.taskChipText}>
                    {t.title} · {t.durationMinutes}m · {t.priority}
                  </Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Add One-Time Task</Text>
          <Text style={styles.headerSub}>Insert a task into today's schedule</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <FormField
          label="Task Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Complete Assignment"
        />
        <FormField
          label="Date"
          value={date}
          onChangeText={setDate}
          placeholder="Today"
          hint="e.g. Today, Tomorrow, or YYYY-MM-DD"
        />
        <FormField
          label="Duration (minutes)"
          value={duration}
          onChangeText={setDuration}
          placeholder="60"
          keyboardType="numeric"
        />
        <FormField
          label="Deadline Time (optional)"
          value={deadline}
          onChangeText={setDeadline}
          placeholder="HH:MM (leave blank if none)"
          hint="24-hour format"
        />

        <Text style={styles.fieldLabel}>Timing Type</Text>
        <ModeSelector
          options={TIMING_OPTIONS}
          value={timingType}
          onChange={(v) => setTimingType(v as TimingType)}
        />

        {timingType === 'fixed' && (
          <FormField
            label="Fixed Start Time"
            value={fixedStart}
            onChangeText={setFixedStart}
            placeholder="HH:MM"
            containerStyle={{ marginTop: Spacing.md }}
          />
        )}

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Priority</Text>
        <ModeSelector
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={(v) => setPriority(v as Priority)}
        />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Can split into smaller blocks</Text>
          <Switch
            value={canSplit}
            onValueChange={setCanSplit}
            trackColor={{ false: Colors.border, true: Colors.primaryDim }}
            thumbColor={canSplit ? Colors.primary : Colors.textMuted}
          />
        </View>

        <FormField
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any extra context…"
          multiline
          numberOfLines={3}
          containerStyle={{ marginTop: Spacing.xs }}
        />

        {saveError && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color={Colors.delayed} />
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}
        <View style={styles.cta}>
          {saving ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <AppButton
              label="Add Task"
              onPress={handleAdd}
              disabled={!title.trim()}
              size="large"
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    marginTop: Spacing.md,
  },
  toggleLabel: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: '500' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Colors.delayedBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.delayedBorder,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  errorText: { fontSize: FontSize.sm, color: Colors.delayed, flex: 1 },
  cta: { marginTop: Spacing.xl, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.completedBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.completedBorder,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  successText: { flex: 1 },
  successTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  successSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  conflictCard: {
    backgroundColor: Colors.delayedBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.delayedBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  conflictTitle: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.delayed,
    flex: 1,
  },
  conflictDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  noConflictCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.completedBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.completedBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  noConflictText: {
    fontSize: FontSize.sm,
    color: Colors.completed,
    fontWeight: '600',
    flex: 1,
  },
  alternativesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  altChip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  altChipText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  conflictNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  conflictNoteText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    flex: 1,
  },
  ctaRow: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  taskChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.xs,
  },
  taskChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
