/**
 * Official school seal + director signature for soft bulletins (PDF/screen).
 */
export default function BulletinDirectorStamp({
  className = '',
  showLabel = true,
  compact = false,
}) {
  return (
    <div className={`bulletin-director-stamp ${compact ? 'is-compact' : ''} ${className}`.trim()}>
      <div className="bulletin-director-stamp-art" aria-hidden="true">
        <img
          src="/bulletin/sceau-directeur.png"
          alt=""
          className="bulletin-sceau"
          width={1515}
          height={1440}
          decoding="async"
        />
        <img
          src="/bulletin/signature-directeur.png"
          alt=""
          className="bulletin-directeur-signature"
          width={1359}
          height={456}
          decoding="async"
        />
      </div>
      {showLabel && <p className="bulletin-directeur-label">Le Directeur</p>}
    </div>
  );
}
