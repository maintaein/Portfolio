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

export interface AboutFolderProps {
  open: boolean;
  // 종이 한 장이 이름 여럿을 담는다. 장수는 CSS가 세 장을 전제로 좌표를
  // 잡아 두었으므로 세 장까지만 그린다.
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
          {names.map((name) => (
            <span
              key={name}
              className="text-t8 uppercase tracking-[0.12em] text-[var(--color-cyan-hi)]"
            >
              {name}
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
