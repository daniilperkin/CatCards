import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from './db';

/** Object URL for a stored image (revoked automatically). */
export function useImageUrl(imageId: string | null | undefined): string | null {
  const row = useLiveQuery(() => (imageId ? db.images.get(imageId) : undefined), [imageId]);
  return useBlobUrl(row?.blob ?? null);
}

/** Object URL for an in-memory Blob (revoked automatically, StrictMode-safe). */
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
