import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChoiceGroup } from '@/src/components/ChoiceGroup';
import { HomeworkMaterials } from '@/src/components/HomeworkMaterials';
import { Badge, Button, Card, ErrorText, Input, LoadingBlock, Muted, Screen, Subtitle } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { useTheme } from '@/src/context/ThemeContext';
import { labelOf } from '@/src/lib/format';
import { spacing } from '@/src/theme';

export default function HomeworkDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [homework, setHomework] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await api.getHomeworkDetail(String(id));
      setHomework(data);
      setRetrying(false);
      setAnswers({});
    } catch (err: any) {
      setError(err.message || 'Failed to load homework');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const submission = homework?.mySubmission;
  const submitted = Boolean(submission) && !retrying;
  const questions = homework?.questions || [];
  const hasMaterials =
    Boolean(homework?.description || homework?.instructions) ||
    (homework?.videos?.length || 0) > 0 ||
    (homework?.attachments?.length || 0) > 0;

  const resultMap = useMemo(() => {
    const map: Record<string, any> = {};
    (submission?.answers || []).forEach((a: any) => {
      map[a.questionId] = a;
    });
    return map;
  }, [submission]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.submitHomework(
        String(id),
        questions.map((q: any) => ({ questionId: q.id, answer: answers[q.id] })),
      );
      await load();
    } catch (err: any) {
      setError(err.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  if (!homework) {
    return (
      <Screen>
        <View style={styles.pad}>
          <ErrorText>{error || 'Homework not found'}</ErrorText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Card style={styles.card}>
          <Subtitle>{homework.title}</Subtitle>
          <Muted>{labelOf(homework.course?.name || homework.subject, 'Homework')}</Muted>
          {submitted && submission?.maxScore ? (
            <Badge
              label={`Score ${submission.score ?? 0}/${submission.maxScore} (${Math.round(((submission.score || 0) / submission.maxScore) * 100)}%)`}
              tone="success"
            />
          ) : null}
        </Card>

        <HomeworkMaterials homework={homework} />

        {hasMaterials && questions.length > 0 ? (
          <Text style={styles.divider}>{submitted ? 'Your results' : 'Now answer the questions'}</Text>
        ) : null}

        {questions.map((q: any, index: number) => {
          const result = resultMap[q.id];
          return (
            <Card key={q.id} style={styles.card}>
              <Text style={styles.qLabel}>
                Question {index + 1}
                {q.type === 'TRUE_FALSE' ? ' · True/False' : q.type === 'MULTIPLE_CHOICE' ? ' · Multiple choice' : ''}
              </Text>
              <Text style={styles.qText}>{q.prompt || q.text || q.question}</Text>

              {submitted ? (
                <View style={styles.resultBox}>
                  <Muted>
                    Your answer:{' '}
                    {q.type === 'MULTIPLE_CHOICE'
                      ? (Array.isArray(q.options) ? q.options[Number(result?.answer)] : result?.answer)
                      : result?.answer ?? '—'}
                  </Muted>
                  {result?.isCorrect != null ? (
                    <Badge label={result.isCorrect ? 'Correct' : 'Incorrect'} tone={result.isCorrect ? 'success' : 'danger'} />
                  ) : null}
                </View>
              ) : q.type === 'TRUE_FALSE' ? (
                <ChoiceGroup
                  value={answers[q.id]}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                  options={[
                    { value: 'true', label: 'True' },
                    { value: 'false', label: 'False' },
                  ]}
                />
              ) : q.type === 'MULTIPLE_CHOICE' ? (
                <ChoiceGroup
                  value={answers[q.id]}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                  options={(Array.isArray(q.options) ? q.options : []).map((opt: string, i: number) => ({
                    value: String(i),
                    label: opt || `Option ${i + 1}`,
                  }))}
                />
              ) : (
                <Input
                  value={answers[q.id] || ''}
                  onChangeText={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                  placeholder="Type your answer"
                />
              )}
            </Card>
          );
        })}

        <ErrorText>{error}</ErrorText>

        {questions.length > 0 && !submitted ? (
          <Button title="Send my answers" icon="rocket" onPress={handleSubmit} loading={submitting} />
        ) : null}

        {submitted ? (
          <Button title="Try again" icon="refresh" variant="secondary" onPress={() => setRetrying(true)} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
  pad: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    gap: spacing.sm,
  },
  divider: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginTop: spacing.xs,
  },
  qLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
    textTransform: 'uppercase',
  },
  qText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
  },
  resultBox: {
    gap: 8,
  },
});
}

