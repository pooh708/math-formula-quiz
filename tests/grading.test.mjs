import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {gradeLatex,latexToMath} from '../src/grading.js';
const good=[['n-3','n-3'],['\\frac{n(n-3)}{2}','n(n-3)/2'],['\\frac{(n-3)n}{2}','\\frac{n(n-3)}{2}'],['2\\pi r','2*pi*r'],['\\pi r^2','pi*r^2'],['\\frac{lr}{2}','1/2*l*r'],['360^\\circ','360']];
for(const[a,b]of good)test(`correct: ${a} = ${b}`,()=>assert.equal(gradeLatex(a,b).status,'correct'));
for(const[a,b]of [['n-2','n-3'],['2*pi*r','pi*r^2'],['360/n','360'],['n(n-2)/2','n(n-3)/2']])test(`incorrect: ${a} ≠ ${b}`,()=>assert.equal(gradeLatex(a,b).status,'incorrect'));
test('unrecognized markup review',()=>assert.equal(gradeLatex('\\bad{x}','n-3').status,'review'));
const expected=[
 ['n-3','n-3'],['n(n-3)/2','\\frac{n(n-3)}{2}'],['a+b','a+b'],
 ['180*(n-2)','180(n-2)'],['180(n-2)/n','\\frac{180(n-2)}{n}'],['360','360'],
 ['360/n','\\frac{360}{n}'],['2pir','2\\pi r'],['pir^2','\\pi r^2'],
 ['2pir*x/360','\\frac{2\\pi r x}{360}'],['pir^2*x/360','\\frac{\\pi r^2 x}{360}'],['l*r/2','\\frac{lr}{2}']];
for(let i=0;i<expected.length;i++)test(`original question ${i+1} answer`,()=>assert.equal(gradeLatex(...expected[i]).status,'correct'));
test('question 5 erroneous answer in original PDF must not be accepted',()=>assert.equal(gradeLatex('180(n-2)/2','180(n-2)/n').status,'incorrect'));
test('degree superscript in braces',()=>assert.equal(gradeLatex('360^{\\circ}','360').status,'correct'));
