function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function gradeAnswer(question, rawAnswer) {
  const answer = String(rawAnswer ?? '').trim();
  const correct = String(question.correctAnswer ?? '').trim();
  const points = question.points || 1;

  if (!answer) {
    return { isCorrect: false, pointsEarned: 0 };
  }

  if (question.type === 'TRUE_FALSE') {
    const isCorrect = normalizeText(answer) === normalizeText(correct);
    return { isCorrect, pointsEarned: isCorrect ? points : 0 };
  }

  if (question.type === 'MULTIPLE_CHOICE') {
    const isCorrect = answer === correct;
    return { isCorrect, pointsEarned: isCorrect ? points : 0 };
  }

  if (question.type === 'SHORT_ANSWER') {
    const accepted = correct.split('|').map((s) => normalizeText(s)).filter(Boolean);
    const isCorrect = accepted.includes(normalizeText(answer));
    return { isCorrect, pointsEarned: isCorrect ? points : 0 };
  }

  return { isCorrect: false, pointsEarned: 0 };
}

export function gradeSubmission(questions, answersByQuestionId) {
  let score = 0;
  let maxScore = 0;
  const graded = [];

  for (const question of questions) {
    maxScore += question.points || 1;
    const result = gradeAnswer(question, answersByQuestionId[question.id]);
    score += result.pointsEarned;
    graded.push({
      questionId: question.id,
      answer: String(answersByQuestionId[question.id] ?? ''),
      ...result,
    });
  }

  return { score, maxScore, graded };
}
