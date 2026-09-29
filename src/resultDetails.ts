import type { FaceBox } from './runtime';

export type DetailRow = {
  kind: 'section' | 'field';
  title: string;
  value: string;
};

/** Thresholds needed to format result rows (demo Settings stay in the app). */
export type ResultDisplaySettings = {
  liveness_threshold: number;
};

export function livenessPassed(
  settings: ResultDisplaySettings,
  score: number,
  label?: string
): boolean {
  const lower = (label ?? '').toLowerCase();
  if (lower.includes('spoof') || lower.includes('fake')) return false;
  return score >= settings.liveness_threshold;
}

export function qualityText(score: number): string {
  if (score < 0.5) return `Low · ${Math.round(score * 100)}%`;
  if (score < 0.75) return `Medium · ${Math.round(score * 100)}%`;
  return `High · ${Math.round(score * 100)}%`;
}

/** Map engine deepfake.value (bool / 0-1 / REAL|FAKE) to fake|real|"". */
export function deepfakeKind(raw?: string | null): string {
  let text = (raw ?? '').trim().toLowerCase();
  if (!text) return '';
  if (text.includes(' · ')) text = text.split(' · ')[0] ?? text;
  if (text.includes(' (')) text = text.split(' (')[0]?.trim() ?? text;
  if (['fake', 'true', '1', 'yes'].includes(text)) return 'fake';
  if (['real', 'false', '0', 'no'].includes(text)) return 'real';
  if (text.includes('fake')) return 'fake';
  if (text.includes('real')) return 'real';
  return '';
}

export function deepfakeText(raw?: string | null): string {
  const kind = deepfakeKind(raw);
  if (!kind) return '';
  const heading = kind === 'fake' ? 'FAKE' : 'REAL';
  const src = raw ?? '';
  const open = src.indexOf('(');
  const close = src.indexOf(')', open + 1);
  if (open < 0 || close < 0) return heading;
  const conf = src.slice(open + 1, close).trim();
  return conf && conf !== src ? `${heading} · ${conf}` : heading;
}

/** REAL only when both liveness and deepfake say real (Windows parity). */
export function authenticityPassed(
  settings: ResultDisplaySettings,
  score: number,
  liveLabel?: string | null,
  deepfakeRaw?: string | null
): boolean {
  if (!livenessPassed(settings, score, liveLabel ?? undefined)) return false;
  const kind = deepfakeKind(deepfakeRaw);
  return kind === '' || kind === 'real';
}

export function authenticityHeading(
  settings: ResultDisplaySettings,
  score: number,
  liveLabel?: string | null,
  deepfakeRaw?: string | null
): string {
  const liveOk = livenessPassed(settings, score, liveLabel ?? undefined);
  const kind = deepfakeKind(deepfakeRaw);
  const liveHeading = liveOk ? 'REAL' : 'FAKE';
  const dfHeading =
    kind === 'real' ? 'REAL' : kind === 'fake' ? 'FAKE' : '';
  if (!dfHeading) return liveHeading;
  return liveHeading === 'REAL' && dfHeading === 'REAL' ? 'REAL' : 'FAKE';
}

export function deepfakeRawFromBox(box: FaceBox): string {
  return engineAttr(attrMap(box), 'Deepfake', 'deepfake');
}

function genderText(gender: number | undefined, label?: string): string {
  if (label) return label;
  if (gender === 0) return 'Male';
  if (gender === 1) return 'Female';
  return 'Unknown';
}

export function livenessText(
  settings: ResultDisplaySettings,
  score: number,
  label?: string
): string {
  const lower = (label ?? '').toLowerCase();
  const live =
    lower.includes('spoof') || lower.includes('fake')
      ? 'Spoof'
      : lower.includes('real')
        ? 'Real'
        : livenessPassed(settings, score, label)
          ? 'Real'
          : 'Spoof';
  if (label?.includes(' · ')) return label;
  return `${live} · ${Math.round(score * 100)}%`;
}

function attrMap(box: FaceBox): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = box.attributes;
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (v != null && String(v).trim()) out[k] = String(v);
    }
  }
  return out;
}

function engineAttr(
  extra: Record<string, string>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const v = extra[key];
    if (v && v.trim()) return v;
  }
  return '';
}

function fmtDeg(n: number | undefined): string {
  const v = Number.isFinite(n) ? (n as number) : 0;
  return `${v.toFixed(1)}°`;
}

function fmtScore(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 0 && n <= 1) return `${Math.round(n * 100)}%`;
  return String(n);
}

