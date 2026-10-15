/**
 * Short-circuit blast animation.
 *
 * When a short circuit is detected the simulation layer triggers this overlay.
 * It renders an SVG explosion at the world-space coordinates of the faulting
 * component, consisting of:
 *  - An expanding fireball (radial gradient circle)
 *  - Particle sparks flying outward
 *  - Expanding shockwave rings
 *  - A brief full-screen flash
 *
 * The animation auto-cleans after ~2.5 s by calling `onDone`.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Viewport } from './geometry.ts';

export interface BlastProps {
  /** World-space center of the explosion. */
  worldX: number;
  worldY: number;
  viewport: Viewport;
  /** Called when the animation finishes so the parent can clear state. */
  onDone: () => void;
}

const PARTICLE_COUNT = 18;
const DURATION_MS = 2500;

interface Particle {
  angle: number;
  distance: number;
  size: number;
  delay: number;
  hue: number;
}

export function BlastEffect({ worldX, worldY, viewport, onDone }: BlastProps) {
  const [phase, setPhase] = useState<'flash' | 'explode' | 'fade'>('flash');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Screen-space position.
  const sx = worldX * viewport.scale + viewport.panX;
  const sy = worldY * viewport.scale + viewport.panY;

  // Generate random particles once.
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (360 / PARTICLE_COUNT) * i + (Math.random() - 0.5) * 30,
      distance: 60 + Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 0.15,
      hue: 20 + Math.random() * 40, // orange-yellow range
    }));
  }, []);

  useEffect(() => {
    // Phase transitions.
    const t1 = setTimeout(() => setPhase('explode'), 120);
    const t2 = setTimeout(() => setPhase('fade'), 1200);
    const t3 = setTimeout(onDone, DURATION_MS);
    timerRef.current = t3;
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  return (
    <>
      {/* Full-screen flash overlay */}
      <div
        className="blast-flash"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 50,
          pointerEvents: 'none',
          background: phase === 'flash'
            ? 'radial-gradient(circle at ' + sx + 'px ' + sy + 'px, rgba(255,200,50,0.7) 0%, rgba(255,100,0,0.3) 30%, transparent 70%)'
            : 'transparent',
          opacity: phase === 'flash' ? 1 : 0,
          transition: 'opacity 0.4s ease-out',
        }}
      />

      {/* SVG explosion layer (positioned absolutely on top of the canvas) */}
      <svg
        className="blast-svg"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 51,
          overflow: 'visible',
        }}
      >
        <defs>
          <radialGradient id="blast-fireball">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="20%" stopColor="#ffe066" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#ff6600" stopOpacity="0.7" />
            <stop offset="80%" stopColor="#cc3300" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#330000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blast-smoke">
            <stop offset="0%" stopColor="#555" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#333" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#111" stopOpacity="0" />
          </radialGradient>
          <filter id="blast-glow">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Shockwave rings */}
        {[0, 0.1, 0.25].map((delay, i) => (
          <circle
            key={`ring-${i}`}
            cx={sx}
            cy={sy}
            r={10}
            fill="none"
            stroke={i === 0 ? '#ffe066' : '#ff9933'}
            strokeWidth={3 - i}
            strokeOpacity={0.8 - i * 0.2}
            className="blast-ring"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}

        {/* Central fireball */}
        <circle
          cx={sx}
          cy={sy}
          r={8}
          fill="url(#blast-fireball)"
          filter="url(#blast-glow)"
          className="blast-fireball"
        />

        {/* Smoke cloud (appears later) */}
        {phase !== 'flash' && (
          <circle
            cx={sx}
            cy={sy}
            r={5}
            fill="url(#blast-smoke)"
            className="blast-smoke"
          />
        )}

        {/* Spark particles */}
        {particles.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          const endX = sx + Math.cos(rad) * p.distance;
          const endY = sy + Math.sin(rad) * p.distance;
          return (
            <circle
              key={`spark-${i}`}
              cx={sx}
              cy={sy}
              r={p.size}
              fill={`hsl(${p.hue}, 100%, 60%)`}
              className="blast-spark"
              style={{
                animationDelay: `${p.delay}s`,
                '--spark-x': `${endX - sx}px`,
                '--spark-y': `${endY - sy}px`,
              } as React.CSSProperties}
            />
          );
        })}

        {/* Lightning / arc lines from center */}
        {[0, 72, 144, 216, 288].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const len = 40 + Math.random() * 30;
          const midX = sx + Math.cos(rad + 0.3) * len * 0.5;
          const midY = sy + Math.sin(rad + 0.3) * len * 0.5;
          const ex = sx + Math.cos(rad) * len;
          const ey = sy + Math.sin(rad) * len;
          return (
            <polyline
              key={`arc-${i}`}
              points={`${sx},${sy} ${midX},${midY} ${ex},${ey}`}
              fill="none"
              stroke="#ffe066"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="blast-arc"
              style={{ animationDelay: `${i * 0.06}s` }}
            />
          );
        })}
      </svg>
    </>
  );
}
