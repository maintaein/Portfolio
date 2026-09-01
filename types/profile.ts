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
    rank?: string;
}
  
export interface Certificate {
  id: string;
  name: string;
  organization: string;
  date: string;
  validUntil?: string;
  credentialId?: string;
}
