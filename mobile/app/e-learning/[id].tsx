import { useCallback, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChoiceGroup } from '@/src/components/ChoiceGroup';
import { Badge, Button, Card, ErrorText, Input, LoadingBlock, Muted, Screen, Subtitle } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { useTheme } from '@/src/context/ThemeContext';
import { labelOf } from '@/src/lib/format';
import { colors, spacing } from '@/src/theme';

export default function ELearningCourseScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [course, setCourse] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await api.getELearningCourse(String(id));
      setCourse(data);
      setRetrying(false);
      setAnswers({});
    } catch (err: any) {
      setError(err.message || 'Failed to load course');
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

  const submission = course?.mySubmission;
  const submitted = Boolean(submission) && !retrying;
  const exercises = course?.exercises || [];
  const lessons = course?.lessons || [];

  const resultMap = useMemo(() => {
    const map: Record<string, any> = {};
    const raw = submission?.answers;
    if (Array.isArray(raw)) {
      raw.forEach((a: any) => {
        map[a.exerciseId || a.questionId] = a;
      });
    }
    return map;
  }, [submission]);

  const openVideo = async (lesson: any) => {
    const url =
      lesson.videoUrl ||
      (lesson.youtubeId ? `https://www.youtube.com/watch?v=${lesson.youtubeId}` : null);
    if (!url) return;
    await Linking.openURL(url);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.submitELearningExercises(
        String(id),
        exercises.map((ex: any) => ({ exerciseId: ex.id, answer: answers[ex.id] })),
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

  if (!course) {
    return (
      <Screen>
        <View style={styles.pad}>
          <ErrorText>{error || 'Course not found'}</ErrorText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.pad}>
        <Card style={styles.card}>
          <Subtitle>{course.title}</Subtitle>
          <Muted>{labelOf(course.subject || course.class?.name, 'Course')}</Muted>
          {course.description ? <Text style={styles.body}>{course.description}</Text> : null}
          {submitted && submission?.maxScore ? (
            <Badge
              label={`Score ${submission.score ?? 0}/${submission.maxScore}`}
              tone="success"
            />
          ) : null}
        </Card>

        {lessons.map((lesson: any) => (
          <Card key={lesson.id} style={styles.card}>
            <Text style={styles.lessonTitle}>{lesson.title}</Text>
            {lesson.description ? <Muted>{lesson.description}</Muted> : null}
            {(lesson.youtubeId || lesson.videoUrl) ? (
              <Button title="Watch lesson" variant="secondary" onPress={() => openVideo(lesson)} />
            ) : null}
          </Card>
        ))}

        {exercises.length === 0 ? (
          <Card>
            <Muted>This course has no exercises yet.</Muted>
          </Card>
        ) : (
          exercises.map((ex: any, index: number) => {
            const result = resultMap[ex.id];
            return (
              <Card key={ex.id} style={styles.card}>
                <Text style={styles.qLabel}>Exercise {index + 1}</Text>
                <Text style={styles.qText}>{ex.prompt || ex.text || ex.question}</Text>
                {submitted ? (
                  <View style={styles.resultBox}>
                    <Muted>Your answer: {String(result?.answer ?? '—')}</Muted>
                    {result?.isCorrect != null ? (
                      <Badge
                        label={result.isCorrect ? 'Correct' : 'Incorrect'}
                        tone={result.isCorrect ? 'success' : 'danger'}
                      />
                    ) : null}
                  </View>
                ) : ex.type === 'TRUE_FALSE' ? (
                  <ChoiceGroup
                    value={answers[ex.id]}
                    onChange={(v) => setAnswers((prev) => ({ ...prev, [ex.id]: v }))}
                    options={[
                      { value: 'true', label: 'True' },
                      { value: 'false', label: 'False' },
                    ]}
                  />
                ) : ex.type === 'MULTIPLE_CHOICE' ? (
                  <ChoiceGroup
                    value={answers[ex.id]}
                    onChange={(v) => setAnswers((prev) => ({ ...prev, [ex.id]: v }))}
                    options={(Array.isArray(ex.options) ? ex.options : []).map((opt: string, i: number) => ({
                      value: String(i),
                      label: opt || `Option ${i + 1}`,
                    }))}
                  />
                ) : (
                  <Input
                    value={answers[ex.id] || ''}
                    onChangeText={(v) => setAnswers((prev) => ({ ...prev, [ex.id]: v }))}
                    placeholder="Type your answer"
                  />
                )}
              </Card>
            );
          })
        )}

        <ErrorText>{error}</ErrorText>
        {exercises.length > 0 && !submitted ? (
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
  body: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  qLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.violet,
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

