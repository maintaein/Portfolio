'use client';

// About TEAMWORK 문항의 시각 증거. 두 손이 마주 와서 부딪히고, 그 자리에서
// 빛살과 반짝이가 터진 뒤 손 둘레에 광휘가 남는다. 원본은
// public/projects/teamwork.png의 선화다. 그림 파일을 쓰지 않는 이유는 색을
// 토큰에 맞춰야 하고 손 둘이 따로 움직여야 하기 때문이다.
//
// 원본을 닮게 하는 것은 획 하나짜리 막대가 아니라 윤곽선이다. 손가락
// 하나가 선 두 줄로 둘러싸인 닫힌 도형이고, 안을 배경색으로 채워서 뒤에
// 있는 것을 가린다. 그래서 겹친 손가락이 앞뒤로 읽히고 두 손이 가운데서
// 교차해도 뭉치지 않는다. 채움 없이 선만 그렸을 때는 갈퀴 둘로 보였다.
//
// 손가락과 엄지는 좌표를 손으로 적지 않고 digitPath가 만든다. 다섯 개가
// 같은 규칙(밑동, 방향, 길이, 굵기)을 따르므로 베지어를 스무 줄 적는
// 것보다 이쪽이 고치기 쉽다. 손바닥과 소매는 모양이 하나뿐이라 그대로 적는다.
//
// gsap은 동적으로 들여온다. About은 정적 import라 여기서 정적으로 쓰면
// gsap이 첫 화면 번들에 얹힌다. BootSequence가 같은 처방을 쓴다.
import { useEffect, useRef, useState } from 'react';

// 접촉점. 빛살이 이 점을 중심으로 퍼진다. viewBox 좌표이고, 아래 손
// 배치에서 두 손의 가운뎃손가락 끝이 만나는 자리다.
const BURST_X = 100;
const BURST_Y = 42;

// 좌표는 전부 소수점 한 자리로 끊는다. Math.sin은 구현마다 마지막
// 자리가 달라도 되는 함수라, 끊지 않으면 Node가 그린 문자열과 브라우저가
// 계산한 값이 한 ulp 어긋나서 React가 하이드레이션 불일치로 잡는다.
// 컨트롤러가 브라우저 콘솔에서 실제로 그 경고를 받았다.
const round1 = (v: number) => Math.round(v * 10) / 10;

// 빛살 여덟. 위쪽 반원에 고르게 둔다. 아래로는 팔뚝이 있어 비워 둔다.
const RAYS = [-168, -144, -120, -96, -72, -48, -24, -12].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    deg,
    x1: round1(BURST_X + cos * 26),
    y1: round1(BURST_Y + sin * 26),
    x2: round1(BURST_X + cos * 38),
    y2: round1(BURST_Y + sin * 38),
  };
});

// 네 갈래 반짝이. 원본 그림도 같은 자리에 셋을 두었다.
const SPARKS = [
  { x: 34, y: 92, s: 1 },
  { x: 166, y: 88, s: 0.85 },
  { x: 100, y: 12, s: 0.65 },
];
const SPARK_PATH = 'M0 -9 Q1.6 -1.6 9 0 Q1.6 1.6 0 9 Q-1.6 1.6 -9 0 Q-1.6 -1.6 0 -9 Z';

interface Digit {
  // 밑동 중심. 손바닥 안쪽에 둔다. 손가락이 손바닥 위에 그려지므로
  // 밑동이 깊을수록 손바닥을 가로지르는 선이 길어진다.
  bx: number;
  by: number;
  // 0이 위쪽이고 양수가 오른쪽으로 눕는 각이다.
  deg: number;
  len: number;
  w: number;
}

// 닫지 않는다(Z가 없다). SVG는 채울 때만 시작점과 끝점을 이어 주므로,
// 닫지 않으면 안은 채워지는데 밑동을 가로지르는 선은 그려지지 않는다.
// 손가락이 손바닥에서 자라 나온 것처럼 보이는 것이 이 덕이다.
function digitPath({ bx, by, deg, len, w }: Digit) {
  const rad = (deg * Math.PI) / 180;
  const ux = Math.sin(rad);
  const uy = -Math.cos(rad);
  const nx = -uy;
  const ny = ux;
  const half = w / 2;
  const reach = len - half;
  const sx = bx + nx * half;
  const sy = by + ny * half;
  const ex = bx - nx * half;
  const ey = by - ny * half;
  const r = round1;
  return [
    `M${r(sx)} ${r(sy)}`,
    `L${r(sx + ux * reach)} ${r(sy + uy * reach)}`,
    // 끝은 반지름이 굵기의 절반인 반원이다. 각지게 두면 장갑이 된다.
    `A${half} ${half} 0 0 0 ${r(ex + ux * reach)} ${r(ey + uy * reach)}`,
    `L${r(ex)} ${r(ey)}`,
  ].join('');
}

