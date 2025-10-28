import '@testing-library/jest-dom';
import type { Ref } from 'react';

process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wiedza.joga.yoga';

jest.mock('react-markdown', () => {
  const React = require('react');
  return React.forwardRef(function MockReactMarkdown(
    { children }: { children: React.ReactNode; className?: string },
    ref: Ref<HTMLDivElement>
  ) {
    return React.createElement('div', { ref }, children);
  });
});

jest.mock('remark-gfm', () => () => null);
