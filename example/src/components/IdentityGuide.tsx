import { useEffect, useMemo, useRef, useState } from 'react';
import {
  mapRoiToView,
  type CaptureState,
} from 'face-recognition-capacitor';

type Props = {
  width: number;
  height: number;
  frame: { w: number; h: number };
  mirror: boolean;
  state: CaptureState;
  progress: number;
};

const COLOR_OK = '#15803D';
const COLOR_ACCENT = '#0F766E';
const COLOR_DANGER = '#B91C1C';
const COLOR_WARN = '#B45309';
const SCRIM = 'rgba(15, 26, 34, 0.4)';
const TICK_BASE = 'rgba(255, 255, 255, 0.53)';

export function identityHintText(state: CaptureState): string {
  switch (state) {
    case 'NO_FACE':
      return 'Center your face in the circle';
    case 'MULTIPLE_FACES':
      return 'One face only';
    case 'FIT_IN_CIRCLE':
      return 'Fit in circle';
    case 'MOVE_CLOSER':
      return 'Move closer';
    case 'NO_FRONT':
      return 'Face the camera';
    case 'FACE_OCCLUDED':
      return 'Remove obstruction';
    case 'EYE_CLOSED':
      return 'Open your eyes';
    case 'SPOOFED_FACE':
      return 'Live face required';
    case 'CAPTURE_OK':
      return 'Hold still';
    default:
      return 'Center your face in the circle';
  }
}

export function identityHintColor(state: CaptureState): string {
  switch (state) {
    case 'CAPTURE_OK':
      return COLOR_OK;
    case 'NO_FACE':
      return '#141A22';
    case 'MULTIPLE_FACES':
    case 'FACE_OCCLUDED':
    case 'SPOOFED_FACE':
      return COLOR_DANGER;
    default:
      return COLOR_WARN;
  }
}

function ringColorFor(state: CaptureState): string {
  switch (state) {
    case 'CAPTURE_OK':
      return COLOR_OK;
    case 'NO_FACE':
      return COLOR_ACCENT;
    case 'MULTIPLE_FACES':
    case 'FACE_OCCLUDED':
    case 'SPOOFED_FACE':
      return COLOR_DANGER;
    default:
      return COLOR_WARN;
  }
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return hex;
}

/**
 * Identity capture guide: scrim, corner brackets, tick ring, flowing progress.
 * Red when blocked; green flow while holding for capture (Android IdentityGuideView).
 */
export default function IdentityGuide({
  width,
  height,
  frame,
  mirror,
  state,
  progress,
}: Props) {
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [pulse, setPulse] = useState(0);
  const [spin, setSpin] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    let start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      // 1400ms reverse pulse ≈ triangle wave
      const cycle = (t % 2.8) / 1.4;
      const p = cycle <= 1 ? cycle : 2 - cycle;
      setPulse(p * p); // decelerate-ish
      setSpin((t * 360) / 4.8);
      setDisplayProgress((prev) => prev + (progressRef.current - prev) * 0.22);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const safeFrame = frame.w > 0 && frame.h > 0 ? frame : { w: 720, h: 1280 };
  const roi = useMemo(() => {
    const mapped = mapRoiToView(safeFrame, width, height);
    if (!mirror) return mapped;
    // Centered square is unchanged by mirror; keep flip for non-centered ROIs.
    const left = width - mapped.right;
    const right = width - mapped.left;
    return {
      ...mapped,
      left,
      right,
      centerX: (left + right) / 2,
    };
  }, [safeFrame.w, safeFrame.h, width, height, mirror]);

  if (width <= 0 || height <= 0) return null;

  const searching = state === 'NO_FACE';
  const allowed = state === 'CAPTURE_OK';
  const baseR = Math.min(roi.width, roi.height) / 2;
  const pulseScale = searching
    ? 1 + 0.035 * pulse
    : !allowed
      ? 1 + 0.012 * pulse
      : 1;
  const radius = baseR * pulseScale;
  const cx = roi.centerX;
  const cy = roi.centerY;
  const ringColor = ringColorFor(state);
  const trackAlpha = allowed ? 90 / 255 : 140 / 255;
  const glowAlpha = Math.min(120, 55 + 50 * displayProgress) / 255;
  const progressAngle = allowed ? 360 * displayProgress : 360;
  const maskId = `ig-mask-${Math.round(cx)}-${Math.round(cy)}`;

  const ticks = Array.from({ length: 36 }, (_, i) => {
    const deg = (i * (360 / 36) + spin * 0.15) * (Math.PI / 180);
    const cos = Math.cos(deg);
    const sin = Math.sin(deg);
    const major = i % 3 === 0;
    const inner = radius + (major ? 4 : 2);
    const outer = radius + (major ? 12 : 7);
    return {
      x1: cx + cos * inner,
      y1: cy + sin * inner,
      x2: cx + cos * outer,
      y2: cy + sin * outer,
    };
  });

  const bracketHalf = radius * (1.08 + 0.04 * pulse);
  const bracketLen = bracketHalf * 0.28;
  const bracketInset = bracketHalf * 0.72;
  const corners: Array<[number, number, number, number]> = [
    [-1, -1, 1, 1],
    [1, -1, -1, 1],
    [-1, 1, 1, -1],
    [1, 1, -1, -1],
  ];

  return (
    <div className="identity-guide" style={{ width, height }}>
      <svg width={width} height={height}>
        <defs>
          <mask id={maskId}>
            <rect x={0} y={0} width={width} height={height} fill="#fff" />
            <circle cx={cx} cy={cy} r={radius} fill="#000" />
          </mask>
        </defs>
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={SCRIM}
          mask={`url(#${maskId})`}
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={withAlpha(ringColor, trackAlpha)}
          strokeWidth={3}
        />
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={withAlpha(ringColor, 160 / 255) || TICK_BASE}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
        {!allowed || searching ? (
          <>
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={withAlpha(ringColor, 180 / 255)}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${(54 / 360) * 2 * Math.PI * radius} ${2 * Math.PI * radius}`}
              transform={`rotate(${spin} ${cx} ${cy})`}
            />
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={withAlpha(ringColor, 90 / 255)}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${(40 / 360) * 2 * Math.PI * radius} ${2 * Math.PI * radius}`}
              transform={`rotate(${spin + 180} ${cx} ${cy})`}
            />
          </>
        ) : null}
        {searching
          ? corners.map(([ox, oy, sx, sy], i) => {
              const bx = cx + ox * bracketInset;
              const by = cy + oy * bracketInset;
              return (
                <path
                  key={`b-${i}`}
                  d={`M ${bx} ${by + sy * bracketLen} L ${bx} ${by} L ${bx + sx * bracketLen} ${by}`}
                  fill="none"
                  stroke={withAlpha(ringColor, 220 / 255)}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })
          : null}
        {allowed ? (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={withAlpha(ringColor, glowAlpha)}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${(progressAngle / 360) * 2 * Math.PI * radius} ${2 * Math.PI * radius}`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ) : null}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${(progressAngle / 360) * 2 * Math.PI * radius} ${2 * Math.PI * radius}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
    </div>
  );
}