// 손가락 넷. 가운데 둘이 길고 새끼가 가장 짧다. 안쪽(+x)일수록 상대 손
// 쪽으로 눕는다.
const FINGERS: readonly Digit[] = [
  { bx: -13, by: -21, deg: -14, len: 43, w: 10 },
  { bx: -4, by: -25, deg: -4, len: 49, w: 10.5 },
  { bx: 5, by: -24, deg: 7, len: 46, w: 10.5 },
  { bx: 13, by: -20, deg: 20, len: 38, w: 9.5 },
];

// 엄지. 원본처럼 바깥쪽으로 뻗는다. 두 손 모두 엄지가 바깥, 새끼손가락이
// 안쪽이다. 안쪽으로 뻗으면 둘이 가운데서 X로 겹친다.
const THUMB: Digit = { bx: -11, by: -6, deg: -26, len: 22, w: 10 };

// 손바닥. 손목(y 0)에서 손가락 밑동(y -36)까지다.
const PALM = 'M17 6 C20 -10 20 -25 14 -33 C6 -41 -8 -41 -15 -32 C-20 -25 -20 -10 -17 6 Z';

// 소매와 팔뚝. 손목에서 바깥 아래로 흘러 나가고 끝이 물결이다. 원본도
// 팔을 화면 밖까지 끌지 않고 이렇게 끊는다.
const SLEEVE = 'M-19 3 C-8 -1 8 -1 19 3 L19 20 C8 24 -8 24 -19 20 Z';
const FOREARM =
  'M-19 14 C-27 36 -41 53 -58 62 C-52 68 -49 74 -50 82 C-26 71 -2 44 19 14 Z';

// 손 한 짝. 원점이 손목이고 손가락은 위로 간다. 엄지가 -x 쪽, 그러니까
// 팔뚝과 같은 바깥쪽에 있다. 그리는 차례가 앞뒤를 정한다. 채움이 있으므로
// 나중에 그린 것이 앞에 온다.
function Hand() {
  return (
    <g className="about-teamwork-ink">
      <path d={FOREARM} />
      <path d={PALM} />
      {FINGERS.map((finger) => (
        <path key={finger.bx} d={digitPath(finger)} />
      ))}
      <path d={digitPath(THUMB)} />
      {/* 소매가 손목을 덮는다. 그래서 손바닥과 팔뚝이 만나는 자리에
          선이 겹쳐 보이지 않는다. */}
      <path d={SLEEVE} />
    </g>
  );
}

// 광휘 겹이 참조할 손 둘의 id. 이 컴포넌트는 페이지에 하나만 선다.
const HANDS_ID = 'about-teamwork-hands';

// 마주 오는 거리와 각 구간의 길이. 초 단위다.
const APPROACH = 16;
const APPROACH_DURATION = 0.4;
const IMPACT_DURATION = 0.08;
const BURST_IN = 0.18;
const BURST_OUT = 0.42;

export interface AboutTeamworkProps {
  // About이 활성이고 TEAMWORK가 골라져 있을 때만 true. 손뼉은 이 값이
  // 올라가는 순간 한 번만 친다. 무한 반복은 옆에서 글을 읽는 동안 계속
  // 시야를 끌어서 걷어냈다. 모션을 끈 사용자에게는 영영 false가 온다.
  active: boolean;
}

