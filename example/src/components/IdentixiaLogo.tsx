import facePluginLogo from '../assets/ic_identixia.png';

type Props = {
  size?: number;
  className?: string;
};

/** Company mark — same asset as FaceRecognition Android / RN (`ic_identixia.png`). */
export default function IdentixiaLogo({ className }: Props) {
  return (
    <div className={`logo-wrap ${className ?? ''}`.trim()}>
      <a href="https://identixia.com" target="_blank" rel="noreferrer">
        <img alt="Identixia" src={facePluginLogo} className="identixia-logo" />
      </a>
    </div>
  );
}
