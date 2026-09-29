import { useCallback, useState } from 'react';
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
import { goHome } from '../nav';
import {
  deletePerson,
  loadPeople,
  type EnrolledPerson,
} from '../FaceDatabase';
import { ensureCameraStopped } from '../cameraLifecycle';
import { thumbSrc } from '../pickImage';

export default function EnrolledList() {
  const history = useHistory();
  const [people, setPeople] = useState<EnrolledPerson[]>([]);

  const reload = useCallback(() => {
    void loadPeople().then(setPeople);
  }, []);

  useIonViewWillEnter(() => {
    void ensureCameraStopped();
    reload();
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => goHome(history)}>Back</IonButton>
          </IonButtons>
          <IonTitle>Enrolled list</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="person-list">
          {people.length === 0 ? (
            <div className="muted empty-hint">No enrolled faces yet.</div>
          ) : (
            people.map((p) => (
              <div key={p.id} className="person-card">
                {p.thumbB64 ? (
                  <img alt={p.name} src={thumbSrc(p.thumbB64)} className="person-thumb" />
                ) : (
                  <div className="person-thumb empty" />
                )}
                <div className="person-name">{p.name}</div>
                <button
                  type="button"
                  className="person-delete"
                  onClick={() => void deletePerson(p.id).then(reload)}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
