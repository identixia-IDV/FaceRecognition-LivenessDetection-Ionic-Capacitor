import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { IonPage, useIonAlert } from '@ionic/react';
import {
  CaptureSession,
  cropFace,
  evaluateIdentity,
  exportLastLiveFrame,
  extractFeature,
  faceDetection,
  mapLandmarksToCrop,
  setLandmarkMode,
  similarity,
  templateExtraction,
  toCaptureSettings,
  type CaptureSettings,
  type CaptureState,
  type FaceBox,
} from 'face-recognition-capacitor';
import { FACE_MODES, type FaceModeId } from '../FaceMode';
import {
  addPerson,
  autoPersonName,
  loadPeople,
  loadSettings,
  type AppSettings,
  type EnrolledPerson,
} from '../FaceDatabase';
import { analyzeMode } from '../modeAnalyzer';
import { ensureCameraPermission } from '../cameraPermission';
import { measureImage, pickGalleryPhoto, thumbSrc } from '../pickImage';
import { setModeResult } from '../resultStore';
import { goHome } from '../nav';
import FaceOverlay from '../components/FaceOverlay';
import IdentityGuide, {
  identityHintColor,
  identityHintText,
} from '../components/IdentityGuide';
import { useLiveStage } from '../useLiveStage';

function largestBox(boxes: FaceBox[]): FaceBox {
  let best = boxes[0]!;
  let bestArea = (best.x2 - best.x1) * (best.y2 - best.y1);
  for (const b of boxes.slice(1)) {
    const a = (b.x2 - b.x1) * (b.y2 - b.y1);
    if (a > bestArea) {
      best = b;
      bestArea = a;
    }
  }
  return best;
}

/** Android ModeCamera: crop largest face → data URI thumb (fallback: full uri). */
async function cropThumbSrc(uri: string): Promise<string> {
  try {
    const boxes = await faceDetection(uri, { allAttributes: false });
    if (!boxes.length) return uri;
    const b64 = await cropFace(uri, largestBox(boxes));
    return thumbSrc(b64) ?? uri;
  } catch {
    return uri;
  }
}

async function cropLandmarksThumb(
  uri: string
): Promise<{ thumb: string; landmarksXy: number[] | null }> {
  try {
    const boxes = await faceDetection(uri, { check_landmarks: true });
    if (!boxes.length) return { thumb: uri, landmarksXy: null };
    const box = largestBox(boxes);
    const b64 = await cropFace(uri, box);
    const thumb = thumbSrc(b64) ?? uri;
    let srcW = Math.max(box.x2 + 1, 1);
    let srcH = Math.max(box.y2 + 1, 1);
    try {
      const dims = await measureImage(uri);
      if (dims.w > 0 && dims.h > 0) {
        srcW = dims.w;
        srcH = dims.h;
      }
    } catch {
      // box-based fallback
    }
    let outW = 200;
    let outH = 200;
    try {
      const cropDims = await measureImage(thumb);
      if (cropDims.w > 0 && cropDims.h > 0) {
        outW = cropDims.w;
        outH = cropDims.h;
      }
    } catch {
      // keep fallback
    }
    const pts = mapLandmarksToCrop(box, srcW, srcH, outW, outH);
    if (!pts.length) return { thumb, landmarksXy: null };
    const landmarksXy: number[] = [];
    for (const p of pts) {
      landmarksXy.push(p.x, p.y);
    }
    return { thumb, landmarksXy };
  } catch {
    return { thumb: uri, landmarksXy: null };
  }
}

function parseFeatureB64(json: string): string | null {
  try {
    const root = JSON.parse(json);
    const fromResults =
      root?.features?.[0]?.features?.[0]?.feature ??
      root?.result?.features?.[0]?.features?.[0]?.feature ??
      root?.features?.[0]?.feature ??
      root?.result?.features?.[0]?.feature ??
      root?.results?.[0]?.features?.[0]?.feature ??
      root?.feature ??
      root?.data ??
      root?.featureBase64;
    if (typeof fromResults === 'string' && fromResults.trim()) {
      return fromResults.trim();
    }
    if (
      fromResults &&
      typeof fromResults === 'object' &&
      typeof (fromResults as { data?: string }).data === 'string'
    ) {
      return (fromResults as { data: string }).data.trim() || null;
    }
  } catch {
    // ignore
  }
  return null;
}

