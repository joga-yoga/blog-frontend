'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { JSX } from 'react';

type MarkdownProps = {
  children: string;
  className?: string;
  components?: Parameters<typeof ReactMarkdown>[0]['components'];
};

export function Markdown({ children, className, components }: MarkdownProps): JSX.Element {
  return (
    <ReactMarkdown
      className={['prose prose-neutral max-w-none', className].filter(Boolean).join(' ')}
      components={components}
      remarkPlugins={[remarkGfm]}
    >
      {children}
    </ReactMarkdown>
  );
}
