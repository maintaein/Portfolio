import { cn } from '@/lib/utils/cn';
import Image from 'next/image';
import { ReactNode } from 'react';

type PostVariant = 'card' | 'list' | 'compact';

interface PostProps {
  title: string;
  description?: string;
  image?: string;
  date?: string;
  tags?: string[];
  author?: {
    name: string;
    avatar?: string;
  };
  variant?: PostVariant;
  onClick?: () => void;
  footer?: ReactNode;
  className?: string;
}

export default function Post({
  title,
  description,
  image,
  date,
  tags,
  author,
  variant = 'card',
  onClick,
  footer,
  className,
}: PostProps) {
  const isClickable = !!onClick;

  // Card 스타일
  if (variant === 'card') {
    return (
      <article
        className={cn(
          'bg-white rounded-lg border border-grey-200 overflow-hidden transition-all duration-base',
          isClickable && 'cursor-pointer hover:shadow-lg hover:border-blue-300',
          className
        )}
        onClick={onClick}
      >
        {image && (
          <div className="relative w-full h-48 bg-grey-100 overflow-hidden">
            <Image
              src={image}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-base hover:scale-105"
              width={96}
              height={96}
            />
          </div>
        )}

        <div className="p-6">
          {tags && tags.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-50 text-blue-700 text-t8 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h3 className="text-t3 font-bold text-grey-900 mb-2 line-clamp-2">
            {title}
          </h3>

          {description && (
            <p className="text-t6 text-grey-700 mb-4 line-clamp-3">
              {description}
            </p>
          )}

          <div className="flex items-center justify-between text-t7 text-grey-500">
            {author && (
              <div className="flex items-center gap-2">
                {author.avatar && (
                  <Image
                    src={author.avatar}
                    alt={author.name}
                    className="w-6 h-6 rounded-full"
                    width={96}
                    height={96}
                  />
                )}
                <span>{author.name}</span>
              </div>
            )}
            {date && <time>{date}</time>}
          </div>

          {footer && <div className="mt-4 pt-4 border-t border-grey-200">{footer}</div>}
        </div>
      </article>
    );
  }

  // List 스타일
  if (variant === 'list') {
    return (
      <article
        className={cn(
          'flex gap-4 p-4 bg-white border-b border-grey-200 transition-colors duration-fast',
          isClickable && 'cursor-pointer hover:bg-grey-50',
          className
        )}
        onClick={onClick}
      >
        {image && (
          <div className="flex-shrink-0 w-24 h-24 bg-grey-100 rounded-lg overflow-hidden">
            <Image
              src={image}
              alt={title}
              className="w-full h-full object-cover"
              width={96}
              height={96}
            />
          </div>
        )}

        
        <div className="flex-1 min-w-0">
          
          <h3 className="text-t4 font-semibold text-grey-900 mb-1 truncate">
            {title}
          </h3>

          {description && (
            <p className="text-t6 text-grey-700 mb-2 line-clamp-2">
              {description}
            </p>
          )}

          <div className="flex items-center gap-3 text-t7 text-grey-500">
            {author && <span>{author.name}</span>}
            {date && <time>{date}</time>}
            {tags && tags.length > 0 && (
              <div className="flex gap-1">
                {tags.slice(0, 3).map((tag, index) => (
                  <span key={index} className="text-blue-600">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  // Compact 스타일
  return (
    <article
      className={cn(
        'p-3 bg-white border-b border-grey-200 transition-colors duration-fast',
        isClickable && 'cursor-pointer hover:bg-grey-50',
        className
      )}
      onClick={onClick}
    >
      <h3 className="text-t5 font-medium text-grey-900 mb-1 line-clamp-1">
        {title}
      </h3>

      <div className="flex items-center gap-2 text-t7 text-grey-500">
        {author && <span>{author.name}</span>}
        {date && (
          <>
            <span>•</span>
            <time>{date}</time>
          </>
        )}
      </div>
    </article>
  );
}