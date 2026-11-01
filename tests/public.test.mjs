import {readFileSync} from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
test('client question module contains prompts only',()=>{const q=readFileSync('src/questions.js','utf8');assert.doesNotMatch(q,/answer:|display:/)});
test('client entry does not run local grading',()=>{const s=readFileSync('src/main.js','utf8');assert.doesNotMatch(s,/gradeLatex|q\.answer|q\.display/)});
