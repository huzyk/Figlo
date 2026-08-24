export function gradeDifficulty(humanResult) {
  const score = humanResult?.score || 0;
  const steps = humanResult?.steps?.length || 0;
  const maxRule = humanResult?.steps?.reduce((last, item) => item.rule || last, null) || null;
  const label = score <= 14 ? 'easy' : score <= 26 ? 'medium' : 'hard';
  return { score, steps, maxRule, label };
}
