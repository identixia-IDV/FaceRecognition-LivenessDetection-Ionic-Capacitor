#!/usr/bin/env node
/**
 * Fail the build if FaceRecognitionSdkPlugin.kt declares duplicate @PluginMethod
 * function names (Kotlin "Conflicting overloads" / Cap register errors).
 */
const fs = require('fs');
const path = require('path');

const pluginPath = path.join(
  __dirname,
  '..',
  'android',
  'src',
  'main',
  'java',
  'com',
  'facerecognitionsdk',
  'FaceRecognitionSdkPlugin.kt'
);

if (!fs.existsSync(pluginPath)) {
  console.error('check-plugin-methods: missing', pluginPath);
  process.exit(1);
}

const src = fs.readFileSync(pluginPath, 'utf8');
const re = /@PluginMethod[\s\S]*?fun\s+(\w+)\s*\(/g;
const counts = new Map();
let m;
while ((m = re.exec(src)) !== null) {
  const name = m[1];
  counts.set(name, (counts.get(name) || 0) + 1);
}

const dups = [...counts.entries()].filter(([, n]) => n > 1);
if (dups.length) {
  console.error(
    'check-plugin-methods: duplicate @PluginMethod names:\n' +
      dups.map(([n, c]) => `  ${n} × ${c}`).join('\n')
  );
  process.exit(1);
}

console.log(
  `check-plugin-methods: ok (${counts.size} unique PluginMethods)`
);
