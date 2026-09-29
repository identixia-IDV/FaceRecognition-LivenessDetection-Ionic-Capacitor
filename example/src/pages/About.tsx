import { useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { getLicenseStatus, parseLicenseStatus } from 'face-recognition-capacitor';
import { goHome } from '../nav';

export default function About() {
  const history = useHistory();
  const [licenseText, setLicenseText] = useState('License: …');

  useIonViewWillEnter(() => {
    getLicenseStatus()
      .then((json) => setLicenseText(`License: ${parseLicenseStatus(json).label}`))
      .catch(() => setLicenseText('License: No license'));
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => goHome(history)}>Back</IonButton>
          </IonButtons>
          <IonTitle>About</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <h1 className="page-title">Identixia</h1>
        <div className="product-sub">Face Recognition SDK</div>
        <div className="about-license">{licenseText}</div>
        <div className="about-card">
          Identixia builds on-device identity technology — face recognition,
          liveness, and document reading — so biometric data never has to leave
          the phone.
        </div>
        <div className="about-card">
          This app demos the Face Recognition SDK for Ionic Capacitor: enroll,
          identify, capture, and attribute analysis. Everything runs fully
          on-premise.
        </div>
        <p className="about-link">
          <a href="https://identixia.com" target="_blank" rel="noreferrer">
            identixia.com
          </a>
        </p>
        <p className="muted" style={{ textAlign: 'center' }}>
          © 2026 Identixia. All rights reserved.
        </p>
      </IonContent>
    </IonPage>
  );
}
