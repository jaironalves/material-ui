import { utils } from 'react-docgen';
import { parse } from '@babel/core';
import { visit } from 'ast-types';

const chainedAsMarker = '@chainedAs';

function refineAsChainedAst(ast, type) {
  visit(ast, {
    visitProgram(path) {
      const consideredPath = path.get('body').get(0).get('expression').get('arguments').get(0);

      const consideredType = utils.getPropType(consideredPath);
      type.chained = consideredType;
      type.name = 'chained';

      return false;
    },
  });
}

function refineAsChainedMarker(ast, type) {
  const comments = [];
  ast.comments.forEach((comment) => {
    comments.push(comment.value.trim());
  });
  const docsAs = [];
  Array.from(comments).forEach((comment) => {
    const docValue = comment.replace('@chainedAs', '').trim();
    const docArray = JSON.parse(docValue);
    docsAs.push(...docArray);
  });
  const chainedValue = docsAs.map((value) => ({ name: value }));

  type.chained = { name: 'union', value: chainedValue };
  type.name = 'chained';
}

/**
 * mutates the given descriptor to be more accurate about its chaining nature
 */
function refineAsChained(type) {
  const ast = parse(type.raw, { filename: process.cwd() });
  if (type.raw.indexOf(chainedAsMarker) !== -1) refineAsChainedMarker(ast, type);
  else refineAsChainedAst(type);
}

export default function propJsdocHandler(documentation) {
  const { props } = documentation.toObject();

  Object.keys(props).forEach((propName) => {
    const descriptor = documentation.getPropDescriptor(propName);
    const marker = 'chainPropTypes';

    if (descriptor.type.name === 'custom' && descriptor.type.raw.indexOf(marker) !== -1) {
      refineAsChained(descriptor.type);
    }
  });
}
