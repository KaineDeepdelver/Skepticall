import React, { useState, useEffect, useRef } from 'react';
import { linkPreviewApi } from '../services/api';

// Simple in-memory cache so the same URL isn't fetched multiple times
const cache = {};

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;

export function extractFirstUrl(text) {
  if (!text) return null;
  const m = text.match(URL_REGEX);
  if (!m) return null;
  const url = m[0];
  try {
    const { hostname } = new URL(url);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
  } catch { return null; }
  return url;
}

export default function LinkPreview({ url, isSent }) {
  const [data, setData] = useState(cache[url] || null);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!url) return;
    if (cache[url]) { setData(cache[url]); return; }
    if (cache[url] === false) { setFailed(true); return; }

    linkPreviewApi.fetch(url)
      .then(d => {
        if (!mounted.current) return;
        if (d && d.title) {
          cache[url] = d;
          setData(d);
        } else {
          cache[url] = false;
          setFailed(true);
        }
      })
      .catch(() => {
        cache[url] = false;
        if (mounted.current) setFailed(true);
      });
  }, [url]);

  if (!url || failed || !data) return null;

  const domain = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url; }
  })();

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={e => e.stopPropagation()}
      style={{
        display: 'block',
        textDecoration: 'none',
        marginTop: 6,
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: isSent ? 'rgba(0,0,0,0.15)' : 'var(--bg-hover)',
        transition: 'opacity 0.15s',
        maxWidth: 320,
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {/* Image */}
      {data.image && (
        <div style={{ width: '100%', height: 140, overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={data.image}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.target.parentNode.style.display = 'none'; }}
          />
        </div>
      )}

      {/* Text content */}
      <div style={{ padding: '9px 12px 10px' }}>
        {/* Domain */}
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: isSent ? 'rgba(255,255,255,0.55)' : 'var(--accent)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}>
          {/* Favicon */}
          <img
            src={`https://www.google.com/s2/favicons?sz=16&domain=${domain}`}
            alt=""
            width={12}
            height={12}
            style={{ borderRadius: 2, flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          {data.siteName || domain}
        </div>

        {/* Title */}
        {data.title && (
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: isSent ? '#fff' : 'var(--text-primary)',
            lineHeight: 1.3,
            marginBottom: data.description ? 3 : 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {data.title}
          </div>
        )}

        {/* Description */}
        {data.description && (
          <div style={{
            fontSize: 12,
            color: isSent ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {data.description}
          </div>
        )}
      </div>
    </a>
  );
}
