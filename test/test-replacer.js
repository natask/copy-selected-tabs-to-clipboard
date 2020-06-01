/*
 license: The MIT License, Copyright (c) 2020 YUKI "Piro" Hiroshi
*/
'use strict';

import { is, ok, ng } from './assert.js';
import * as Replacer from '../common/replacer.js';

function assertReplaced(input, expectedArgs, expectedReplaced) {
  const replaced = Replacer.processAll(
    input,
    (base, ...replacePairs) => {
      is(expectedArgs,
         [base, ...replacePairs]);
      return base;
    }
  );
  is(expectedReplaced, replaced);
}

export function testDoubleQuote() {
  assertReplaced(
    'prefix %REPLACE("base", "1st", "2nd")% suffix',
    ['base', '1st', '2nd'],
    'prefix base suffix'
  );
  assertReplaced( // should ignore whitespaced outside quotations
    'prefix %REPLACE(  "  base  "  ,  "  1st  "  ,  "  2nd  "  )% suffix',
    ['  base  ', '  1st  ', '  2nd  '],
    'prefix   base   suffix'
  );
  assertReplaced( // should ignore argument delimiters in quotations
    'prefix %REPLACE("b,a,s,e", "1,s,t", "2,n,d")% suffix',
    ['b,a,s,e', '1,s,t', '2,n,d'],
    'prefix b,a,s,e suffix'
  );
  assertReplaced( // should concatenate sequential multiple quotations
    'prefix %REPLACE("base"" text", "1st ""arg", "2nd"   " arg")% suffix',
    ['base text', '1st arg', '2nd arg'],
    'prefix base text suffix'
  );
  assertReplaced( // should be safe for the end mark in quotations
    'prefix %REPLACE("base)%", "1st", "2nd")% suffix',
    ['base)%', '1st', '2nd'],
    'prefix base)% suffix'
  );
}

export function testSingleQuote() {
  assertReplaced(
    "prefix %REPLACE('base', '1st', '2nd')% suffix",
    ['base', '1st', '2nd'],
    'prefix base suffix'
  );
  assertReplaced( // should ignore whitespaced outside quotations
    "prefix %REPLACE(  '  base  '  ,  '  1st  '  ,  '  2nd  '  )% suffix",
    ['  base  ', '  1st  ', '  2nd  '],
    'prefix   base   suffix'
  );
  assertReplaced( // should ignore argument delimiters in quotations
    "prefix %REPLACE('b,a,s,e', '1,s,t', '2,n,d')% suffix",
    ['b,a,s,e', '1,s,t', '2,n,d'],
    'prefix b,a,s,e suffix'
  );
  assertReplaced( // should concatenate sequential multiple quotations
    "prefix %REPLACE('base'' text', '1st ''arg', '2nd'   ' arg')% suffix",
    ['base text', '1st arg', '2nd arg'],
    'prefix base text suffix'
  );
  assertReplaced( // should be safe for the end mark in quotations
    "prefix %REPLACE('base)%', '1st', '2nd')% suffix",
    ['base)%', '1st', '2nd'],
    'prefix base)% suffix'
  );
}

export function testMixedQuote() {
  assertReplaced(
    "prefix %REPLACE('base', \"1st\", '2nd')% suffix",
    ['base', '1st', '2nd'],
    'prefix base suffix'
  );
  assertReplaced(
    "prefix %REPLACE('base '\"text\", \"1st\"' arg', '2nd '    \"arg\")% suffix",
    ['base text', '1st arg', '2nd arg'],
    'prefix base text suffix'
  );
  assertReplaced(
    "prefix %REPLACE('\"base\"', \"'1st'\", '\"2nd\"')% suffix",
    ['"base"', "'1st'", '"2nd"'],
    'prefix "base" suffix'
  );
}

export function testReplaced() {
  assertReplaced(
    'prefix %REPLACE("input text", "input", "output")% suffix',
    ['input text', 'input', 'output'],
    'prefix output text suffix'
  );
  assertReplaced( // should ignore cases
    'prefix %REPLACE("input text", "INPUT", "output")% suffix',
    ['input text', 'INPUT', 'output'],
    'prefix output text suffix'
  );
  assertReplaced( // should not global match
    'prefix %REPLACE("input text in replacer", "in[^ ]*", "output")% suffix',
    ['input text in replacer', 'in[^ ]*', 'output'],
    'prefix output text in replacer suffix'
  );
  assertReplaced( // should accept multiple replace pairs
    'prefix %REPLACE("input text in replacer", "in[^ ]*", "output", "in[^ ]*", "of")% suffix',
    ['input text in replacer', 'in[^ ]*', 'output', 'in[^ ]*', 'of'],
    'prefix output text of replacer suffix'
  );
}

export function testIgnoreCases() {
  assertReplaced(
    'prefix %replace("base", "1st", "2nd")% suffix',
    ['base', '1st', '2nd'],
    'prefix base suffix'
  );
  assertReplaced(
    'prefix %rEpLaCe("base", "1st", "2nd")% suffix',
    ['base', '1st', '2nd'],
    'prefix base suffix'
  );
}


function assertFailed(input, expectedError) {
  try {
    Replacer.processAll(input, () => {});
    ng('must be failed');
  }
  catch(error) {
    ok(error instanceof Replacer.ReplacerError);
    is(expectedError, error.message);
  }
}

export function testErrors() {
  assertFailed(
    'prefix %REPlACE()%',
    'Missing argument: Replacer must take one base text and one or more matcher/replace-text pairs'
  );
  assertFailed(
    'prefix %REPLACE("base")% suffix',
    'Missing matcher/replace-text pair: Replacer must take one base text and one or more matcher/replace-text pairs'
  );
  assertFailed(
    'prefix %REPlACE("base", "1st", "2nd", "3rd")%',
    'Missing replace text for the last matcher: Replacer must take one base text and one or more matcher/replace-text pairs'
  );
  assertFailed(
    'prefix %REPlACE("base", "unterminated)%',
    'Untermited replacer "%REPlACE("base", "unterminated)%", you may forgot to put close-quote for any argument'
  );
  assertFailed(
    'prefix %REPlACE("base", unquoted)%',
    'Invalid character "u" after "%REPlACE("base", ", you may forgot to wrap any argument with quotations'
  );
}