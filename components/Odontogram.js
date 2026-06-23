'use client';

import React, { useState, useMemo } from 'react';
import styles from './Odontogram.module.css';

/*
 * Pure SVG Interactive Odontogram — FDI Notation
 * ───────────────────────────────────────────────
 * 32 adult teeth, each drawn as individual SVG paths
 * (crown + roots). No background image needed.
 *
 * Upper:  18 17 16 15 14 13 12 11 │ 21 22 23 24 25 26 27 28
 * Lower:  48 47 46 45 44 43 42 41 │ 31 32 33 34 35 36 37 38
 */

// ── FDI numbering ──────────────────────────────────────────
const UPPER_FDI = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER_FDI = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

// ── Column widths (shared for vertical alignment) ──────────
const COL_W = [46, 50, 52, 38, 38, 34, 30, 36, 36, 30, 34, 38, 38, 52, 50, 46];

// ── Crown / root dimensions per position ───────────────────
// ch = crown height, rh = root height, r = root count
const U = [
  {ch:30,rh:36,r:3},{ch:32,rh:42,r:3},{ch:34,rh:46,r:3},{ch:30,rh:38,r:1},
  {ch:30,rh:40,r:2},{ch:34,rh:50,r:1},{ch:32,rh:38,r:1},{ch:34,rh:40,r:1},
  {ch:34,rh:40,r:1},{ch:32,rh:38,r:1},{ch:34,rh:50,r:1},{ch:30,rh:40,r:2},
  {ch:30,rh:38,r:1},{ch:34,rh:46,r:3},{ch:32,rh:42,r:3},{ch:30,rh:36,r:3},
];
const L = [
  {ch:28,rh:32,r:2},{ch:30,rh:36,r:2},{ch:32,rh:38,r:2},{ch:28,rh:34,r:1},
  {ch:28,rh:34,r:1},{ch:32,rh:44,r:1},{ch:28,rh:34,r:1},{ch:26,rh:32,r:1},
  {ch:26,rh:32,r:1},{ch:28,rh:34,r:1},{ch:32,rh:44,r:1},{ch:28,rh:34,r:1},
  {ch:28,rh:34,r:1},{ch:32,rh:38,r:2},{ch:30,rh:36,r:2},{ch:28,rh:32,r:2},
];

// ── Layout constants ───────────────────────────────────────
const VB_W = 960, VB_H = 380;
const GAP = 3, MID_GAP = 10;
const U_BASE = 210;   // occlusal (biting) edge of upper teeth
const L_BASE = 250;   // occlusal (biting) edge of lower teeth

// ── Pre-compute X centers ──────────────────────────────────
const xC = (() => {
  const total = COL_W.reduce((s, w) => s + w, 0) + 14 * GAP + MID_GAP;
  let x = (VB_W - total) / 2;
  return COL_W.map((w, i) => {
    const c = x + w / 2;
    x += w + (i === 7 ? MID_GAP : GAP);
    return c;
  });
})();

// ── SVG path generators ────────────────────────────────────

/** Rounded-rect crown */
function mkCrown(cx, w, base, ch, up) {
  const hw = w / 2, r = 3;
  const y1 = up ? base - ch : base;
  const y2 = up ? base : base + ch;
  return [
    `M${cx - hw + r},${y1}`,
    `L${cx + hw - r},${y1}`,
    `Q${cx + hw},${y1},${cx + hw},${y1 + r}`,
    `L${cx + hw},${y2 - r}`,
    `Q${cx + hw},${y2},${cx + hw - r},${y2}`,
    `L${cx - hw + r},${y2}`,
    `Q${cx - hw},${y2},${cx - hw},${y2 - r}`,
    `L${cx - hw},${y1 + r}`,
    `Q${cx - hw},${y1},${cx - hw + r},${y1}`,
    'Z',
  ].join(' ');
}

/** Single tapered root using quadratic bezier */
function mkOneRoot(cx, bw, cy, rh, offset, up) {
  const d = up ? -1 : 1;
  const tip = cy + d * rh;
  const mid = cy + d * rh * 0.55;
  const rc = cx + offset;
  return `M${rc - bw},${cy} Q${rc - bw * 0.3},${mid},${rc},${tip} Q${rc + bw * 0.3},${mid},${rc + bw},${cy}`;
}

/** Generate all roots for a tooth */
function mkRoots(cx, w, cy, rh, n, up) {
  const hw = w / 2;
  if (n === 1) {
    return [mkOneRoot(cx, hw * 0.35, cy, rh, 0, up)];
  }
  if (n === 2) {
    const s = hw * 0.25;
    return [
      mkOneRoot(cx, hw * 0.25, cy, rh, -s, up),
      mkOneRoot(cx, hw * 0.25, cy, rh * 0.92, s, up),
    ];
  }
  // 3 roots (upper molars)
  const s = hw * 0.32;
  return [
    mkOneRoot(cx, hw * 0.18, cy, rh, -s, up),
    mkOneRoot(cx, hw * 0.12, cy, rh * 0.85, 0, up),
    mkOneRoot(cx, hw * 0.18, cy, rh * 0.95, s, up),
  ];
}

