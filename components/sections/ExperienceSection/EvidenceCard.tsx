'use client';

import { useEffect, useRef } from 'react';
import type { ExperienceEvidence } from '@/types';
import type { DemoDraw } from './demos';

// 장이 공개되고 이만큼 지난 뒤부터 그림의 시간을 잰다(시안 runCard의 350ms)
const START_DELAY_MS = 350;

export default function EvidenceCard({ evidence, active, reduced }: { evidence: ExperienceEvidence; active: boolean; reduced: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { demo, label, note, wide, summary } = evidence;

  useEffect(() => {
    const cv = canvasRef.current;
    const g = cv?.getContext('2d');
    if (!active || !cv || !g) return;
    const t0 = performance.now() + START_DELAY_MS;
    let draw: DemoDraw | null = null, visible = false, raf = 0, w = 0, h = 0, dpr = 1;

    const size = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    };
    const frame = (now: number) => {
      raf = 0;
      if (!draw || !visible) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      draw(g, w, h, reduced ? 99 : Math.max(0, (now - t0) / 1000), reduced);
      // reduced는 마지막 장 한 번으로 끝낸다
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    // 크기를 바꾸면 캔버스가 지워지므로 reduced도 다시 한 장 그린다
    const onResize = () => {
      size();
      kick();
    };

    size();
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) kick();
      },
      { threshold: 0.2 },
    );
    io.observe(cv);
    addEventListener('resize', onResize);
    let alive = true;
    // 청크를 못 받으면 그림 없이 둔다. 요약은 sr-only로 읽힌다.
    import('./demos').then((m) => {
      if (!alive) return;
      draw = m.DEMOS[demo];
      kick();
    }).catch(() => {});

    return () => {
      alive = false;
      io.disconnect();
      removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, [active, reduced, demo]);

  return (
    <figure className="evidence-card" data-demo={demo} data-wide={wide || undefined}>
      <figcaption className="evidence-card-head">
        <p className="evidence-card-label">{label}</p>
        {note && <p className="evidence-card-note">{note}</p>}
      </figcaption>
      <canvas ref={canvasRef} aria-hidden="true" />
      <p className="sr-only">{summary}</p>
    </figure>
  );
}
