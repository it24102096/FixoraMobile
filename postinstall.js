/**
 * postinstall.js
 *
 * Applies fixes to node_modules that cannot be handled by patch-package
 * due to Windows MAX_PATH limitations.
 *
 * Fix: react-native-screens NDK 27 - link c++_shared to resolve libc++ symbols.
 * NDK 27 uses --no-undefined linking strictly; c++_shared must be explicitly
 * linked in react-native-screens' CMakeLists.txt.
 */

const fs = require('fs');
const path = require('path');

const cmakePath = path.join(
  __dirname,
  'node_modules',
  'react-native-screens',
  'android',
  'CMakeLists.txt',
);

if (!fs.existsSync(cmakePath)) {
  console.log('postinstall: react-native-screens CMakeLists.txt not found, skipping.');
  process.exit(0);
}

let content = fs.readFileSync(cmakePath, 'utf8');

if (content.includes('c++_shared')) {
  console.log('postinstall: react-native-screens c++_shared fix already applied.');
  process.exit(0);
}

// Add c++_shared to New Architecture target_link_libraries
content = content.replace(
  /target_link_libraries\(rnscreens\s*\n(\s*)ReactAndroid::reactnative\s*\n(\s*)ReactAndroid::jsi\s*\n(\s*)fbjni::fbjni\s*\n(\s*)android\s*\n(\s*)\)/,
  'target_link_libraries(rnscreens\n$1ReactAndroid::reactnative\n$2ReactAndroid::jsi\n$3fbjni::fbjni\n$4android\n$4c++_shared\n$5)',
);

// Add c++_shared to legacy Architecture target_link_libraries
content = content.replace(
  /target_link_libraries\(rnscreens\s*\n(\s*)ReactAndroid::jsi\s*\n(\s*)android\s*\n(\s*)\)/,
  'target_link_libraries(rnscreens\n$1ReactAndroid::jsi\n$2android\n$2c++_shared\n$3)',
);

fs.writeFileSync(cmakePath, content, 'utf8');
console.log('postinstall: Applied c++_shared fix to react-native-screens CMakeLists.txt');