export default function AboutTeamwork({ active }: AboutTeamworkProps) {
  const rootRef = useRef<SVGSVGElement | null>(null);
  const runRef = useRef<((play: boolean) => void) | null>(null);
  const activeRef = useRef(active);
  // 손뼉이 끝난 뒤 켜지는 광휘. 상태로 들고 CSS가 그린다. 흐림 반경을
  // 전환하면 매 프레임 알파를 다시 흐리게 만들므로 불투명도만 움직인다
  // (Skills 아이콘 광휘와 같은 이유).
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void import('@/lib/gsap').then(({ gsap, registerGsap, SITE_EASE }) => {
      if (cancelled || !rootRef.current) return;
      registerGsap();

      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ paused: true, onComplete: () => setGlow(true) });
        tl.fromTo(
          '[data-teamwork-hand]',
          { x: -APPROACH },
          // 다가오는 동안은 가속이다. 감속 커브로 들어오면 부딪히기 직전에
          // 느려져서 두 손이 마주쳤다기보다 겨우 닿은 것처럼 보인다.
          { x: 0, duration: APPROACH_DURATION, ease: 'power2.in' },
          0
        )
          // 부딪히는 순간의 눌림. 손이 서로를 밀어 낸 만큼만 눕는다.
          .to(
            '[data-teamwork-hand]',
            { scaleX: 0.93, duration: IMPACT_DURATION, yoyo: true, repeat: 1 },
            APPROACH_DURATION
          )
          .fromTo(
            '[data-teamwork-ray]',
            { scale: 0.3, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: BURST_IN,
              stagger: 0.015,
              ease: SITE_EASE,
              svgOrigin: `${BURST_X} ${BURST_Y}`,
            },
            APPROACH_DURATION
          )
          .to(
            '[data-teamwork-ray]',
            {
              scale: 1.3,
              opacity: 0,
              duration: BURST_OUT,
              stagger: 0.015,
              svgOrigin: `${BURST_X} ${BURST_Y}`,
            },
            APPROACH_DURATION + BURST_IN
          )
          .fromTo(
            '[data-teamwork-spark]',
            { scale: 0, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: BURST_IN,
              stagger: 0.06,
              ease: SITE_EASE,
              transformOrigin: 'center',
            },
            APPROACH_DURATION + 0.04
          )
          .to(
            '[data-teamwork-spark]',
            {
              scale: 0.4,
              opacity: 0,
              duration: BURST_OUT,
              stagger: 0.06,
              transformOrigin: 'center',
            },
            APPROACH_DURATION + BURST_IN + 0.1
          );

        runRef.current = (play: boolean) => {
          if (play) {
            tl.restart();
            return;
          }
          // 문항을 떠나면 처음으로 되감는다. 되감지 않으면 다시 들어왔을
          // 때 손이 이미 붙어 있는 마지막 프레임에서 시작한다.
          tl.pause(0);
          setGlow(false);
        };
        if (activeRef.current) tl.restart();
      }, rootRef);

      cleanup = () => {
        runRef.current = null;
        ctx.revert();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    activeRef.current = active;
    runRef.current?.(active);
  }, [active]);

  return (
    <div
      data-about-teamwork
      data-active={active ? 'true' : 'false'}
      data-glow={glow ? 'true' : 'false'}
      aria-hidden="true"
      className="about-teamwork"
    >
      <svg ref={rootRef} viewBox="0 0 200 200" className="relative h-full w-full">
        {/* 자리잡기와 움직임을 다른 겹에 둔다. gsap은 SVG의 transform 속성을
            자기 행렬로 갈아 끼우므로, 같은 요소에 놓아 두면 x를 0으로
            되돌리는 순간 translate까지 0이 되어 손이 좌상단으로 날아간다.
            바깥 g가 자리를, 안쪽 g가 움직임을 맡는다. 오른손 틀은 좌우가
            뒤집혀 있어 두 손 다 국소 좌표로는 같은 쪽(-x)에서 들어온다. */}
        <g id={HANDS_ID}>
          <g transform="translate(77 104) rotate(18) scale(0.9)">
            <g data-teamwork-hand="left">
              <Hand />
            </g>
          </g>
          <g transform="translate(123 104) scale(-0.9 0.9) rotate(18)">
            <g data-teamwork-hand="right">
              <Hand />
            </g>
          </g>
        </g>
        <g className="about-teamwork-burst">
          {RAYS.map((ray) => (
            <line
              key={ray.deg}
              data-teamwork-ray
              x1={ray.x1}
              y1={ray.y1}
              x2={ray.x2}
              y2={ray.y2}
            />
          ))}
          {SPARKS.map((spark) => (
            <g
              key={`${spark.x}-${spark.y}`}
              transform={`translate(${spark.x} ${spark.y}) scale(${spark.s})`}
            >
              <path data-teamwork-spark d={SPARK_PATH} />
            </g>
          ))}
        </g>
        {/* 손뼉이 끝난 뒤의 광휘. 손 그림을 한 벌 더 얹고 그 알파에서 뽑은
            흐린 사본을 뒤에 깐다. 손 안쪽은 채움이 불투명해서 번짐이 윤곽
            바깥으로만 나온다. Skills 아이콘 호버가 하는 일과 같다. */}
        <use className="about-teamwork-bloom" href={`#${HANDS_ID}`} />
      </svg>
    </div>
  );
}
