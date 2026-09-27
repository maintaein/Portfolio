import type { HTMLAttributes } from 'react';

type ScrollAreaProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'article' | 'nav';
};

export default function ScrollArea({ as: Tag = 'div', className = '', ...props }: ScrollAreaProps) {
  return <Tag className={`scroll-area ${className}`} {...props} />;
}
