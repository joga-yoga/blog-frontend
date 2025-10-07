import '@testing-library/jest-dom';

jest.mock('react-markdown', () => {
  const React = require('react');
  return React.forwardRef(function MockReactMarkdown(
    { children }: { children: React.ReactNode; className?: string },
    ref
  ) {
    return React.createElement('div', { ref }, children);
  });
});

jest.mock('remark-gfm', () => () => null);
