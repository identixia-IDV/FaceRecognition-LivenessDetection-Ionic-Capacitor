import {
  normalizeFaceBoxes,
  type FaceBox,
} from 'face-recognition-capacitor';

function traitLabel(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const base =
      o.value != null
        ? String(o.value)
        : o.label != null
          ? String(o.label)
          : '';
    if (typeof o.confidence === 'number') {
      return base ? `${base} (${o.confidence})` : String(o.confidence);
    }
    return base;
  }
  return '';
}

function windowsFaceToBox(face: any): FaceBox {
  const region = face.box || face.faceRegion || face.region || {};
  const pose = face.pose || face.facePose || {};
  const traits = face.traits || face.attributes || {};
  const attrs: Record<string, string> = {};
  if (traits && typeof traits === 'object') {
    for (const key of Object.keys(traits)) {
      const shown = traitLabel(traits[key]);
      if (shown) attrs[key] = shown;
    }
  }
  const live =
    traits.liveness2d || traits.Liveness2D || traits.liveness || null;
  const liveScore =
    typeof live?.confidence === 'number' ? live.confidence : 0;
  const liveLabel =
    live?.value != null
      ? String(live.value)
      : live?.label != null
        ? String(live.label)
        : '';
  const x = Number(region.x ?? region.x1 ?? 0);
  const y = Number(region.y ?? region.y1 ?? 0);
  const w = Number(region.width ?? (region.x2 != null ? region.x2 - x : 0));
  const h = Number(region.height ?? (region.y2 != null ? region.y2 - y : 0));
  return {
    x1: x,
    y1: y,
    x2: x + w,
    y2: y + h,
    yaw: Number(pose.yaw ?? 0),
    roll: Number(pose.roll ?? 0),
    pitch: Number(pose.pitch ?? 0),
    liveness: liveScore,
    livenessLabel: liveLabel,
    attributes: attrs,
  } as FaceBox;
}

/** Parse ModeAnalyzer JSON into a FaceBox (Android / RN ModeResult parity). */
export function firstBoxFromJson(json: string): FaceBox | null {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      const boxes = normalizeFaceBoxes(parsed);
      return (boxes[0] as FaceBox) ?? null;
    }
    if (parsed && typeof parsed === 'object') {
      const objects =
        parsed.objects ??
        parsed.faces ??
        parsed.result?.objects ??
        parsed.result?.faces ??
        parsed.data?.faces;
      if (Array.isArray(objects) && objects.length) {
        const maybeBoxes = normalizeFaceBoxes(objects);
        if (
          maybeBoxes[0] &&
          ((maybeBoxes[0] as FaceBox).x1 != null ||
            (maybeBoxes[0] as FaceBox).attributes)
        ) {
          return maybeBoxes[0] as FaceBox;
        }
        const face = objects[0];
        if (face && typeof face === 'object') {
          return windowsFaceToBox(face);
        }
      }
      if (parsed.x1 != null || parsed.liveness != null || parsed.attributes) {
        return normalizeFaceBoxes([parsed])[0] as FaceBox;
      }
      if (parsed.similarity != null || parsed.same != null) {
        return {
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
          attributes: {
            Similarity:
              typeof parsed.similarity === 'number'
                ? `${Math.round(parsed.similarity * 100)}%`
                : String(parsed.similarity ?? ''),
            Verdict: parsed.same === true ? 'Same person' : 'Different person',
          },
        } as FaceBox;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}
