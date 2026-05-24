#!/usr/bin/env node
/**
 * RN 0.84's @react-native/codegen@0.84.0 doesn't handle the
 * StringLiteralUnionTypeAnnotation schema type emitted by @react-native/codegen@0.82.x
 * (used by react-native-screens, react-native-webview, etc.). This script adds the
 * missing cases so Android codegen can generate correct event emitter C++ artifacts.
 */
const fs = require('fs');
const path = require('path');

const CODEGEN_DIR = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'node_modules',
  '@react-native',
  'codegen',
  'lib',
  'generators',
  'components',
);

function patchFile(filePath, patches) {
  let src = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const { search, replace } of patches) {
    if (src.includes(search)) {
      src = src.replace(search, replace);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, src, 'utf8');
    console.log(`patched ${path.relative(process.cwd(), filePath)}`);
  } else {
    console.log(`already patched ${path.relative(process.cwd(), filePath)}`);
  }
}

// GenerateEventEmitterCpp.js — add StringLiteralUnionTypeAnnotation as a fallthrough
// to the existing UnionTypeAnnotation case (both use toString()).
patchFile(path.join(CODEGEN_DIR, 'GenerateEventEmitterCpp.js'), [
  {
    search: `        case 'UnionTypeAnnotation':
          const validUnionType = parseValidUnionType(typeAnnotation);`,
    replace: `        case 'StringLiteralUnionTypeAnnotation':
        case 'UnionTypeAnnotation':
          const validUnionType = parseValidUnionType(typeAnnotation);`,
  },
]);

// GenerateEventEmitterH.js — two switch statements need the extra case.
patchFile(path.join(CODEGEN_DIR, 'GenerateEventEmitterH.js'), [
  // getNativeTypeFromAnnotation — returns the C++ type name
  {
    search: `    case 'UnionTypeAnnotation':
      const validUnionType = parseValidUnionType(typeAnnotation);
      if (validUnionType !== 'string') {
        throw new Error('Invalid since it is a union of non strings');
      }
      return generateEventStructName([...nameParts, eventProperty.name]);`,
    replace: `    case 'StringLiteralUnionTypeAnnotation':
      return generateEventStructName([...nameParts, eventProperty.name]);
    case 'UnionTypeAnnotation':
      const validUnionType = parseValidUnionType(typeAnnotation);
      if (validUnionType !== 'string') {
        throw new Error('Invalid since it is a union of non strings');
      }
      return generateEventStructName([...nameParts, eventProperty.name]);`,
  },
  // generateStruct — generates the C++ enum definition
  {
    search: `      case 'UnionTypeAnnotation':
        const validUnionType = parseValidUnionType(typeAnnotation);
        if (validUnionType !== 'string') {
          throw new Error('Invalid since it is a union of non strings');
        }
        generateEnum(
          structs,
          typeAnnotation.types.map(literal => literal.value),
          nameParts.concat([name]),
        );
        return;`,
    replace: `      case 'StringLiteralUnionTypeAnnotation':
        generateEnum(
          structs,
          typeAnnotation.types.map(literal => literal.value),
          nameParts.concat([name]),
        );
        return;
      case 'UnionTypeAnnotation':
        const validUnionType = parseValidUnionType(typeAnnotation);
        if (validUnionType !== 'string') {
          throw new Error('Invalid since it is a union of non strings');
        }
        generateEnum(
          structs,
          typeAnnotation.types.map(literal => literal.value),
          nameParts.concat([name]),
        );
        return;`,
  },
]);
