/**
 * Demo modes — Cordova edition of Android FaceMode.
 */
export type FaceModeId =
  | 'FACE_DETECT'
  | 'FACE_ATTRIBUTE'
  | 'IMAGE_QUALITY'
  | 'LANDMARKS'
  | 'MATCH'
  | 'LIVENESS'
  | 'ENROLL'
  | 'IDENTITY'
  | 'ENROLLED_LIST';

export type FaceModeMeta = {
  id: FaceModeId;
  title: string;
  needsRecognition: boolean;
  needsLiveness: boolean;
};

export const FACE_MODES: Record<FaceModeId, FaceModeMeta> = {
  FACE_DETECT: {
    id: 'FACE_DETECT',
    title: 'Face detect',
    needsRecognition: true,
    needsLiveness: false,
  },
  FACE_ATTRIBUTE: {
    id: 'FACE_ATTRIBUTE',
    title: 'Face attribute',
    needsRecognition: true,
    needsLiveness: false,
  },
  IMAGE_QUALITY: {
    id: 'IMAGE_QUALITY',
    title: 'Image quality',
    needsRecognition: true,
    needsLiveness: false,
  },
  LANDMARKS: {
    id: 'LANDMARKS',
    title: 'Landmarks',
    needsRecognition: true,
    needsLiveness: false,
  },
  MATCH: {
    id: 'MATCH',
    title: 'Match',
    needsRecognition: true,
    needsLiveness: false,
  },
  LIVENESS: {
    id: 'LIVENESS',
    title: 'Liveness',
    needsRecognition: false,
    needsLiveness: true,
  },
  ENROLL: {
    id: 'ENROLL',
    title: 'Enroll',
    needsRecognition: true,
    needsLiveness: false,
  },
  IDENTITY: {
    id: 'IDENTITY',
    title: 'Identity',
    needsRecognition: true,
    needsLiveness: false,
  },
  ENROLLED_LIST: {
    id: 'ENROLLED_LIST',
    title: 'Enrolled list',
    needsRecognition: true,
    needsLiveness: false,
  },
};
