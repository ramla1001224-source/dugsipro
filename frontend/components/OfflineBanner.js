/**
 * OfflineBanner.js — Global offline status bar
 *
 * States:
 *  🔴 Offline  – red bar, shows pending count
 *  🟡 Syncing  – amber bar with spinner
 *  🟢 Success  – green flash for 3 s when back online
 *  (hidden)    – no bar when fully online & synced
 */
import { useEffect, useRef, useState } from 'react';
import { useOffline } from '../utils/useOffline';

export default function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
  const [visible, setVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const prevOnline = useRef(isOnline);
  const successTimer = useRef(null);

  useEffect(() => {
    const wasOffline = !prevOnline.current;
    prevOnline.current = isOnline;

    if (!isOnline || isSyncing) {
      setVisible(true);
      setShowSuccess(false);
      clearTimeout(successTimer.current);
      return;
    }

    if (isOnline && wasOffline) {
      // Came back online — flash success
      setShowSuccess(true);
      setVisible(true);
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => {
        setShowSuccess(false);
        setVisible(false);
      }, 3000);
      return;
    }

    if (isOnline && !isSyncing && !showSuccess) {
      setVisible(false);
    }
  }, [isOnline, isSyncing, showSuccess]);

  if (!visible) return null;

  /* ── Colour / content based on state ── */
  let bg, text, border, dot, label, showSpinner;

  if (!isOnline) {
    bg     = 'rgba(220,38,38,0.92)';
    border = 'rgba(220,38,38,0.25)';
    text   = '#fff';
    dot    = '#fca5a5';
    label  = pendingCount > 0
      ? `Offline · ${pendingCount} change${pendingCount > 1 ? 's' : ''} queued`
      : 'Offline — No internet connection';
    showSpinner = false;
  } else if (isSyncing) {
    bg     = 'rgba(217,119,6,0.92)';
    border = 'rgba(217,119,6,0.25)';
    text   = '#fff';
    dot    = '#fde68a';
    label  = 'Syncing changes to server…';
    showSpinner = true;
  } else {
    // success flash
    bg     = 'rgba(5,150,105,0.92)';
    border = 'rgba(5,150,105,0.25)';
    text   = '#fff';
    dot    = '#6ee7b7';
    label  = 'Back online · All changes synced ✓';
    showSpinner = false;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: bg,
        borderBottom: `1px solid ${border}`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '9px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        animation: 'slideDown .3s cubic-bezier(.22,.68,0,1.2)',
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>

      {/* Status indicator */}
      {showSpinner ? (
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke={dot} strokeWidth="3"
          style={{ animation: 'spin .9s linear infinite', flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
        </svg>
      ) : (
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: dot, flexShrink: 0,
          animation: !isOnline ? 'blink 1.2s ease-in-out infinite' : 'none',
        }}/>
      )}

      {/* Label */}
      <span style={{
        color: text,
        fontSize: '0.78rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        lineHeight: 1.3,
      }}>
        {label}
      </span>

      {/* Manual retry button (only offline + no spinner) */}
      {!isOnline && !showSpinner && (
        <button
          onClick={syncNow}
          style={{
            marginLeft: 8,
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: text,
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 999,
            cursor: 'pointer',
            letterSpacing: '0.04em',
            transition: 'background .15s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
        >
          Retry
        </button>
      )}
    </div>
  );
}
