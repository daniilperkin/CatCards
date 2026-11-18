import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo } from 'react';
import { db } from './db';

/** Object URL for a stored image (revoked automatically). */
export function useImageUrl(imageId: string | null | undefined): string | null {
  const row = useLiveQuery(() => (imageId ? db.images.get(imageId) : undefined), [imageId]);
  return useBlobUrl(row?.blob ?? null);
}

/** Object URL for an in-memory Blob (revoked automatically). */
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return url;
}
