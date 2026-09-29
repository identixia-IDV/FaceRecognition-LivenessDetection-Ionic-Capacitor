/**
 * Mirrors Android ModeResultActivity.buildFriendlyView (+ helpers).
 * Media binding (thumbs / landmarks / =≠) stays in the screen.
 */
import { authenticityHeading, deepfakeText } from 'face-recognition-capacitor';

export type FriendlyField = {
  kind: 'section' | 'field';
  title: string;
  value: string;
};

export type FriendlyView = {
  ok: boolean;
  status: string;
  summary: string;
  scoreLabel: string | null;
  fields: FriendlyField[];
};

/** Android ResultDetails.livenessText — not exported from the package. */
function livenessText(
  score: number,
  threshold: number,
  label?: string | null
): string {
  const lower = (label ?? '').toLowerCase();
  const live =
    lower.includes('spoof') || lower.includes('fake')
      ? 'Spoof'
      : lower.includes('real')
        ? 'Real'
        : score >= threshold
          ? 'Real'
          : 'Spoof';
  if ((label ?? '').includes(' · ')) return label!;
  return `${live} · ${Math.round(score * 100)}%`;
}

export function formatScore(score: number): string {
  const pct = Math.max(0, Math.min(100, Math.round(score * 100)));
  return `${pct}% (${score.toFixed(3)})`;
}