/** Mirrors Android ResultDetails.rows — known fields + leftover engine attributes. */
export function resultDetailRows(
  box: FaceBox,
  settings: ResultDisplaySettings,
  opts?: {
    personName?: string;
    similarity?: number;
    includeMatch?: boolean;
  }
): DetailRow[] {
  const rows: DetailRow[] = [];
  const extra = attrMap(box);
  const used = new Set<string>();
  const push = (title: string, value: string) => {
    if (value.trim()) rows.push({ kind: 'field', title, value });
  };
  const section = (title: string) =>
    rows.push({ kind: 'section', title, value: title });

  const take = (title: string, keys: string[], fallback?: string | null) => {
    const value = engineAttr(extra, ...keys) || fallback || '';
    if (value.trim()) {
      push(title, value);
      keys.forEach((k) => used.add(k));
    }
  };

  if (opts?.includeMatch && opts.personName) {
    section('Match');
    push('Person', opts.personName);
    if (opts.similarity != null) {
      push('Similarity', fmtScore(opts.similarity));
    }
  }

  section('Authenticity');
  const deepfakeRaw = engineAttr(extra, 'Deepfake', 'deepfake');
  const liveFallback = livenessText(
    settings,
    box.liveness ?? 0,
    box.livenessLabel
  );
  const verdict = authenticityHeading(
    settings,
    box.liveness ?? 0,
    box.livenessLabel,
    deepfakeRaw
  );
  if (deepfakeRaw.trim()) {
    push('Verdict', verdict);
  }
  take('Liveness', ['Liveness2D'], liveFallback);
  const dfShown = deepfakeText(deepfakeRaw);
  if (dfShown) {
    push('Deepfake', dfShown);
  }
  used.add('Deepfake');
  used.add('deepfake');

  section('Person');
  take(
    'Age',
    ['Age', 'age'],
    box.age && box.age > 0 ? `${box.age} years` : null
  );
  take('Gender', ['Gender', 'gender'], genderText(box.gender, box.genderLabel));
  take('Emotion', ['Emotion', 'emotion'], box.emotionLabel);
  take('All emotions', ['Emotions']);

  section('Face');
  take('Mask', ['MedicalMask', 'Mask', 'mask'], box.maskLabel);
  take('Glasses', ['Glasses', 'glasses'], box.glassesLabel);
  take('Sunglasses', ['Sunglasses', 'sunglasses'], box.sunglassesLabel);
  take(
    'Occlusion',
    ['Occlusion', 'FaceOcclusion', 'occlusion'],
    box.occlusionLabel
  );
  const left =
    engineAttr(extra, 'EyesLeft', 'eyesLeft') || box.eyesLeftLabel || '';
  const right =
    engineAttr(extra, 'EyesRight', 'eyesRight') || box.eyesRightLabel || '';
  if (left || right) {
    push('Eyes', `Left: ${left || '—'}\nRight: ${right || '—'}`);
    used.add('EyesLeft');
    used.add('EyesRight');
    used.add('eyesLeft');
    used.add('eyesRight');
  } else if (
    (box.left_eye_closed != null && box.left_eye_closed > 0) ||
    (box.right_eye_closed != null && box.right_eye_closed > 0)
  ) {
    push(
      'Eye closeness',
      `Left: ${fmtScore(box.left_eye_closed)}\nRight: ${fmtScore(box.right_eye_closed)}`
    );
  }

  section('Quality');
  take(
    'Face quality',
    ['FaceQuality', 'ExpressionLevel', 'face_quality'],
    box.qualityLabel || qualityText(box.face_quality ?? 0)
  );
  for (const [label, key] of [
    ['Lighting', 'Lighting'],
    ['Sharpness', 'Sharpness'],
    ['Noise', 'Noise'],
    ['Flare', 'Flare'],
    ['Blur', 'BlurLevel'],
    ['Noise level', 'NoiseLevel'],
  ] as const) {
    take(label, [key]);
  }
  if ((box.face_luminance ?? 0) > 0) {
    push('Luminance', fmtScore(box.face_luminance));
  }

  section('Geometry');
  push(
    'Head pose',
    `Yaw ${fmtDeg(box.yaw)}   Roll ${fmtDeg(box.roll)}   Pitch ${fmtDeg(box.pitch)}`
  );
  push(
    'Face box (px)',
    `Left ${box.x1}, Top ${box.y1} → Right ${box.x2}, Bottom ${box.y2}`
  );

  const skipLeftover = new Set([
    ...used,
    'MouthOpened',
    'Deepfake',
    'deepfake',
    'Template',
    'mouth_opened',
    'Age',
    'age',
    'Gender',
    'gender',
    'Emotion',
    'emotion',
    'Liveness2D',
    'liveness',
    'Liveness',
    'FaceQuality',
    'face_quality',
  ]);
  const leftovers = Object.entries(extra).filter(
    ([key, value]) =>
      value.trim() &&
      !skipLeftover.has(key) &&
      !rows.some(
        (r) =>
          r.kind === 'field' && r.title.toLowerCase() === key.toLowerCase()
      )
  );
  if (leftovers.length) {
    section('More from engine');
    for (const [key, value] of leftovers) {
      push(key, value);
    }
  }

  if (box.landmarkCount && box.landmarks?.length) {
    section('Landmarks');
    push('Count', `${box.landmarkCount} points`);
    const n = Math.min(
      box.landmarkCount,
      Math.floor((box.landmarks?.length ?? 0) / 2)
    );
    if (n > 0) {
      const lines: string[] = [];
      for (let i = 0; i < n; i++) {
        lines.push(
          `${i + 1}: ${box.landmarks![i * 2]}, ${box.landmarks![i * 2 + 1]}`
        );
      }
      push('Positions', lines.join('\n'));
    }
  }

  return rows.filter((row, i) => {
    if (row.kind !== 'section') return row.value.trim().length > 0;
    const next = rows[i + 1];
    return next != null && next.kind === 'field' && next.value.trim().length > 0;
  });
}
