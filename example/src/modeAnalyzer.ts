import {
  faceAttribute,
  faceDetect,
  extractFeature,
  imageQuality,
  landmarks,
  livenessAll,
  match,
} from 'face-recognition-capacitor';
import type { FaceModeId } from './FaceMode';

/** Mirrors Android ModeAnalyzer. */
export async function analyzeMode(
  mode: FaceModeId,
  uri: string,
  oddUri?: string | null,
  landmarkMode: number = 68
): Promise<string | null> {
  switch (mode) {
    case 'FACE_DETECT':
      return faceDetect(uri, false);
    case 'FACE_ATTRIBUTE':
      return faceAttribute(uri, false);
    case 'IMAGE_QUALITY':
      return imageQuality(uri, false);
    case 'LANDMARKS':
      return landmarks(uri, landmarkMode);
    case 'MATCH': {
      if (!oddUri) return null;
      return match(oddUri, uri, false);
    }
    case 'LIVENESS':
      return livenessAll(uri);
    case 'ENROLL':
      return extractFeature(uri);
    case 'IDENTITY':
    case 'ENROLLED_LIST':
      return faceDetect(uri, false);
    default:
      return faceDetect(uri, false);
  }
}
