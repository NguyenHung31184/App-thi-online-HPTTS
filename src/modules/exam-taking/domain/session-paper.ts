export function hashStringToSeed(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function hasStudentAnswer(questionType: string, value: string | undefined): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    if (questionType === 'true_false_multi') {
      const answers: unknown = JSON.parse(value);
      return Array.isArray(answers) && answers.some((answer) => answer === 'T' || answer === 'F');
    }
    if (questionType === 'matching') {
      const answers: unknown = JSON.parse(value);
      return typeof answers === 'object' && answers !== null && Object.keys(answers).length > 0;
    }
    return true;
  } catch {
    return false;
  }
}

