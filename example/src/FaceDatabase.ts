const PEOPLE_KEY = 'face_enrolled_people_v1';
const SETTINGS_KEY = 'face_settings_sdk_v1';
const PREFS_SCHEMA_KEY = 'prefs_schema';
const PREFS_SCHEMA_VW = 4;

export type EnrolledPerson = {
  id: string;
  name: string;
  featureB64: string;
  thumbB64: string | null;
};

export type LandmarkMode = 14 | 68;

export type AppSettings = {
  camera_lens: 'front' | 'back';
  liveness_threshold: number;
  /** Always 0 (heavy). */
  liveness_level: 0 | 1;
  identify_threshold: number;
  yaw_threshold: number;
  roll_threshold: number;
  pitch_threshold: number;
  eyeclose_threshold: number;
  identity_hold_duration: number;
  landmark_mode: LandmarkMode;
};

export const DEFAULT_SETTINGS: AppSettings = {
  camera_lens: 'front',
  liveness_threshold: 0.5,
  liveness_level: 0,
  identify_threshold: 0.67,
  yaw_threshold: 40,
  roll_threshold: 40,
  pitch_threshold: 40,
  eyeclose_threshold: 0.5,
  identity_hold_duration: 0.5,
  landmark_mode: 68,
};

export async function loadPeople(): Promise<EnrolledPerson[]> {
  const raw = localStorage.getItem(PEOPLE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function savePeople(people: EnrolledPerson[]): Promise<void> {
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
}

export async function addPerson(
  name: string,
  featureB64: string,
  thumbB64: string | null
): Promise<EnrolledPerson> {
  const people = await loadPeople();
  const person: EnrolledPerson = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    featureB64,
    thumbB64,
  };
  people.push(person);
  await savePeople(people);
  return person;
}

export async function deletePerson(id: string): Promise<void> {
  const people = await loadPeople();
  await savePeople(people.filter((p) => p.id !== id));
}

export async function clearAllPeople(): Promise<void> {
  localStorage.removeItem(PEOPLE_KEY);
}

export function autoPersonName(): string {
  return `Person${10000 + Math.floor(Math.random() * 10000)}`;
}

export function applyEngineDefaults(): void {
  const schema = parseInt(localStorage.getItem(PREFS_SCHEMA_KEY) || '0', 10);
  if (schema >= PREFS_SCHEMA_VW) return;
  const next = { ...DEFAULT_SETTINGS };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  localStorage.setItem(PREFS_SCHEMA_KEY, String(PREFS_SCHEMA_VW));
}

export async function loadSettings(): Promise<AppSettings> {
  applyEngineDefaults();
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const p = JSON.parse(raw);
    const lm = num(p.landmark_mode, DEFAULT_SETTINGS.landmark_mode);
    return {
      camera_lens: p.camera_lens === 'back' ? 'back' : 'front',
      liveness_threshold: num(
        p.liveness_threshold,
        DEFAULT_SETTINGS.liveness_threshold
      ),
      liveness_level: 0,
      identify_threshold: num(
        p.identify_threshold,
        DEFAULT_SETTINGS.identify_threshold
      ),
      yaw_threshold: num(p.yaw_threshold, DEFAULT_SETTINGS.yaw_threshold),
      roll_threshold: num(p.roll_threshold, DEFAULT_SETTINGS.roll_threshold),
      pitch_threshold: num(p.pitch_threshold, DEFAULT_SETTINGS.pitch_threshold),
      eyeclose_threshold: num(
        p.eyeclose_threshold,
        DEFAULT_SETTINGS.eyeclose_threshold
      ),
      identity_hold_duration: Math.min(
        5,
        Math.max(
          0.1,
          num(
            p.identity_hold_duration,
            DEFAULT_SETTINGS.identity_hold_duration
          )
        )
      ),
      landmark_mode: lm === 14 ? 14 : 68,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...settings, liveness_level: 0 })
  );
}

export async function restoreDefaultSettings(): Promise<AppSettings> {
  await saveSettings({ ...DEFAULT_SETTINGS });
  localStorage.setItem(PREFS_SCHEMA_KEY, String(PREFS_SCHEMA_VW));
  return { ...DEFAULT_SETTINGS };
}
