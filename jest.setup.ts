import '@testing-library/jest-dom';
import type { Ref } from 'react';

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
