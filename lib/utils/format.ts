// lib/utils/format.ts
export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
    }).format(d);
  }
  
  export function formatDateRange(start: string | Date, end?: string | Date): string {
    const startFormatted = formatDate(start);
    
    if (!end) {
      return `${startFormatted} - 현재`;
    }
    
    const endFormatted = formatDate(end);
    return `${startFormatted} - ${endFormatted}`;
  }
  
  export function calculateDuration(start: string | Date, end?: string | Date): string {
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = end ? (typeof end === 'string' ? new Date(end) : end) : new Date();
    
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                   (endDate.getMonth() - startDate.getMonth());
    
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (years > 0 && remainingMonths > 0) {
      return `${years}년 ${remainingMonths}개월`;
    } else if (years > 0) {
      return `${years}년`;
    } else {
      return `${remainingMonths}개월`;
    }
  }
  
  export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }