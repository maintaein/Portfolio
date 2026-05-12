import { useState } from 'react';

export function useCopyToClipboard(resetDelay = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (text: string, key = 'default') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), resetDelay);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return { copiedKey, copy };
}
