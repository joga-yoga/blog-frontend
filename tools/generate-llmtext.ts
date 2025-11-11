#!/usr/bin/env node
const path = require('path');
const { register } = require('ts-node');

register({
  transpileOnly: false,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node16',
    esModuleInterop: true,
    resolveJsonModule: true,
    verbatimModuleSyntax: false
  },
  cwd: path.resolve(__dirname, '..')
});

require('./src/cli');
