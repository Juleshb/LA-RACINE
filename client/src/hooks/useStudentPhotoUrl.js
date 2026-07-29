import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useStudentPhotoUrl(enabled = true) {
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setPhotoUrl(null);
      return undefined;
    }

    let objectUrl = null;
    let cancelled = false;

    api.getMyStudentPhotoUrl()
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setPhotoUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPhotoUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled]);

  return photoUrl;
}
