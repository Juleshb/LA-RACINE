import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function BulletinQrCode({ value, size = 72, className = '' }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!value) {
      setDataUrl('');
      return undefined;
    }

    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) return <div className={`bulletin-qr-placeholder ${className}`} style={{ width: size, height: size }} />;

  return (
    <img
      src={dataUrl}
      alt="QR code de vérification du bulletin"
      className={`bulletin-qr-code ${className}`}
      width={size}
      height={size}
    />
  );
}
