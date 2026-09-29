import { useEffect, useMemo, useState } from 'react';

type Point = { x: number; y: number };

type Props = {
  uri: string | null | undefined;
  landmarks: Point[];
  imageSize?: { w: number; h: number };
  width: number;
  height: number;
};

/** Cap-compatible overlay: landmarks in image pixel space, img object-fit contain. */
export default function LandmarkImage({
  uri,
  landmarks,
  imageSize,
  width,
  height,
}: Props) {
  const [nat, setNat] = useState(imageSize ?? { w: 0, h: 0 });

  useEffect(() => {
    if (imageSize && imageSize.w > 0 && imageSize.h > 0) {
      setNat(imageSize);
    }
  }, [imageSize]);

  const space = useMemo(() => {
    if (nat.w > 0 && nat.h > 0) return nat;
    if (imageSize && imageSize.w > 0 && imageSize.h > 0) return imageSize;
    return { w: 200, h: 200 };
  }, [nat, imageSize]);

  const mapped = useMemo(() => {
    if (!landmarks.length || space.w <= 0 || space.h <= 0) return [];
    const scale = Math.min(width / space.w, height / space.h);
    const dx = (width - space.w * scale) / 2;
    const dy = (height - space.h * scale) / 2;
    return landmarks.map((p) => ({
      x: p.x * scale + dx,
      y: p.y * scale + dy,
    }));
  }, [landmarks, space, width, height]);

  return (
    <div className="landmark-image" style={{ width, height }}>
      {uri ? (
        <img
          alt=""
          src={uri}
          onLoad={(e) => {
            const el = e.currentTarget;
            if (el.naturalWidth > 0 && el.naturalHeight > 0) {
              setNat({ w: el.naturalWidth, h: el.naturalHeight });
            }
          }}
        />
      ) : null}
      {mapped.map((pt, i) => (
        <div key={i} className="landmark-dot" style={{ left: pt.x - 4, top: pt.y - 4 }}>
          <span>{i + 1}</span>
        </div>
      ))}
    </div>
  );
}
