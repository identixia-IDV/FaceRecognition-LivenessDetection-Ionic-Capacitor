import type { FaceBox } from 'face-recognition-capacitor';
import type { FaceModeId } from './FaceMode';

const ATTR_KEY = 'frs_attribute_result';
const IDENT_KEY = 'frs_identify_result';

export type ModeResultPayload = {
  mode: FaceModeId;
  title: string;
  json: string;
  thumbUri?: string | null;
  thumb2Uri?: string | null;
  /** Crop-mapped landmark xy (200×200 cropFace space), Android RESULT_LANDMARKS_XY. */
  landmarksXy?: number[] | null;
};

export type AttributeResult = {
  uri: string;
  box: FaceBox;
  cropB64?: string | null;
  cropLandmarks?: { x: number; y: number }[];
};

export type IdentifyResult = {
  personName: string;
  similarity: number;
  enrolledThumbB64?: string | null;
  identifiedUri?: string | null;
  box?: FaceBox;
  cropLandmarks?: { x: number; y: number }[];
};

let memoryAttr: AttributeResult | null = null;
let memoryIdent: IdentifyResult | null = null;
let memoryMode: ModeResultPayload | null = null;

function payloadBytes(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (payloadBytes(value) > 1_200_000) return;
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setAttributeResult(data: AttributeResult): void {
  memoryAttr = data;
  write(ATTR_KEY, {
    box: data.box,
    cropB64: data.cropB64 ?? null,
    cropLandmarks: data.cropLandmarks ?? [],
    uri: data.uri.startsWith('data:') ? '' : data.uri,
  });
}

export function getAttributeResult(): AttributeResult | null {
  if (memoryAttr) return memoryAttr;
  return read<AttributeResult>(ATTR_KEY);
}

export function setIdentifyResult(data: IdentifyResult): void {
  memoryIdent = data;
  write(IDENT_KEY, data);
}

export function getIdentifyResult(): IdentifyResult | null {
  if (memoryIdent) return memoryIdent;
  return read<IdentifyResult>(IDENT_KEY);
}

export function setModeResult(data: ModeResultPayload): void {
  memoryMode = data;
}

export function getModeResult(): ModeResultPayload | null {
  return memoryMode;
}

export function clearModeResult(): void {
  memoryMode = null;
}
