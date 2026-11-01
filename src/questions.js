export const questions=[
{id:1,prompt:'n각형의 한 꼭짓점에서 그을 수 있는 대각선의 개수'},
{id:2,prompt:'n각형의 대각선의 개수'},
{id:3,prompt:'그림에서 색칠한 외각의 크기를 a, b를 이용하여 나타내시오.',image:true},
{id:4,prompt:'n각형의 내각의 크기의 합'},
{id:5,prompt:'정n각형의 한 내각의 크기'},
{id:6,prompt:'n각형의 외각의 크기의 합'},
{id:7,prompt:'정n각형의 한 외각의 크기'},
{id:8,prompt:'반지름의 길이가 r인 원의 둘레의 길이'},
{id:9,prompt:'반지름의 길이가 r인 원의 넓이'},
{id:10,prompt:'반지름의 길이가 r이고 중심각의 크기가 x°인 부채꼴의 호의 길이'},
{id:11,prompt:'반지름의 길이가 r이고 중심각의 크기가 x°인 부채꼴의 넓이'},
{id:12,prompt:'반지름의 길이가 r이고 호의 길이가 l인 부채꼴의 넓이'},
];
export function shuffled(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
