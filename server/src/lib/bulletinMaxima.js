function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

/** Bulletin marks: keep one decimal digit (9.78 → 9.7). */
export function round1(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.trunc(n * 10) / 10;
}

export function formatBulletinScore(value) {
  const n = round1(value);
  if (n == null) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function scaleScore(score, fromMax, toMax) {
  if (score == null || score === '') return null;
  const from = Number(fromMax) || 0;
  const to = Number(toMax) || 0;
  if (!(to > 0)) return null;
  if (!(from > 0) || from === to) return round1(score);
  return round1((Number(score) / from) * to);
}

/**
 * Bulletin maxima rule: period 1 + period 2 = exam, and total = both periods + exam.
 * Scores recorded against the combined tests maximum are scaled onto each period.
 */
export function periodExamColumns({
  period1Max = 0,
  period2Max = 0,
  testsMax = 0,
  examMax = 0,
  examScore = null,
  period1Score = null,
  period1ScoreMax = 0,
  period2Score = null,
  period2ScoreMax = 0,
  continuousScore = null,
  continuousScoreMax = 0,
} = {}) {
  let p1 = Number(period1Max) || 0;
  let p2 = Number(period2Max) || 0;
  if (!(p1 > 0) && !(p2 > 0)) {
    const combined = Number(testsMax) || Number(examMax) || 0;
    p1 = combined / 2;
    p2 = round2(combined - p1);
  }

  const periodSum = round2(p1 + p2);
  const exam = periodSum > 0 ? periodSum : (Number(examMax) || 0);
  const totalMax = round2(periodSum + exam);
  const verified = periodSum > 0
    && round2(Number(examMax) || 0) === exam
    && totalMax === round2(exam + exam);

  const p1Score = scaleScore(period1Score, period1ScoreMax || testsMax || periodSum, p1);
  const p2Score = scaleScore(period2Score, period2ScoreMax || testsMax || periodSum, p2);
  const continuousOnTests = scaleScore(
    continuousScore,
    continuousScoreMax || testsMax || periodSum,
    periodSum,
  );
  const examOnScale = examScore == null || examScore === '' ? null : round1(examScore);
  const hasScore = continuousOnTests != null || examOnScale != null;
  const totalScore = hasScore
    ? round1((continuousOnTests || 0) + (examOnScale || 0))
    : null;

  return {
    verified,
    cells: [
      { score: p1Score, max: p1 },
      { score: p2Score, max: p2 },
      { score: examOnScale, max: exam },
      { score: totalScore, max: totalMax },
    ],
  };
}

export function maximaIdentityHolds(cells) {
  if (!cells || cells.length < 4) return false;
  const [p1, p2, exam, total] = cells;
  const periodSum = round2((Number(p1?.max) || 0) + (Number(p2?.max) || 0));
  return periodSum === round2(Number(exam?.max) || 0)
    && round2(periodSum + periodSum) === round2(Number(total?.max) || 0);
}