export function prettyJson(raw: string): string {
  if (!raw || !raw.trim()) return '{}';
  try {
    const trimmed = raw.trimStart();
    const parsed = trimmed.startsWith('[')
      ? JSON.parse(raw)
      : JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

function fmt(v: number): string {
  return Number.isFinite(v) ? v.toFixed(1) : '0.0';
}

function humanize(key: string): string {
  const spaced = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function parseRoot(json: string): Record<string, unknown> | null {
  if (!json || !json.trim()) return null;
  try {
    const trimmed = json.trimStart();
    if (trimmed.startsWith('[')) {
      return { faces: JSON.parse(json) };
    }
    const obj = JSON.parse(json);
    return obj && typeof obj === 'object' && !Array.isArray(obj)
      ? (obj as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asArr(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}

function facesOf(root: Record<string, unknown>): Record<string, unknown>[] | null {
  const direct = asArr(root.faces);
  if (direct) {
    return direct.map(asObj).filter(Boolean) as Record<string, unknown>[];
  }
  const result = asObj(root.result);
  const resultFaces = result ? asArr(result.faces) : null;
  if (resultFaces) {
    return resultFaces.map(asObj).filter(Boolean) as Record<string, unknown>[];
  }
  const data = asArr(root.data);
  if (data) {
    return data.map(asObj).filter(Boolean) as Record<string, unknown>[];
  }
  const detects = asArr(root.detects);
  if (detects && detects.length) {
    const merged: Record<string, unknown>[] = [];
    for (const d of detects) {
      const faces = asObj(d) ? asArr(asObj(d)!.faces) : null;
      if (!faces) continue;
      for (const f of faces) {
        const o = asObj(f);
        if (o) merged.push(o);
      }
    }
    if (merged.length) return merged;
  }
  return null;
}

function extractScore(root: Record<string, unknown>): number | null {
  const fromObj = (obj: Record<string, unknown> | null): number | null => {
    if (!obj) return null;
    if (typeof obj.score === 'number') return obj.score;
    if (typeof obj.similarity === 'number') return obj.similarity;
    return null;
  };
  const top = fromObj(root);
  if (top != null) return top;
  for (const key of ['pairs', 'match']) {
    const arr = asArr(root[key]);
    if (!arr || !arr.length) continue;
    const s = fromObj(asObj(arr[0]));
    if (s != null) return s;
  }
  const faces = facesOf(root);
  if (faces?.length) {
    const s = fromObj(faces[0]!);
    if (s != null) return s;
  }
  return null;
}

function traitValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (value >= 0 && value <= 1) return formatScore(value);
    return fmt(value);
  }
  if (typeof value === 'string') return value;
  const o = asObj(value);
  if (!o) return String(value);
  const rawVal = o.value;
  let base = '';
  if (typeof rawVal === 'string' || typeof rawVal === 'number' || typeof rawVal === 'boolean') {
    base = String(rawVal);
  } else if (typeof o.label === 'string' || typeof o.label === 'number') {
    base = String(o.label);
  } else if (typeof o.confidence === 'number') {
    return formatScore(o.confidence);
  } else {
    try {
      return JSON.stringify(o);
    } catch {
      return '';
    }
  }
  return base;
}

function deepfakeRawFromTrait(df: Record<string, unknown> | null): string {
  if (!df) return '';
  let base = '';
  if (typeof df.value === 'boolean') base = String(df.value);
  else if (df.value != null) base = String(df.value);
  if (typeof df.confidence === 'number' && base) {
    return `${base} (${df.confidence})`;
  }
  return base;
}

function deepfakeTraitText(value: unknown): string {
  if (value == null) return '';
  const o = asObj(value);
  if (o) {
    const joined = deepfakeRawFromTrait(o);
    const shown = deepfakeText(joined);
    return shown || traitValue(value);
  }
  return deepfakeText(String(value));
}

function parseBox(region: Record<string, unknown>): number[] | null {
  if (
    region.width != null ||
    region.height != null ||
    region.x != null ||
    region.y != null
  ) {
    const x = Math.round(Number(region.x ?? 0));
    const y = Math.round(Number(region.y ?? 0));
    const w = Math.round(Number(region.width ?? 0));
    const h = Math.round(Number(region.height ?? 0));
    if (w > 0 && h > 0) return [x, y, w, h];
  }
  const l =
    region.left != null
      ? Number(region.left)
      : region.x1 != null
        ? Number(region.x1)
        : null;
  const t =
    region.top != null
      ? Number(region.top)
      : region.y1 != null
        ? Number(region.y1)
        : null;
  const r =
    region.right != null
      ? Number(region.right)
      : region.x2 != null
        ? Number(region.x2)
        : null;
  const b =
    region.bottom != null
      ? Number(region.bottom)
      : region.y2 != null
        ? Number(region.y2)
        : null;
  if (l == null || t == null || r == null || b == null) return null;
  const w = Math.round(r) - Math.round(l);
  const h = Math.round(b) - Math.round(t);
  if (w <= 0 || h <= 0) return null;
  return [Math.round(l), Math.round(t), w, h];
}

function pushSection(fields: FriendlyField[], title: string) {
  fields.push({ kind: 'section', title, value: title });
}

function pushField(fields: FriendlyField[], title: string, value: string) {
  if (value.trim()) fields.push({ kind: 'field', title, value });
}

function appendAuthenticityTraits(
  fields: FriendlyField[],
  traits: Record<string, unknown>,
  livenessThreshold: number
) {
  const live =
    asObj(traits.liveness2d) ||
    asObj(traits.Liveness2D) ||
    asObj(traits.liveness);
  const df = asObj(traits.deepfake) || asObj(traits.Deepfake);
  const liveLabel =
    live && live.value != null ? String(live.value) : '';
  const liveScore =
    live && typeof live.confidence === 'number' ? live.confidence : 0;
  const dfRaw = deepfakeRawFromTrait(df);
  const verdict = authenticityHeading(
    { liveness_threshold: livenessThreshold },
    liveScore,
    liveLabel,
    dfRaw
  );
  pushSection(fields, 'Authenticity');
  pushField(fields, 'Verdict', verdict);
  if (live) {
    pushField(
      fields,
      'Liveness',
      livenessText(liveScore, livenessThreshold, liveLabel)
    );
  }
  const dfText = deepfakeText(dfRaw);
  if (dfText) pushField(fields, 'Deepfake', dfText);
}

function appendFaceFields(
  fields: FriendlyField[],
  faces: Record<string, unknown>[] | null,
  livenessThreshold: number,
  preferAuthenticity = false
) {
  if (!faces?.length) return;
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i]!;
    pushSection(fields, faces.length === 1 ? 'Face' : `Face ${i + 1}`);
    const region =
      asObj(face.box) || asObj(face.faceRegion) || asObj(face.region);
    if (region) {
      const box = parseBox(region);
      if (box) {
        pushField(fields, 'Box', `${box[0]}, ${box[1]} · ${box[2]}×${box[3]}`);
      }
    }
    const pose = asObj(face.pose) || asObj(face.facePose);
    if (pose) {
      pushField(
        fields,
        'Pose',
        `yaw ${fmt(Number(pose.yaw ?? 0))}°  roll ${fmt(Number(pose.roll ?? 0))}°  pitch ${fmt(Number(pose.pitch ?? 0))}°`
      );
    }
    const traits =
      asObj(face.traits) || asObj(face.attributes) || asObj(face.quality);
    if (traits) {
      if (preferAuthenticity) {
        appendAuthenticityTraits(fields, traits, livenessThreshold);
      }
      const keys = Object.keys(traits).sort();
      for (const key of keys) {
        const lower = key.toLowerCase();
        if (
          preferAuthenticity &&
          (lower.includes('liveness') || lower.includes('deepfake'))
        ) {
          continue;
        }
        const shown = lower.includes('deepfake')
          ? deepfakeTraitText(traits[key])
          : traitValue(traits[key]);
        if (shown.trim()) pushField(fields, humanize(key), shown);
      }
    }
    const landmarks = asArr(face.landmarks) || asArr(face.facePoints);
    if (landmarks && landmarks.length > 0) {
      pushField(fields, 'Landmarks', `${landmarks.length} points`);
    }
  }
}

function appendTopLevelExtras(
  fields: FriendlyField[],
  root: Record<string, unknown>
) {
  for (const key of ['liveness', 'quality', 'label', 'message']) {
    if (!(key in root)) continue;
    if (key === 'message' && fields.length > 0) continue;
    const shown = traitValue(root[key]);
    if (
      shown.trim() &&
      !fields.some(
        (f) =>
          f.kind === 'field' &&
          f.title.toLowerCase() === humanize(key).toLowerCase()
      )
    ) {
      pushField(fields, humanize(key), shown);
    }
  }
}

function authenticityFromFaces(
  faces: Record<string, unknown>[] | null,
  livenessThreshold: number
): { ok: boolean; heading: string } {
  const face = faces?.[0];
  if (!face) return { ok: false, heading: 'FAKE' };
  const traits = asObj(face.traits) || asObj(face.attributes);
  if (!traits) return { ok: false, heading: 'FAKE' };
  const live =
    asObj(traits.liveness2d) ||
    asObj(traits.Liveness2D) ||
    asObj(traits.liveness);
  const df = asObj(traits.deepfake) || asObj(traits.Deepfake);
  const liveLabel =
    live && live.value != null ? String(live.value) : '';
  const liveScore =
    live && typeof live.confidence === 'number' ? live.confidence : 0;
  const dfRaw = deepfakeRawFromTrait(df);
  const heading = authenticityHeading(
    { liveness_threshold: livenessThreshold },
    liveScore,
    liveLabel,
    dfRaw
  );
  return { ok: heading === 'REAL', heading };
}

function landmarkCountOf(faces: Record<string, unknown>[] | null): number {
  const face = faces?.[0];
  if (!face) return 0;
  const lm = asArr(face.landmarks) || asArr(face.facePoints);
  return lm?.length ?? 0;
}

/** Flatten face landmarks / facePoints to [x,y,x,y,…]. */
export function extractLandmarksXy(json: string): number[] | null {
  const root = parseRoot(json);
  if (!root) return null;
  const faces = facesOf(root);
  const face = faces?.[0];
  if (!face) return null;
  const lm = asArr(face.landmarks) || asArr(face.facePoints);
  if (!lm?.length) return null;
  const out: number[] = [];
  for (const p of lm) {
    if (typeof p === 'number') {
      out.push(p);
      continue;
    }
    const o = asObj(p);
    if (o && (o.x != null || o.y != null)) {
      out.push(Number(o.x ?? 0), Number(o.y ?? 0));
      continue;
    }
    const pair = asArr(p);
    if (pair && pair.length >= 2) {
      out.push(Number(pair[0]), Number(pair[1]));
    }
  }
  return out.length >= 2 ? out : null;
}

export function buildFriendlyView(
  mode: string,
  json: string,
  identifyThreshold: number,
  livenessThreshold: number
): FriendlyView {
  const root = parseRoot(json);
  if (!root) {
    return {
      ok: false,
      status: 'Failed',
      summary: 'No face detected',
      scoreLabel: null,
      fields: [],
    };
  }

  const modeName = (mode || String(root.mode ?? '')).toUpperCase();
  const faces = facesOf(root);
  const score = extractScore(root);
  const fields: FriendlyField[] = [];
  const threshold = identifyThreshold;
  const scoreLabel =
    score != null ? `Score ${formatScore(score)}` : null;

  switch (modeName) {
    case 'IDENTITY': {
      const matched =
        typeof root.matched === 'boolean'
          ? root.matched
          : Boolean(root.name) && score != null;
      const name =
        typeof root.name === 'string' && root.name.trim()
          ? root.name
          : '—';
      if (score != null) pushField(fields, 'Similarity', formatScore(score));
      if (root.id != null) pushField(fields, 'Person id', String(root.id));
      pushField(fields, 'Name', name);
      return {
        ok: matched,
        status: matched ? 'Identified' : 'No match',
        summary: matched
          ? `Matched ${name}`
          : 'No enrolled person matched this face.',
        scoreLabel,
        fields,
      };
    }
    case 'ENROLL': {
      const name =
        typeof root.name === 'string' && root.name.trim()
          ? root.name
          : '—';
      pushField(fields, 'Name', name);
      if (root.id != null) pushField(fields, 'Person id', String(root.id));
      return {
        ok: root.success !== false,
        status: 'Enrolled',
        summary: `Enrolled: ${name}`,
        scoreLabel: null,
        fields,
      };
    }
    case 'MATCH': {
      const same =
        typeof root.same === 'boolean'
          ? root.same
          : typeof root.matched === 'boolean'
            ? root.matched
            : score != null
              ? score >= threshold
              : false;
      if (score != null) {
        pushSection(fields, 'Match');
        pushField(fields, 'Similarity', formatScore(score));
        pushField(fields, 'Threshold', formatScore(threshold));
        pushField(
          fields,
          'Verdict',
          same ? 'Same person' : 'Different person'
        );
      }
      appendFaceFields(fields, faces, livenessThreshold);
      return {
        ok: same,
        status: same ? 'Same person' : 'Different person',
        summary:
          score != null
            ? `Similarity ${formatScore(score)}`
            : 'No face detected',
        scoreLabel,
        fields,
      };
    }
    case 'LANDMARKS': {
      const count = landmarkCountOf(faces);
      appendFaceFields(fields, faces, livenessThreshold);
      return {
        ok: count > 0 || (faces?.length ?? 0) > 0,
        status: 'Landmarks',
        summary:
          count > 0 ? `${count} points` : '1 face detected',
        scoreLabel: null,
        fields,
      };
    }
    case 'LIVENESS': {
      const auth = authenticityFromFaces(faces, livenessThreshold);
      appendFaceFields(fields, faces, livenessThreshold, true);
      return {
        ok: auth.ok,
        status: auth.heading,
        summary:
          (faces?.length ?? 0) > 0
            ? '1 face detected'
            : 'No face detected',
        scoreLabel: null,
        fields,
      };
    }
    default: {
      const count = faces?.length ?? 0;
      const ok =
        typeof root.success === 'boolean'
          ? root.success
          : count > 0 || root.result != null || score != null;
      appendFaceFields(fields, faces, livenessThreshold);
      appendTopLevelExtras(fields, root);
      return {
        ok,
        status: ok ? 'Success' : 'Failed',
        summary:
          count === 1
            ? '1 face detected'
            : count > 1
              ? `${count} faces detected`
              : typeof root.message === 'string' && root.message.trim()
                ? root.message
                : 'No face detected',
        scoreLabel,
        fields,
      };
    }
  }
}
