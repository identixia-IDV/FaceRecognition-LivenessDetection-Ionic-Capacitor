import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { loadSettings } from '../FaceDatabase';
import LandmarkImage from '../components/LandmarkImage';
import {
  buildFriendlyView,
  extractLandmarksXy,
  prettyJson,
  type FriendlyView,
} from '../modeResultFriendly';
import { clearModeResult, getModeResult } from '../resultStore';
import { goHome } from '../nav';
import { displayUri } from '../pickImage';
import { ensureCameraStopped } from '../cameraLifecycle';

function landmarksToPoints(xy: number[] | null | undefined): { x: number; y: number }[] {
  if (!xy || xy.length < 2) return [];
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < xy.length; i += 2) {
    pts.push({ x: xy[i]!, y: xy[i + 1]! });
  }
  return pts;
}

function PeoplePlaceholder() {
  return (
    <div className="people-placeholder" aria-hidden>
      <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16,11c1.66,0 2.99,-1.34 2.99,-3S17.66,5 16,5c-1.66,0 -3,1.34 -3,3s1.34,3 3,3zM8,11c1.66,0 2.99,-1.34 2.99,-3S9.66,5 8,5C6.34,5 5,6.34 5,8s1.34,3 3,3zM8,13c-2.33,0 -7,1.17 -7,3.5V19h14v-2.5c0,-2.33 -4.67,-3.5 -7,-3.5zM16,13c-0.29,0 -0.62,0.02 -0.97,0.05 1.16,0.84 1.97,1.97 1.97,3.45V19h6v-2.5c0,-2.33 -4.67,-3.5 -7,-3.5z" />
      </svg>
    </div>
  );
}

export default function ModeResult() {
  const history = useHistory();
  const payload = useMemo(() => getModeResult(), []);
  const [view, setView] = useState<FriendlyView | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const landmarksXy = useMemo(() => {
    if (!payload) return null;
    if (payload.landmarksXy && payload.landmarksXy.length >= 2) {
      return payload.landmarksXy;
    }
    return extractLandmarksXy(payload.json);
  }, [payload]);
  const landmarkPoints = useMemo(
    () => landmarksToPoints(landmarksXy),
    [landmarksXy]
  );
  const rawPretty = useMemo(
    () => (payload ? prettyJson(payload.json) : '{}'),
    [payload]
  );

  useEffect(() => {
    void ensureCameraStopped();
  }, []);

  useEffect(() => {
    if (!payload) {
      goHome(history);
      return;
    }
    (async () => {
      const settings = await loadSettings();
      setView(
        buildFriendlyView(
          payload.mode,
          payload.json,
          settings.identify_threshold,
          settings.liveness_threshold
        )
      );
    })();
    return () => clearModeResult();
  }, [history, payload]);

  if (!payload) return null;

  const thumb1 = displayUri(payload.thumbUri) ?? payload.thumbUri ?? null;
  const thumb2 = displayUri(payload.thumb2Uri) ?? payload.thumb2Uri ?? null;
  const ok = view?.ok ?? false;
  const mode = payload.mode;

  let media: JSX.Element | null = null;
  if (mode === 'LANDMARKS' && thumb1 && landmarkPoints.length) {
    media = (
      <div className="media-row">
        <LandmarkImage
          uri={thumb1}
          landmarks={landmarkPoints}
          width={300}
          height={300}
        />
      </div>
    );
  } else if (mode === 'LANDMARKS' && thumb1) {
    media = (
      <div className="media-row media-single">
        <div className="match-pair-col">
          <img src={thumb1} alt="" className="result-thumb" />
          <span className="match-pair-label">Captured</span>
        </div>
      </div>
    );
  } else if (mode === 'MATCH' && thumb1 && thumb2) {
    media = (
      <div className="match-pair">
        <div className="match-pair-col">
          <img src={thumb1} alt="" className="result-thumb" />
          <span className="match-pair-label">Face 1</span>
        </div>
        <span className={`match-pair-symbol ${ok ? 'ok' : 'bad'}`}>
          {ok ? '=' : '≠'}
        </span>
        <div className="match-pair-col">
          <img src={thumb2} alt="" className="result-thumb" />
          <span className="match-pair-label">Face 2</span>
        </div>
      </div>
    );
  } else if (mode === 'IDENTITY' && thumb1) {
    media = (
      <div className="match-pair">
        <div className="match-pair-col">
          <img src={thumb1} alt="" className="result-thumb" />
          <span className="match-pair-label">Identified</span>
        </div>
        <span className={`match-pair-symbol ${ok ? 'ok' : 'bad'}`}>
          {ok ? '=' : '≠'}
        </span>
        <div className="match-pair-col">
          {thumb2 ? (
            <img src={thumb2} alt="" className="result-thumb" />
          ) : (
            <PeoplePlaceholder />
          )}
          <span className="match-pair-label">Enrolled</span>
        </div>
      </div>
    );
  } else if (thumb1) {
    media = (
      <div className="media-row media-single">
        <div className="match-pair-col">
          <img src={thumb1} alt="" className="result-thumb" />
          <span className="match-pair-label">
            {mode === 'ENROLL' ? 'Enrolled' : 'Captured face'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <IonPage className="mode-result-page">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => goHome(history)}>Home</IonButton>
          </IonButtons>
          <IonTitle>{payload.title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding mode-result-content">
        <div className={`status-card ${ok ? 'ok' : 'bad'}`}>
          {view?.status || payload.title}
        </div>
        {view?.summary ? (
          <p className="result-summary">{view.summary}</p>
        ) : null}
        {view?.scoreLabel ? (
          <p className="result-score">{view.scoreLabel}</p>
        ) : null}
        {media}
        {!view?.fields?.length ? (
          <p className="result-empty muted">No extra details for this result.</p>
        ) : (
          <div className="result-details">
            {view.fields.map((row, i) =>
              row.kind === 'section' ? (
                <div key={`s-${i}`} className="result-section">
                  {row.title}
                </div>
              ) : (
                <div key={`f-${i}`} className="result-field">
                  <div className="result-field-title">{row.title}</div>
                  <div className="result-field-value">{row.value}</div>
                </div>
              )
            )}
          </div>
        )}
        <IonButton
          expand="block"
          fill="outline"
          className="ion-margin-top"
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? 'Hide Raw JSON' : 'Show Raw JSON'}
        </IonButton>
        {showRaw ? <pre className="raw-json">{rawPretty}</pre> : null}
      </IonContent>
    </IonPage>
  );
}
