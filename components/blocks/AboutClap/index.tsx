'use client';

// About TEAMWORK 문항의 시각 증거. 두 손이 마주 와서 부딪히고, 그 자리에서
// 빛살과 반짝이가 터진다. public/projects/teamwork.png의 선화를 손으로 옮긴
// 것이고, 그림 파일을 쓰지 않는 이유는 색을 토큰에 맞춰야 하고 손 둘이
// 따로 움직여야 하기 때문이다.
//
// 손은 원본처럼 길고 가는 손가락이 안쪽으로 휘어 올라가는 모양이다.
// 관절과 손톱은 그리지 않는다. 200px 남짓에서는 그 선들이 뭉쳐서 얼룩이
// 된다. 남긴 것은 손가락 넷의 길이 차이, 접힌 엄지, 손바닥에서 손목으로
// 흘러 나가는 선이다.
//
// gsap은 동적으로 들여온다. About은 정적 import라 여기서 정적으로 쓰면
// gsap이 첫 화면 번들에 얹힌다. BootSequence가 같은 처방을 쓴다.
import { useEffect, useRef } from 'react';

// 접촉점. 빛살이 이 점을 중심으로 퍼진다. viewBox 좌표다.
const BURST_X = 100;
const BURST_Y = 56;

// 빛살 여덟. 위쪽 반원에 고르게 둔다. 아래로는 팔뚝이 있어 비워 둔다.
const RAYS = [-168, -144, -120, -96, -72, -48, -24, -6].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    deg,
    x1: BURST_X + cos * 34,
    y1: BURST_Y + sin * 34,
    x2: BURST_X + cos * 48,
    y2: BURST_Y + sin * 48,
  };
});

// 네 갈래 반짝이. 원본 그림에도 같은 자리에 셋이 있다.
const SPARKS = [
  { x: 40, y: 78, s: 1 },
  { x: 160, y: 74, s: 0.85 },
  { x: 100, y: 16, s: 0.7 },
];
const SPARK_PATH = 'M0 -9 Q1.6 -1.6 9 0 Q1.6 1.6 0 9 Q-1.6 1.6 -9 0 Q-1.6 -1.6 0 -9 Z';

// 손 한 짝. 원점이 손목 위쪽이고 손가락은 위로, 손목은 아래 바깥으로
// 간다. 오른손이 기준이고 왼손은 이것을 좌우로 뒤집어 쓴다.
function Hand() {
  return (
    <g className="about-clap-ink">
      {/* 손가락 넷. 안쪽(+x)으로 기울고 길이가 다 다르다. 가운데 둘이
          가장 길다. */}
      <path d="M-13 6 C-17 -10 -13 -27 -4 -37" />
      <path d="M-5 8 C-9 -13 -4 -31 6 -41" />
      <path d="M3 8 C1 -13 6 -29 16 -38" />
      <path d="M11 10 C11 -6 17 -21 25 -29" />
      {/* 엄지. 손바닥 앞쪽에서 짧게 접힌다. */}
      <path d="M13 16 C21 12 27 6 30 -2" />
      {/* 손바닥. 손가락이 모여 나오는 자리다. */}
      <path d="M-16 4 C-19 18 -13 28 -1 30 C9 32 15 26 17 18" />
      {/* 손목에서 팔뚝으로. 원본처럼 바깥 아래로 흘러 나간다. */}
      <path d="M-13 27 C-19 40 -27 50 -38 56" />
    </g>
  );
}

// 마주 오는 거리와 각 구간의 길이. 초 단위다.
const APPROACH = 16;
const APPROACH_DURATION = 0.4;
const IMPACT_DURATION = 0.08;
const BURST_IN = 0.18;
const BURST_OUT = 0.42;
const REST = 1.1;

export interface AboutClapProps {
  // About이 활성이고 TEAMWORK가 골라져 있을 때만 true. false면 타임라인이
  // 멈춘다. 모션을 끈 사용자에게도 false가 내려온다.
  running: boolean;
}

