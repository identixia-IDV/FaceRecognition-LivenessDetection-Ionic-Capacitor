import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getMachineCode,
  getLicenseStatus,
  init,
  lastLicenseError,
  parseLicenseStatus,
  readyStatusMessage,
  setActivation,
  writeStatus,
  SDK_SUCCESS,
  NOT_LICENSED,
  type LicenseStatus,
} from 'face-recognition-capacitor';
import { demoLicense } from './license';
import { whenDeviceReady } from './deviceReady';

export type SdkState = {
  status: string;
  ready: boolean;
  loading: boolean;
  machine: string;
  license: LicenseStatus;
  licenseLabel: string;
  refresh: () => void;
};

const SdkContext = createContext<SdkState | null>(null);

function statusLabel(code: number): string {
  switch (code) {
    case 0:
      return 'Ready';
    case 1:
      return 'Invalid license';
    case 2:
      return 'License expired';
    case 3:
      return 'License not activated';
    case 4:
      return 'Engine failed to start';
    default:
      return `Failed (${code})`;
  }
}

export function SdkProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState('Starting SDK…');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [machine, setMachine] = useState('');
  const [license, setLicense] = useState<LicenseStatus>(NOT_LICENSED);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setStatus('Starting SDK…');
        setReady(false);
        setLicense(NOT_LICENSED);
        await whenDeviceReady();
        if (cancelled) return;
        const licenseKey = demoLicense().trim();
        if (!licenseKey) {
          if (!cancelled) {
            setStatus('No license key');
            setReady(false);
            setLoading(false);
          }
          return;
        }
        const mc = await getMachineCode();
        console.log('[FaceRecognition] machine=', mc);
        if (!cancelled) setMachine(mc);
        const act = await setActivation(licenseKey);
        console.log('[FaceRecognition] setActivation=', act);
        if (act !== SDK_SUCCESS) {
          const detail = await lastLicenseError();
          console.log('[FaceRecognition] license error=', detail);
          if (!cancelled) {
            setStatus(`${statusLabel(act)}${detail ? `: ${detail}` : ''}`);
            setReady(false);
            setLoading(false);
          }
          return;
        }
        const code = await init();
        console.log('[FaceRecognition] init=', code);
        if (cancelled) return;
        if (code !== SDK_SUCCESS) {
          setStatus(statusLabel(code));
          setReady(false);
          setLoading(false);
          return;
        }
        // Real product flags from native (recognition-only / liveness-only / full).
        let parsed: LicenseStatus = NOT_LICENSED;
        try {
          const json = await getLicenseStatus();
          parsed = parseLicenseStatus(json);
        } catch (e) {
          console.log('[FaceRecognition] getLicenseStatus failed', e);
        }
        if (cancelled) return;
        setLicense(parsed);
        setReady(true);
        setStatus(readyStatusMessage(parsed.label || 'Ready'));
        setLoading(false);
        try {
          await writeStatus({
            step: 'js',
            status: 'Ready',
            ready: true,
            machine: mc,
            code,
          });
        } catch {
          // ignore debug write failures
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log('[FaceRecognition] init exception=', msg);
        if (!cancelled) {
          setStatus(`Init error: ${msg}`);
          setReady(false);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const value = useMemo(
    () => ({
      status,
      ready,
      loading,
      machine,
      license,
      licenseLabel: license.label || 'No license',
      refresh,
    }),
    [status, ready, loading, machine, license, refresh]
  );

  return <SdkContext.Provider value={value}>{children}</SdkContext.Provider>;
}

export function useSdk(): SdkState {
  const ctx = useContext(SdkContext);
  if (!ctx) throw new Error('useSdk must be used within SdkProvider');
  return ctx;
}
