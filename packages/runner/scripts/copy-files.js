#!/usr/bin/env node
// This script copies .wasm, .did, .types.ts, and .did.js files from the src folder to the dist folder
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const shell = require('shelljs');
import path from 'node:path';

const patterns = [
  'src/services/pic/pocket-ic',
];
const distDir = 'dist';

// Ensure the destination directory exists
shell.mkdir('-p', distDir);

// For each glob pattern, find matching files and copy them to the dist folder
patterns.forEach((pattern) => {
  const files = shell.ls(pattern);
  files.forEach((file) => {
    // Determine the relative path from the src directory and calculate destination path.
    const relativePath = path.relative('src', file);
    const destinationPath = path.join(distDir, relativePath);
    // Ensure the destination directory exists.
    shell.mkdir('-p', path.dirname(destinationPath));
    shell.cp('-R', file, destinationPath);
    console.log(`Copied ${file} to ${destinationPath}`);
  });
}); 
