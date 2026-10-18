import { useEffect, useState } from 'react';
import { useE2EE } from './E2EEContext';

/**
 * Browser URLs for the files of one or more messages.
 * Plain messages resolve immediately; encrypted ones are downloaded and decrypted in the
 * background. Returns one { src, state } per message, state: 'ready' | 'loading' | 'error'.
 */
export function useMessageFiles(msgs) {
  const { service, version } = useE2EE();
  const [results, setResults] = useState({});
  const sig = msgs.map((m) => `${m.id}|${m.fileUrl || ''}|${m.mediaNonce || ''}`).join(',');

  useEffect(() => {
    let alive = true;
    msgs.forEach((m) => {
      if (!m.fileUrl || !m.mediaNonce) return;
      const k = `${m.fileUrl}|${m.mediaNonce || ''}`;
      service.mediaUrl(m).then(
        (src) => alive && setResults((r) => (r[k]?.src === src ? r : { ...r, [k]: { src, state: 'ready' } })),
        () => alive && setResults((r) => ({ ...r, [k]: { src: null, state: 'error' } }))
      );
    });
    return () => { alive = false; };
  }, [sig, service, version]);

  return msgs.map((m) => {
    if (!m.fileUrl) return { src: null, state: 'ready' };
    if (!m.mediaNonce) return { src: service.plainFileUrl(m), state: 'ready' }; // not encrypted: no waiting
    return results[`${m.fileUrl}|${m.mediaNonce || ''}`] || { src: null, state: 'loading' };
  });
}