async function probeFeature(
  uri: string,
  box: FaceBox | null
): Promise<string | null> {
  try {
    const json = await extractFeature(uri);
    const b64 = parseFeatureB64(json);
    if (b64) return b64;
  } catch {
    // fall through
  }
  if (box) {
    try {
      return await templateExtraction(uri, box);
    } catch {
      return null;
    }
  }
  return null;
}

export default function ModeCamera() {
  const { mode: modeId = 'FACE_DETECT' } = useParams<{ mode: string }>();
  const mode = FACE_MODES[modeId as FaceModeId] ?? FACE_MODES.FACE_DETECT;
  const isIdentity = mode.id === 'IDENTITY';
  const history = useHistory();
  const [presentAlert] = useIonAlert();

  const { stageRef, size } = useLiveStage();
  const sessionRef = useRef<CaptureSession | null>(null);
  const settingsRef = useRef<CaptureSettings | null>(null);
  const appSettingsRef = useRef<AppSettings | null>(null);
  const peopleRef = useRef<EnrolledPerson[]>([]);
  const busyRef = useRef(false);
  const confirmingRef = useRef(false);
  const identityOkSinceMsRef = useRef(0);
  const lastIdentityStateRef = useRef<CaptureState>('NO_FACE');
  const oddUri = useRef<string | null>(null);

  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [boxes, setBoxes] = useState<FaceBox[]>([]);
  const [frame, setFrame] = useState({ w: 480, h: 640 });
  const [mirror, setMirror] = useState(false);
  const [identityState, setIdentityState] = useState<CaptureState>('NO_FACE');
  const [identityProgress, setIdentityProgress] = useState(0);
  const [identityCapturing, setIdentityCapturing] = useState(false);
  const [hasOdd, setHasOdd] = useState(false);
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => mode.title, [mode.title]);

  const stillHint = useMemo(() => {
    if (mode.id === 'MATCH') {
      return hasOdd
        ? 'Face 2 of 2 — align and tap Capture'
        : 'Face 1 of 2 — align and tap Capture';
    }
    return 'Align face, then capture';
  }, [mode.id, hasOdd]);

  const stopSession = useCallback(async () => {
    try {
      await sessionRef.current?.stop();
    } catch {
      // already stopped
    }
    sessionRef.current = null;
  }, []);

  const openModeResult = useCallback(
    async (
      json: string,
      thumbUri: string | null,
      thumb2Uri: string | null = null,
      landmarksXy?: number[] | null
    ) => {
      await stopSession();
      setModeResult({
        mode: mode.id,
        title: mode.title,
        json,
        thumbUri,
        thumb2Uri,
        landmarksXy: landmarksXy ?? undefined,
      });
      history.replace('/mode-result');
    },
    [history, mode.id, mode.title, stopSession]
  );

  const finishIdentity = useCallback(
    async (uri: string, faceBox: FaceBox | null) => {
      const people = peopleRef.current;
      const threshold = appSettingsRef.current?.identify_threshold ?? 0.67;
      const feature = await probeFeature(uri, faceBox);
      let best: { person: EnrolledPerson; score: number } | null = null;
      if (feature) {
        for (const person of people) {
          try {
            const score = await similarity(feature, person.featureB64);
            if (score >= threshold && (!best || score > best.score)) {
              best = { person, score };
            }
          } catch {
            // skip broken template
          }
        }
      }
      let thumbUri = uri;
      if (faceBox) {
        try {
          const cropB64 = await cropFace(uri, faceBox);
          thumbUri = thumbSrc(cropB64) ?? uri;
        } catch {
          thumbUri = await cropThumbSrc(uri);
        }
      } else {
        thumbUri = await cropThumbSrc(uri);
      }
      const json = JSON.stringify({
        success: best != null,
        mode: 'IDENTITY',
        matched: best != null,
        ...(best
          ? {
              name: best.person.name,
              id: best.person.id,
              score: best.score,
            }
          : {}),
      });
      await openModeResult(
        json,
        thumbUri,
        best ? thumbSrc(best.person.thumbB64) ?? null : null
      );
    },
    [openModeResult]
  );

  const enrollFromUri = useCallback(
    async (uri: string): Promise<boolean> => {
      const detected = await faceDetection(uri, { allAttributes: false });
      if (detected.length !== 1) {
        presentAlert({
          header: 'Enroll',
          message:
            detected.length === 0
              ? 'No face detected!'
              : 'Multiple face detected!',
          buttons: ['OK'],
        });
        return false;
      }
      const box = detected[0]!;
      const feat = await templateExtraction(uri, box);
      let thumb: string | null = null;
      try {
        thumb = await cropFace(uri, box);
      } catch {
        thumb = null;
      }
      const person = await addPerson(autoPersonName(), feat, thumb);
      await openModeResult(
        JSON.stringify({
          success: true,
          mode: 'ENROLL',
          name: person.name,
          id: person.id,
        }),
        thumbSrc(thumb) ?? (await cropThumbSrc(uri)),
        null
      );
      presentAlert({
        header: 'Person enrolled!',
        buttons: ['OK'],
      });
      return true;
    },
    [openModeResult, presentAlert]
  );

  const analyzeStillUri = useCallback(
    async (uri: string) => {
      const settings = appSettingsRef.current ?? (await loadSettings());
      await setLandmarkMode(settings.landmark_mode).catch(() => undefined);
      if (mode.id === 'ENROLL') {
        return enrollFromUri(uri);
      }
      if (mode.id === 'MATCH') {
        if (!oddUri.current) {
          oddUri.current = uri;
          setHasOdd(true);
          presentAlert({
            header: 'Match',
            message: 'Face 1 saved — capture face 2',
            buttons: ['OK'],
          });
          return false;
        }
        const json = await analyzeMode(
          'MATCH',
          uri,
          oddUri.current,
          settings.landmark_mode
        );
        if (!json) {
          presentAlert({ header: 'Analysis failed', buttons: ['OK'] });
          return true;
        }
        const [thumb1, thumb2] = await Promise.all([
          cropThumbSrc(oddUri.current),
          cropThumbSrc(uri),
        ]);
        await openModeResult(json, thumb1, thumb2);
        return true;
      }
      const json = await analyzeMode(
        mode.id,
        uri,
        null,
        settings.landmark_mode
      );
      if (!json) {
        presentAlert({ header: 'Analysis failed', buttons: ['OK'] });
        return true;
      }
      if (mode.id === 'LANDMARKS') {
        const { thumb, landmarksXy } = await cropLandmarksThumb(uri);
        await openModeResult(json, thumb, null, landmarksXy);
      } else {
        const thumb = await cropThumbSrc(uri);
        await openModeResult(json, thumb, null);
      }
      return true;
    },
    [enrollFromUri, mode.id, openModeResult, presentAlert]
  );

  const onShutter = useCallback(async () => {
    if (isIdentity || busyRef.current || confirmingRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const exported = await exportLastLiveFrame();
      const uri = exported.uri;
      if (!uri) {
        presentAlert({
          header: mode.title,
          message: 'No camera frame yet',
          buttons: ['OK'],
        });
        return;
      }
      await analyzeStillUri(uri);
    } catch (e) {
      presentAlert({
        header: 'Capture',
        message: e instanceof Error ? e.message : String(e),
        buttons: ['OK'],
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [analyzeStillUri, isIdentity, mode.title, presentAlert]);

  const onGallery = useCallback(async () => {
    if (isIdentity || busyRef.current || confirmingRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const uri = await pickGalleryPhoto();
      await analyzeStillUri(uri);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes('cancel')) {
        presentAlert({ header: 'Gallery', message: msg, buttons: ['OK'] });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [analyzeStillUri, isIdentity, presentAlert]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureCameraPermission();
        const [loadedApp, people] = await Promise.all([
          loadSettings(),
          loadPeople(),
        ]);
        if (cancelled) return;
        const captureSettings = toCaptureSettings(loadedApp);
        settingsRef.current = captureSettings;
        appSettingsRef.current = loadedApp;
        peopleRef.current = people;
        setAppSettings(loadedApp);

        const session = new CaptureSession({
          settings: captureSettings,
          onState: (_state, _warn, nextBoxes, nextFrame) => {
            if (cancelled || confirmingRef.current) return;
            setBoxes(nextBoxes);
            setFrame(nextFrame);

            if (!isIdentity) return;

            const cs = settingsRef.current;
            if (!cs) return;
            const state = evaluateIdentity(nextBoxes, cs, nextFrame);
            const holdMs = Math.max(
              100,
              Math.round(
                (settingsRef.current?.identity_hold_duration ?? 0.5) * 1000
              )
            );
            const now = Date.now();
            const allowed = state === 'CAPTURE_OK';
            let progress = 0;
            let shouldCapture = false;
            if (allowed) {
              if (
                identityOkSinceMsRef.current === 0 ||
                lastIdentityStateRef.current !== 'CAPTURE_OK'
              ) {
                identityOkSinceMsRef.current = now;
              }
              const elapsed = now - identityOkSinceMsRef.current;
              progress = Math.min(1, elapsed / holdMs);
              if (elapsed >= holdMs) shouldCapture = true;
            } else {
              identityOkSinceMsRef.current = 0;
              progress = 1;
            }
            lastIdentityStateRef.current = state;
            setIdentityState(state);
            setIdentityProgress(progress);

            if (shouldCapture && !confirmingRef.current) {
              confirmingRef.current = true;
              setIdentityCapturing(true);
              setIdentityProgress(1);
              void (async () => {
                try {
                  const exported = await exportLastLiveFrame();
                  const uri = exported.uri;
                  if (!uri) {
                    confirmingRef.current = false;
                    identityOkSinceMsRef.current = 0;
                    setIdentityCapturing(false);
                    return;
                  }
                  await stopSession();
                  await finishIdentity(uri, nextBoxes[0] ?? null);
                } catch (e) {
                  confirmingRef.current = false;
                  identityOkSinceMsRef.current = 0;
                  setIdentityCapturing(false);
                  presentAlert({
                    header: 'Identity',
                    message: e instanceof Error ? e.message : String(e),
                    buttons: ['OK'],
                  });
                }
              })();
            }
          },
          onCaptured: () => undefined,
        });
        sessionRef.current = session;
        setMirror(session.overlayMirror);
        await session.start();
      } catch (e) {
        presentAlert({
          header: mode.title,
          message: e instanceof Error ? e.message : String(e),
          buttons: ['OK'],
        });
      }
    })();
    return () => {
      cancelled = true;
      void sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, [finishIdentity, isIdentity, mode.title, presentAlert, stopSession]);

  const hintText = isIdentity
    ? identityCapturing
      ? 'Capturing…'
      : identityHintText(identityState)
    : stillHint;
  const hintColor = isIdentity
    ? identityCapturing
      ? '#15803D'
      : identityHintColor(identityState)
    : '#f4fffc';

  return (
    <IonPage className="live-page">
      <div className="live-stage" ref={stageRef}>
        {isIdentity ? (
          <IdentityGuide
            width={size.w}
            height={size.h}
            frame={frame}
            mirror={mirror}
            state={identityCapturing ? 'CAPTURE_OK' : identityState}
            progress={identityProgress}
          />
        ) : appSettings ? (
          <FaceOverlay
            width={size.w}
            height={size.h}
            frameW={frame.w}
            frameH={frame.h}
            mirror={mirror}
            boxes={boxes}
            settings={appSettings}
          />
        ) : null}

        <div className="mode-cam-top">
          <button
            type="button"
            className="mode-cam-btn"
            onClick={() => {
              void stopSession();
              goHome(history);
            }}
          >
            ←
          </button>
          <div className="mode-cam-title">{title}</div>
          <div style={{ width: 28 }} />
        </div>

        <div
          className={`mode-cam-hint${isIdentity ? ' identity-chip' : ''}`}
          style={{ color: isIdentity ? hintColor : undefined }}
        >
          {hintText}
        </div>

        {!isIdentity ? (
          <div className="mode-cam-actions">
            <button
              type="button"
              className="mode-cam-action"
              disabled={busy}
              onClick={() => void onGallery()}
            >
              Gallery
            </button>
            <button
              type="button"
              className="mode-cam-shutter"
              disabled={busy}
              onClick={() => void onShutter()}
            >
              {busy ? 'Working…' : 'Capture'}
            </button>
            {mode.id === 'MATCH' && hasOdd ? (
              <button
                type="button"
                className="mode-cam-action"
                onClick={() => {
                  oddUri.current = null;
                  setHasOdd(false);
                }}
              >
                Reset
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </IonPage>
  );
}
