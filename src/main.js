import {WORLD,maps,fitViewport,random} from './maps.js';
const canvas=document.querySelector('#landscape'),ctx=canvas.getContext('2d');
const viewport=document.querySelector('#viewport');
const map=maps[0];
const art=document.createElement('canvas');art.width=WORLD.width;art.height=WORLD.height;
const g=art.getContext('2d');
function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function tree(c,x,y,s,muted=false){
 c.save();c.translate(x,y);c.scale(s,s);
 ellipse(c,9,10,30,12,muted?'#14201d35':'#243c2945');
 c.fillStyle=muted?'#3d4540':'#70573a';c.fillRect(-4,-20,8,27);
 const colors=muted?['#303c35','#3a4740','#465149']:['#294e3d','#38634a','#4c7952'];
 for(let i=0;i<3;i++){c.fillStyle=colors[i];c.beginPath();c.moveTo(0,-89+i*19);c.quadraticCurveTo(14,-65+i*20,33-i*4,-28+i*12);c.quadraticCurveTo(0,-17+i*12,-33+i*4,-28+i*12);c.quadraticCurveTo(-12,-65+i*20,0,-89+i*19);c.fill();}
 c.strokeStyle=muted?'#69746725':'#a7ba6b45';c.lineWidth=2;c.beginPath();c.moveTo(-2,-80);c.lineTo(-18,-48);c.stroke();c.restore();
}
function path(c){c.beginPath?.();map.path.forEach(([x,y],i)=>{if(!i)c.moveTo(x,y);else{const prev=map.path[i-1];c.quadraticCurveTo(prev[0],prev[1],(prev[0]+x)/2,(prev[1]+y)/2);}});c.lineTo(...map.path.at(-1));}
function nearPath(x,y){return map.path.slice(1).some((b,i)=>{const a=map.path[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<100;});}
function drawMap(){
 const rng=random(map.seed);g.fillStyle='#68815a';g.fillRect(0,0,1600,900);
 for(let i=0;i<1600;i++){const x=rng()*1600,y=rng()*900;ellipse(g,x,y,10+rng()*55,5+rng()*25,['#748a5d30','#92a36e20','#405e4020'][i%3]);}
 // Small, stable grass strokes: no random terrain on resize.
 for(let i=0;i<4200;i++){const x=rng()*1600,y=rng()*900;g.strokeStyle=i%2?'#b5bd7829':'#405e4030';g.beginPath();g.moveTo(x,y);g.lineTo(x-2,y-4-rng()*4);g.stroke();}
 const p=map.pond;
 ellipse(g,p.x,p.y,p.rx+17,p.ry+13,'#526f4e');ellipse(g,p.x,p.y,p.rx+6,p.ry+5,'#b3b07c');ellipse(g,p.x,p.y,p.rx,p.ry,'#426e68');ellipse(g,p.x-12,p.y-10,p.rx-17,p.ry-14,'#56847a');
 for(let i=0;i<18;i++){const x=p.x-95+rng()*185,y=p.y-38+rng()*65;g.strokeStyle='#b3d3b33d';g.beginPath();g.moveTo(x,y);g.lineTo(x+12+rng()*25,y);g.stroke();}
 g.lineJoin='round';g.lineCap='round';for(const [width,color] of [[105,'#405c3940'],[91,'#a39c68'],[78,'#c1b17b'],[57,'#c8b985']]){g.lineWidth=width;g.strokeStyle=color;path(g);g.stroke();}
 g.save();const trail=new Path2D();path(trail);g.lineWidth=68; // Path pebble placement follows the rendered path hit test.
 for(let i=0;i<1400;i++){const x=rng()*1600,y=rng()*900;if(g.isPointInStroke(trail,x,y)){ellipse(g,x,y,1+rng()*2.5,1+rng(),i%2?'#857d5945':'#efe0ac70');}}g.restore();
 const trees=[];for(let i=0;i<500;i++){const x=rng()*1700-50,y=rng()*1000-30;const border=x<110||x>1480||y<160||y>850; if(!nearPath(x,y)&&((x-p.x)**2/(p.rx+45)**2+(y-p.y)**2/(p.ry+55)**2>1)&&(border||rng()<.15))trees.push({x,y,s:.65+rng()*.65});}
 trees.sort((a,b)=>a.y-b.y).forEach(t=>tree(g,t.x,t.y,t.s));
 for(let i=0;i<35;i++){const x=120+rng()*1370,y=180+rng()*610;if(nearPath(x,y)||Math.hypot(x-p.x,y-p.y)<180)continue;ellipse(g,x+2,y+4,12,5,'#324d3940');ellipse(g,x,y,10,7,'#858e76');ellipse(g,x-2,y-3,7,3,'#b0b49a');}
 const shade=g.createRadialGradient(800,430,250,800,450,900);shade.addColorStop(0,'#132e2000');shade.addColorStop(1,'#102a2675');g.fillStyle=shade;g.fillRect(0,0,1600,900);
}
function render(){
 const w=window.innerWidth,h=window.innerHeight,dpr=Math.min(window.devicePixelRatio||1,2),fit=fitViewport(w,h);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#28332d';ctx.fillRect(0,0,w,h);
 viewport.style.left=`${fit.x}px`;viewport.style.top=`${fit.y}px`;viewport.style.transform=`scale(${fit.scale})`;
 ctx.translate(fit.x,fit.y);ctx.scale(fit.scale,fit.scale);
 // Decorative world outside the fixed map. Position-based seeds keep it stable.
 const left=-fit.x/fit.scale,top=-fit.y/fit.scale,right=1600+fit.x/fit.scale,bottom=900+fit.y/fit.scale;
 for(let row=Math.floor(top/60)-1;row<Math.ceil(bottom/60)+2;row++)for(let col=Math.floor(left/65)-1;col<Math.ceil(right/65)+1;col++){
 const rng=random((row*73856093)^(col*19349663)^826);const x=col*65+rng()*45,y=row*60+rng()*40;if(x>60&&x<1540&&y>100&&y<850)continue;tree(ctx,x,y,.8+rng()*.5,true);
 }
 ctx.drawImage(art,0,0);
}
drawMap();render();window.addEventListener('resize',render);
const info=document.querySelector('#info'),panel=document.querySelector('#map-info');
info.addEventListener('click',()=>{panel.hidden=!panel.hidden;info.setAttribute('aria-expanded',String(!panel.hidden));});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;info.setAttribute('aria-expanded','false');}});
const fullscreen=document.querySelector('#fullscreen');
if(!document.fullscreenEnabled)fullscreen.hidden=true;
fullscreen.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{fullscreen.hidden=true;}});
document.addEventListener('fullscreenchange',()=>fullscreen.setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'));
