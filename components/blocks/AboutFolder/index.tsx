'use client';

// About BASICS 문항의 시각 증거. 문항이 활성이면 폴더가 열리고 안에 있던
// 기술스택 종이 세 장이 부챗살로 펼쳐진다. 호버도 클릭도 받지 않는다.
// 레일에서 BASICS를 고르는 것이 유일한 입력이고, 이 컴포넌트는 그 결과를
// 그리기만 한다.
//
// 시안(.claude/designRefactoring/Folder/Folder.tsx)에서 걷어낸 것:
// 색을 런타임에 어둡게 만드는 유틸(색은 토큰이 정본이다), 종이의 마우스
// 시차, 클릭 토글, 호버 분기. 남긴 것은 앞판 두 장의 기울기와 종이의
// 펼침 좌표뿐이다.
//
// 기하와 전환은 전부 styles/design-tokens.css의 .about-folder 블록에 있다.
// 여기서 크기나 시간 값을 리터럴로 적지 않는다.
//
// 종이에 올리는 것은 Skills가 쓰는 것과 같은 마스크 아이콘이다. 이름을
// 글자로 적으면 같은 정보가 사이트 안에 두 벌이 되고, 폴더는 aria-hidden
// 장식이라 그 글자를 읽는 사람도 없다. --skill-icon-src는 커스텀
// 프로퍼티라 style 타입에 없어 캐스팅한다(SkillsSection과 같은 처방).
//
// 아이콘 하나가 겹 둘이다. 바깥 span이 광휘를 맡고 안쪽 span이 마스크로
// 모양을 쥔다. 마스크는 자기 자손의 filter까지 잘라내므로 같은 요소에
// 둘을 얹을 수 없다. Skills의 .skill-icon-button이 같은 이유로 같은 모양
// 이고, --skill-icon-src도 거기처럼 바깥이 쥐고 안쪽이 물려받는다.
import type { CSSProperties } from 'react';

export interface AboutFolderProps {
  open: boolean;
  // 종이 한 장이 아이콘 여럿을 담는다. 값은 public/icons-mono의 파일
  // 이름이다. 장수는 CSS가 세 장을 전제로 좌표를 잡아 두었으므로 세
  // 장까지만 그린다.
  papers: readonly (readonly string[])[];
}

const MAX_PAPERS = 3;

export default function AboutFolder({ open, papers }: AboutFolderProps) {
  return (
    <div
      data-about-folder
      data-open={open ? 'true' : 'false'}
      aria-hidden="true"
      className="about-folder"
    >
      <span className="about-folder-tab" />
      {papers.slice(0, MAX_PAPERS).map((names, index) => (
        <div key={names.join('-')} className="about-folder-paper" data-paper={index}>
          {names.map((icon) => (
            <span
              key={icon}
              className="about-folder-icon-slot"
              style={{ '--skill-icon-src': `url(/icons-mono/${icon}.svg)` } as CSSProperties}
            >
              <span
                data-about-folder-icon={icon}
                className="skill-icon about-folder-icon"
              />
            </span>
          ))}
        </div>
      ))}
      {/* 앞판 두 장. 닫혀 있을 때는 겹쳐서 한 장으로 보이고, 열리면 서로
          반대로 기울어 벌어진다. */}
      <span className="about-folder-front" data-side="left" />
      <span className="about-folder-front" data-side="right" />
    </div>
  );
}