// ── Status colors ──────────────────────────────────────────
const SC = {
  caries:  { dot: '#EF4444', hov: 'rgba(239,68,68,0.25)',  str: '#EF4444' },
  filled:  { dot: '#D97706', hov: 'rgba(245,158,11,0.25)', str: '#D97706' },
  crown:   { dot: '#3B82F6', hov: 'rgba(59,130,246,0.25)', str: '#3B82F6' },
  missing: { dot: '#94A3B8' },
};

// ════════════════════════════════════════════════════════════
export default function Odontogram({ dentalChart = {}, onToothClick }) {
  const [hov, setHov] = useState(null);

  const st = (fdi) => (dentalChart[fdi] || {}).status || 'normal';

  // ── Build tooth geometry (memoized) ──────────────────────
  const teeth = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 16; i++) {
      const cx = xC[i], w = COL_W[i];

      // Upper tooth
      const u = U[i];
      const uCy = U_BASE - u.ch;
      arr.push({
        fdi: UPPER_FDI[i], cx, w, up: true,
        crown: mkCrown(cx, w, U_BASE, u.ch, true),
        roots: mkRoots(cx, w, uCy, u.rh, u.r, true),
        bbY: uCy - u.rh, bbH: u.ch + u.rh,
      });

      // Lower tooth
      const l = L[i];
      const lCy = L_BASE + l.ch;
      arr.push({
        fdi: LOWER_FDI[i], cx, w, up: false,
        crown: mkCrown(cx, w, L_BASE, l.ch, false),
        roots: mkRoots(cx, w, lCy, l.rh, l.r, false),
        bbY: L_BASE, bbH: l.ch + l.rh,
      });
    }
    return arr;
  }, []);

  // ── Render a single tooth ────────────────────────────────
  function renderTooth(t) {
    const { fdi, cx, w, crown, roots, bbY, bbH } = t;
    const status = st(fdi);
    const isH = hov === fdi;
    const cfg = SC[status];

    // Missing tooth → faded + X
    if (status === 'missing') {
      return (
        <g key={fdi} style={{ cursor: 'pointer' }}
           onClick={() => onToothClick(fdi)}
           onMouseEnter={() => setHov(fdi)}
           onMouseLeave={() => setHov(null)}>
          <path d={crown} fill="#E2E8F0" stroke="#CBD5E1" strokeWidth={1} opacity={0.4} />
          {roots.map((d, i) => (
            <path key={i} d={d} fill="#E2E8F0" stroke="#CBD5E1" strokeWidth={0.8} opacity={0.4} />
          ))}
          <line x1={cx - w * 0.28} y1={bbY + bbH * 0.15}
                x2={cx + w * 0.28} y2={bbY + bbH * 0.85}
                stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
          <line x1={cx + w * 0.28} y1={bbY + bbH * 0.15}
                x2={cx - w * 0.28} y2={bbY + bbH * 0.85}
                stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
        </g>
      );
    }

    // Determine crown fill, root fill, stroke, and strokeWidth based on status
    let crownFill = "url(#odonto-crown)";
    let rootFill = "url(#odonto-root)";
    let strokeColor = "#C4A882";
    let strokeWidthCrown = 1.2;
    let strokeWidthRoot = 0.9;

    if (status === 'caries') {
      crownFill = "url(#odonto-crown-caries)";
      rootFill = "url(#odonto-root-caries)";
      strokeColor = "#EF4444";
      strokeWidthCrown = 1.8;
      strokeWidthRoot = 1.4;
    } else if (status === 'filled') {
      crownFill = "url(#odonto-crown-filled)";
      rootFill = "url(#odonto-root-filled)";
      strokeColor = "#D97706";
      strokeWidthCrown = 1.8;
      strokeWidthRoot = 1.4;
    } else if (status === 'crown') {
      crownFill = "url(#odonto-crown-crown)";
      rootFill = "url(#odonto-root-crown)";
      strokeColor = "#3B82F6";
      strokeWidthCrown = 1.8;
      strokeWidthRoot = 1.4;
    }

    // Hover overlay colors
    let hovFill = 'transparent', hovStr = 'transparent', hovSW = 0;
    if (isH) {
      if (cfg) {
        hovFill = cfg.hov; hovStr = cfg.str; hovSW = 2;
      } else {
        hovFill = 'rgba(59,130,246,0.10)';
        hovStr = 'rgba(96,165,250,0.6)';
        hovSW = 1.5;
      }
    }

    return (
      <g key={fdi} style={{ cursor: 'pointer' }}
         onClick={() => onToothClick(fdi)}
         onMouseEnter={() => setHov(fdi)}
         onMouseLeave={() => setHov(null)}>
        {/* Tooth shape */}
        <path d={crown} fill={crownFill} stroke={strokeColor} strokeWidth={strokeWidthCrown} style={{ transition: 'fill 0.2s, stroke 0.2s' }} />
        {roots.map((d, i) => (
          <path key={i} d={d} fill={rootFill} stroke={strokeColor} strokeWidth={strokeWidthRoot} style={{ transition: 'fill 0.2s, stroke 0.2s' }} />
        ))}
        {/* Hover highlight (only visible when hovered) */}
        {isH && (
          <rect
            x={cx - w / 2 - 2} y={bbY - 3}
            width={w + 4} height={bbH + 6}
            fill={hovFill} stroke={hovStr} strokeWidth={hovSW}
            rx={4} className={styles.hotspot}
          />
        )}
      </g>
    );
  }

  // ── Main render ──────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      <div className={styles.odontogramContainer}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className={styles.svgChart}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="odonto-crown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFF8F0" />
              <stop offset="100%" stopColor="#F5E6D3" />
            </linearGradient>
            <linearGradient id="odonto-root" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F0DCC4" />
              <stop offset="100%" stopColor="#E4CCAB" />
            </linearGradient>

            {/* Caries Tooth (Red/Pink Gradient) */}
            <linearGradient id="odonto-crown-caries" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFF5F5" />
              <stop offset="100%" stopColor="#FECACA" />
            </linearGradient>
            <linearGradient id="odonto-root-caries" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FEE2E2" />
              <stop offset="100%" stopColor="#FCA5A5" />
            </linearGradient>
            
            {/* Filled Tooth (Yellow/Amber Gradient) */}
            <linearGradient id="odonto-crown-filled" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFBEB" />
              <stop offset="100%" stopColor="#FDE68A" />
            </linearGradient>
            <linearGradient id="odonto-root-filled" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FEF3C7" />
              <stop offset="100%" stopColor="#FCD34D" />
            </linearGradient>

            {/* Crown/Cap Tooth (Blue/Sky Gradient) */}
            <linearGradient id="odonto-crown-crown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EFF6FF" />
              <stop offset="100%" stopColor="#BFDBFE" />
            </linearGradient>
            <linearGradient id="odonto-root-crown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#DBEAFE" />
              <stop offset="100%" stopColor="#93C5FD" />
            </linearGradient>
          </defs>

          {/* Background */}
          <rect x={0} y={0} width={VB_W} height={VB_H} fill="#FAFCFE" rx={8} />

          {/* Center divider line */}
          <line
            x1={VB_W / 2} y1={U_BASE + 4}
            x2={VB_W / 2} y2={L_BASE - 4}
            stroke="#CBD5E1" strokeWidth={1} strokeDasharray="4,3"
          />

          {/* Quadrant labels */}
          <text x={VB_W / 2 - 15} y={(U_BASE + L_BASE) / 2 + 1}
                className={styles.quadrantLabel}>R</text>
          <text x={VB_W / 2 + 15} y={(U_BASE + L_BASE) / 2 + 1}
                className={styles.quadrantLabel}>L</text>

          {/* FDI labels + status indicator dots */}
          {Array.from({ length: 16 }).map((_, i) => {
            const cx = xC[i];
            const uFdi = UPPER_FDI[i], lFdi = LOWER_FDI[i];
            const uSt = st(uFdi), lSt = st(lFdi);
            const uDot = SC[uSt]?.dot, lDot = SC[lSt]?.dot;
            const uAct = hov === uFdi, lAct = hov === lFdi;
            return (
              <g key={`lbl-${i}`}>
                {/* Upper label */}
                <text x={cx} y={108}
                  className={`${styles.fdiLabel} ${uAct ? styles.fdiActive : ''}`}>
                  {uFdi}
                </text>
                {uDot && (
                  <circle 
                    cx={cx} 
                    cy={116} 
                    r={4} 
                    fill={uDot} 
                    stroke="#FFFFFF" 
                    strokeWidth={1} 
                  />
                )}

                {/* Lower label */}
                <text x={cx} y={355}
                  className={`${styles.fdiLabel} ${lAct ? styles.fdiActive : ''}`}>
                  {lFdi}
                </text>
                {lDot && (
                  <circle 
                    cx={cx} 
                    cy={343} 
                    r={4} 
                    fill={lDot} 
                    stroke="#FFFFFF" 
                    strokeWidth={1} 
                  />
                )}
              </g>
            );
          })}

          {/* Render all 32 teeth */}
          {teeth.map(t => renderTooth(t))}
        </svg>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotNormal}`} />
          <span>سليم</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotCaries}`} />
          <span>تسوس</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotFilled}`} />
          <span>حشوة معالجة</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotCrown}`} />
          <span>تلبيسة / تاج</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotMissing}`} />
          <span>مفقود / مخلوع</span>
        </div>
      </div>
    </div>
  );
}
