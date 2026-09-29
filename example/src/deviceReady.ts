import { Capacitor } from '@capacitor/core';

/** Wait until Capacitor native bridge + FaceRecognitionSdk plugin are usable. */
export function whenDeviceReady(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    if (!Capacitor.isNativePlatform()) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const tryReady = () => {
      try {
        if (Capacitor.isPluginAvailable('FaceRecognitionSdk')) {
          finish();
          return true;
        }
      } catch {
        // bridge not ready yet
      }
      return false;
    };
    if (tryReady()) return;
    const id = window.setInterval(() => {
      if (tryReady()) window.clearInterval(id);
    }, 40);
    window.setTimeout(() => {
      window.clearInterval(id);
      finish();
    }, timeoutMs);
    document.addEventListener('deviceready', () => {
      if (tryReady()) window.clearInterval(id);
    }, { once: true });
  });
}
