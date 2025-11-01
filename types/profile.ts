

export interface CoreValue {
  id: string;
  title: string;
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