import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonPage,
  useIonAlert,
} from '@ionic/react';
import { useSdk } from '../SdkContext';
import { FACE_MODES, type FaceModeId, type FaceModeMeta } from '../FaceMode';
import TileIcon, { type TileIconName } from '../components/TileIcons';

function ModeCell({
  title,
  icon,
  disabled,
  onPress,
  accent,
  large,
}: {
  title: string;
  icon: TileIconName;
  disabled?: boolean;
  onPress: () => void;
  accent?: boolean;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      className={`mode-cell ${accent ? 'accent' : ''} ${disabled ? 'disabled' : ''}`}
      disabled={disabled}
      onClick={onPress}
    >
      <TileIcon
        name={icon}
        size={large ? 36 : 28}
        color={accent ? '#F4FFFC' : '#0F766E'}
      />
      <span className="mode-cell-label">{title}</span>
    </button>
  );
}

const ATTR_ROW1: { id: FaceModeId; icon: TileIconName }[] = [
  { id: 'FACE_DETECT', icon: 'detect' },
  { id: 'FACE_ATTRIBUTE', icon: 'attribute' },
  { id: 'IMAGE_QUALITY', icon: 'quality' },
];
const ATTR_ROW2: { id: FaceModeId; icon: TileIconName }[] = [
  { id: 'LANDMARKS', icon: 'landmarks' },
  { id: 'MATCH', icon: 'match' },
  { id: 'LIVENESS', icon: 'liveness' },
];

export default function Home() {
  const { status, ready, loading, license, licenseLabel } = useSdk();
  const history = useHistory();
  const [presentAlert] = useIonAlert();

  const ensureReady = (mode: FaceModeMeta): boolean => {
    if (!ready) {
      presentAlert({
        header: 'SDK is not ready',
        message: loading ? 'Starting SDK…' : status,
        buttons: ['OK'],
      });
      return false;
    }
    if (mode.needsRecognition && !license.recognition) {
      presentAlert({
        header: 'License',
        message: 'This license does not include recognition',
        buttons: ['OK'],
      });
      return false;
    }
    if (mode.needsLiveness && !license.liveness) {
      presentAlert({
        header: 'License',
        message: 'This license does not include liveness',
        buttons: ['OK'],
      });
      return false;
    }
    return true;
  };

  const openMode = (id: FaceModeId) => {
    const mode = FACE_MODES[id];
    if (!ensureReady(mode)) return;
    if (id === 'IDENTITY') {
      history.push('/mode/IDENTITY');
      return;
    }
    if (id === 'ENROLL') {
      history.push('/mode/ENROLL');
      return;
    }
    if (id === 'ENROLLED_LIST') {
      history.push('/enrolled');
      return;
    }
    history.push(`/mode/${id}`);
  };

  return (
    <IonPage>
      <IonContent className="home-content" fullscreen>
        <div className="home-scroll">
          <div className="chip-row">
            <div className="chip chip-flex">
              License · {licenseLabel || status}
            </div>
            <div className={`chip status ${ready ? 'ok' : ''}`}>
              {ready ? 'Ready' : loading ? 'Loading…' : 'No license'}
            </div>
          </div>

          <div className="section-label">Attribute & Liveness</div>
          <div className="attr-panel">
            <div className="attr-row">
              {ATTR_ROW1.map((item) => (
                <ModeCell
                  key={item.id}
                  title={FACE_MODES[item.id].title}
                  icon={item.icon}
                  disabled={!ready}
                  onPress={() => openMode(item.id)}
                />
              ))}
            </div>
            <div className="attr-row">
              {ATTR_ROW2.map((item) => (
                <ModeCell
                  key={item.id}
                  title={FACE_MODES[item.id].title}
                  icon={item.icon}
                  disabled={!ready}
                  onPress={() => openMode(item.id)}
                />
              ))}
            </div>
          </div>

          <div className="section-label">Identity</div>
          <div className="identity-row">
            <ModeCell
              title="Enroll"
              icon="enroll"
              large
              disabled={!ready}
              onPress={() => openMode('ENROLL')}
            />
            <ModeCell
              title="Identity"
              icon="identify"
              large
              accent
              disabled={!ready}
              onPress={() => openMode('IDENTITY')}
            />
            <ModeCell
              title="Enrolled list"
              icon="people"
              large
              disabled={!ready}
              onPress={() => openMode('ENROLLED_LIST')}
            />
          </div>

          <div className="footer-row">
            <ModeCell
              title="Settings"
              icon="settings"
              large
              onPress={() => history.push('/settings')}
            />
            <ModeCell
              title="About"
              icon="about"
              large
              onPress={() => history.push('/about')}
            />
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