export default function AboutClap({ running }: AboutClapProps) {
  const rootRef = useRef<SVGSVGElement | null>(null);
  const playRef = useRef<((play: boolean) => void) | null>(null);
  const runningRef = useRef(running);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void import('@/lib/gsap').then(({ gsap, registerGsap, SITE_EASE }) => {
      if (cancelled || !rootRef.current) return;
      registerGsap();

      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ repeat: -1, repeatDelay: REST, paused: true });
        tl.fromTo(
          '[data-clap-hand]',
          { x: -APPROACH },
          // 다가오는 동안은 가속이다. 감속 커브로 들어오면 부딪히기 직전에
          // 느려져서 두 손이 마주쳤다기보다 겨우 닿은 것처럼 보인다.
          { x: 0, duration: APPROACH_DURATION, ease: 'power2.in' },
          0,
        )
          // 부딪히는 순간의 눌림. 손이 서로를 밀어 낸 만큼만 눕는다.
          .to(
            '[data-clap-hand]',
            { scaleX: 0.93, duration: IMPACT_DURATION, yoyo: true, repeat: 1 },
            APPROACH_DURATION,
          )
          .fromTo(
            '[data-clap-ray]',
            { scale: 0.3, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: BURST_IN,
              stagger: 0.015,
              ease: SITE_EASE,
              svgOrigin: `${BURST_X} ${BURST_Y}`,
            },
            APPROACH_DURATION,
          )
          .to(
            '[data-clap-ray]',
            {
              scale: 1.3,
              opacity: 0,
              duration: BURST_OUT,
              stagger: 0.015,
              svgOrigin: `${BURST_X} ${BURST_Y}`,
            },
            APPROACH_DURATION + BURST_IN,
          )
          .fromTo(
            '[data-clap-spark]',
            { scale: 0, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: BURST_IN,
              stagger: 0.06,
              ease: SITE_EASE,
              transformOrigin: 'center',
            },
            APPROACH_DURATION + 0.04,
          )
          .to(
            '[data-clap-spark]',
            {
              scale: 0.4,
              opacity: 0,
              duration: BURST_OUT,
              stagger: 0.06,
              transformOrigin: 'center',
            },
            APPROACH_DURATION + BURST_IN + 0.1,
          );

        playRef.current = (play: boolean) => {
          if (play) tl.play();
          else tl.pause();
        };
        if (runningRef.current) tl.play();
      }, rootRef);

      cleanup = () => {
        playRef.current = null;
        ctx.revert();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    runningRef.current = running;
    playRef.current?.(running);
  }, [running]);

  return (
    <svg
      ref={rootRef}
      viewBox="0 0 200 200"
      aria-hidden="true"
      className="about-clap"
      data-about-clap
      data-running={running ? 'true' : 'false'}
    >
      {/* 자리잡기와 움직임을 다른 겹에 둔다. gsap은 SVG의 transform 속성을
          자기 행렬로 갈아 끼우므로, 같은 요소에 놓아 두면 x를 0으로
          되돌리는 순간 translate까지 0이 되어 손이 좌상단으로 날아간다.
          바깥 g가 자리를, 안쪽 g가 움직임을 맡는다. 오른손 틀은 좌우가
          뒤집혀 있어 두 손 다 국소 좌표로는 같은 쪽(-x)에서 들어온다. */}
      <g transform="translate(66 90) rotate(8) scale(1.2)">
        <g data-clap-hand="left">
          <Hand />
        </g>
      </g>
      <g transform="translate(134 90) scale(-1.2 1.2) rotate(8)">
        <g data-clap-hand="right">
          <Hand />
        </g>
      </g>
      <g className="about-clap-burst">
        {RAYS.map((ray) => (
          <line
            key={ray.deg}
            data-clap-ray
            x1={ray.x1}
            y1={ray.y1}
            x2={ray.x2}
            y2={ray.y2}
          />
        ))}
        {SPARKS.map((spark) => (
          <g key={`${spark.x}-${spark.y}`} transform={`translate(${spark.x} ${spark.y}) scale(${spark.s})`}>
            <path data-clap-spark d={SPARK_PATH} />
          </g>
        ))}
      </g>
    </svg>
  );
}
