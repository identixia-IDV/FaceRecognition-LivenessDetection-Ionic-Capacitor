import { stopLivePreview, stopVideoWorker } from 'face-recognition-capacitor';

/** Ensure native preview is stopped when leaving Identify/Capture (Ion keeps pages mounted). */
export async function ensureCameraStopped(): Promise<void> {
  try {
    await stopLivePreview();
  } catch {
    /* already stopped / not started */
  }
  try {
    await stopVideoWorker();
  } catch {
    /* worker may already be stopped */
  }
}
