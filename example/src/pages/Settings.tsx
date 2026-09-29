import { useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonViewWillEnter,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { setLandmarkMode } from 'face-recognition-capacitor';
import { goHome } from '../nav';
import {
  DEFAULT_SETTINGS,
  clearAllPeople,
  loadSettings,
  restoreDefaultSettings,
  saveSettings,
  type AppSettings,
  type LandmarkMode,
} from '../FaceDatabase';
import { ensureCameraStopped } from '../cameraLifecycle';

function inRange(v: number, min: number, max: number) {
  return Number.isFinite(v) && v >= min && v <= max;
}

const LANDMARK_OPTIONS: LandmarkMode[] = [14, 68];

export default function Settings() {
  const history = useHistory();
  const [presentAlert] = useIonAlert();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const syncDraft = (s: AppSettings) => {
    setDraft({
      liveness_threshold: String(s.liveness_threshold),
      identify_threshold: String(s.identify_threshold),
      identity_hold_duration: String(s.identity_hold_duration),
    });
  };

  useIonViewWillEnter(() => {
    void ensureCameraStopped();
  });

  useEffect(() => {
    void loadSettings().then((s) => {
      setSettings(s);
      syncDraft(s);
    });
  }, []);

  const commit = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch, liveness_level: 0 as const };
    setSettings(next);
    await saveSettings(next);
    if (patch.landmark_mode != null) {
      void setLandmarkMode(patch.landmark_mode).catch(() => {});
    }
  };

  const commitNum = async (
    key: keyof AppSettings,
    raw: string,
    min: number,
    max: number
  ) => {
    setDraft((d) => ({ ...d, [key]: raw }));
    const v = parseFloat(raw);
    if (!inRange(v, min, max)) return;
    await commit({ [key]: v } as Partial<AppSettings>);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => goHome(history)}>Back</IonButton>
          </IonButtons>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="settings-section">Camera</div>
        <div className="settings-card">
          <div className="settings-label">Camera lens</div>
          <div className="radio-row">
            <button
              type="button"
              className="radio-item"
              onClick={() => void commit({ camera_lens: 'front' })}
            >
              <span className={`radio-dot ${settings.camera_lens === 'front' ? 'on' : ''}`} />
              Front
            </button>
            <button
              type="button"
              className="radio-item"
              onClick={() => void commit({ camera_lens: 'back' })}
            >
              <span className={`radio-dot ${settings.camera_lens === 'back' ? 'on' : ''}`} />
              Back
            </button>
          </div>

          <div className="settings-label" style={{ marginTop: 16 }}>
            Landmark mode
          </div>
          <div className="radio-row">
            {LANDMARK_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                className="radio-item"
                onClick={() => void commit({ landmark_mode: m })}
              >
                <span
                  className={`radio-dot ${settings.landmark_mode === m ? 'on' : ''}`}
                />
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">Identity capture requirements</div>
        <div className="settings-card">
          <IonList>
            {(
              [
                ['Hold duration (sec)', 'identity_hold_duration', 0.1, 5],
              ] as const
            ).map(([label, key, min, max]) => (
              <IonItem key={key}>
                <IonLabel>{label}</IonLabel>
                <IonInput
                  inputmode="decimal"
                  value={draft[key] ?? ''}
                  onIonInput={(e) =>
                    void commitNum(key, String(e.detail.value ?? ''), min, max)
                  }
                />
              </IonItem>
            ))}
          </IonList>
        </div>

        <div className="settings-section">Thresholds</div>
        <div className="settings-card">
          <IonList>
            <IonItem>
              <IonLabel>Liveness</IonLabel>
              <IonInput
                inputmode="decimal"
                value={draft.liveness_threshold ?? ''}
                onIonInput={(e) =>
                  void commitNum(
                    'liveness_threshold',
                    String(e.detail.value ?? ''),
                    0,
                    1
                  )
                }
              />
            </IonItem>
            <IonItem>
              <IonLabel>Identify</IonLabel>
              <IonInput
                inputmode="decimal"
                value={draft.identify_threshold ?? ''}
                onIonInput={(e) =>
                  void commitNum(
                    'identify_threshold',
                    String(e.detail.value ?? ''),
                    0,
                    1
                  )
                }
              />
            </IonItem>
          </IonList>
        </div>

        <div className="settings-section">Reset</div>
        <div className="settings-card">
          <button
            type="button"
            className="settings-action"
            onClick={() =>
              void restoreDefaultSettings().then((s) => {
                setSettings(s);
                syncDraft(s);
                void setLandmarkMode(s.landmark_mode).catch(() => {});
              })
            }
          >
            Restore default settings
          </button>
          <button
            type="button"
            className="settings-action"
            onClick={() =>
              presentAlert({
                header: 'Clear all person',
                buttons: [
                  { text: 'Cancel', role: 'cancel' },
                  {
                    text: 'Clear',
                    role: 'destructive',
                    handler: () => void clearAllPeople(),
                  },
                ],
              })
            }
          >
            Clear all person
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
}
