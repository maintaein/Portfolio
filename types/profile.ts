export interface Contact {
  name: string;
  email: string;
  githubUrl: string;
}

export interface CoreValue {
  id: string;
  title: string;
  // 레일에 쓰는 짧은 라벨. 순번(01, 02, 03)보다 뜻이 먼저 읽힌다.
  label: string;
  description: string;
  imagePlaceholder: string;
}

export interface Award {
    id: string;
    title: string;
    organization: string;
    date: string;
    description?: string;
    // 등급과 연결 프로젝트는 Recognition Ledger의 열이라 선택값이 아니다.
    // 하나라도 비면 행의 열이 어긋나고 외부 검증이 반쪽으로 읽힌다.
    rank: string;
    project: string;
    logo: string;
}
  
export interface Certificate {
  id: string;
  name: string;
  organization: string;
  date: string;
  // 취득 등급. 수상의 rank와 같은 자리에 놓이는 열이라 선택값이 아니다.
  grade: string;
  logo: string;
  validUntil?: string;
  credentialId?: string;
}
