/* Drifting stars and occasional comets only. All graphics are local. */
const cosmicBackground=(()=>{
 const canvas=document.querySelector('#cosmic-background'),ctx=canvas.getContext('2d',{alpha:true});
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),TWO_PI=Math.PI*2;
 const cut=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));const smooth=v=>{v=cut(v);return v*v*(3-2*v);};
 let width=innerWidth,height=innerHeight,dpr=1,frame=0,previous=0,clock=0,nextScene=5+Math.random()*3,scene=null,paused=false;
 const stars=Array.from({length:230},()=>({x:Math.random(),y:Math.random(),size:.45+Math.random()*1.15,phase:Math.random()*TWO_PI,depth:.2+Math.random(),brightness:.2+Math.random()*.5}));
 function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
 function sprite(size){const c=document.createElement('canvas');c.width=c.height=size;return c;}
 function halo(c,x,y,r,color,alpha=1){if(r<=.05||alpha<=0)return;c.save();c.globalAlpha*=cut(alpha);const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
 function makeScene(){
  const seed=(Math.random()*4294967295)>>>0,random=seeded(seed),direction=random()<.5?1:-1,s={kind:'comet',seed,started:clock,duration:20,startX:direction>0?-.2:1.2,endX:direction>0?1.25:-.25,startY:.16+random()*.5};
  s.endY=cut(s.startY+(random()-.5)*.55,.12,.88);s.tint=[[170,238,255],[156,255,209],[211,236,255],[255,231,179]][Math.floor(random()*4)];s.sunX=random()<.5?-1.5:2.5;s.sunY=-1.8;
  s.particles=Array.from({length:680},()=>({born:.4+random()*10.6,life:4+random()*5.8,drift:random(),side:random()-.5,size:1.5+random()*5,phase:random()*TWO_PI})).sort((a,b)=>a.born-b.born);
  s.dust=sprite(48);halo(s.dust.getContext('2d'),24,24,23,s.tint[0]>230?'#ffe7b4':'#e7e0d0',1);return s;
 }
 function createScene(){scene=makeScene();}
 function cometPosition(s,t){const p=(t-.7)/10.5;return{x:(s.startX+(s.endX-s.startX)*p)*width,y:(s.startY+(s.endY-s.startY)*p+.045*Math.sin(p*Math.PI))*height};}
 function drawComet(s,t){
  const fade=smooth(t/1.1)*(1-smooth((t-17.4)/2.6));ctx.save();ctx.globalCompositeOperation='lighter';
  for(const p of s.particles){const age=t-p.born;if(age<0||age>p.life)continue;const origin=cometPosition(s,p.born),f=age/p.life,awayX=origin.x-s.sunX*width,awayY=origin.y-s.sunY*height,d=Math.hypot(awayX,awayY),x=origin.x+awayX/d*age*(3+p.drift*7)+Math.sin(p.phase+age*.3)*age*1.2,y=origin.y+awayY/d*age*(3+p.drift*7)+p.side*(4+age*6);ctx.globalAlpha=Math.pow(1-f,1.7)*fade*.18;ctx.drawImage(s.dust,x-p.size*(1+f*3),y-p.size*(1+f*3),p.size*(2+f*6),p.size*(2+f*6));}
  if(t<=12){
   const p=cometPosition(s,t),prev=cometPosition(s,t-.05),angle=Math.atan2(p.y-prev.y,p.x-prev.x),dx=p.x-s.sunX*width,dy=p.y-s.sunY*height,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,tail=Math.min(width,height)*.22,headFade=fade*(1-smooth((t-11.3)/.7));
   const gradient=ctx.createLinearGradient(p.x,p.y,p.x+ux*tail,p.y+uy*tail);gradient.addColorStop(0,'#92cfffaa');gradient.addColorStop(1,'#609ff000');ctx.strokeStyle=gradient;
   for(let j=0;j<5;j++){ctx.lineWidth=1+j*.5;ctx.globalAlpha=headFade*.24;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+ux*tail*.5+Math.sin(t+j)*4,p.y+uy*tail*.5,p.x+ux*tail,p.y+uy*tail);ctx.stroke();}
   const dustLength=Math.min(width,height)*.14;ctx.globalAlpha=headFade;ctx.translate(p.x,p.y);ctx.rotate(angle);const g=ctx.createLinearGradient(0,0,-dustLength,0);g.addColorStop(0,'#fff1d399');g.addColorStop(1,'#d5c6a800');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-dustLength*.5,-7,-dustLength,-22);ctx.quadraticCurveTo(-dustLength*.6,10,0,0);ctx.fill();const color=`rgb(${s.tint.join(',')})`;halo(ctx,0,0,26,color,.72);halo(ctx,0,0,10,color,.9);halo(ctx,0,0,3.3,'#fff8ec',1);
  }ctx.restore();
 }
 function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  for(const star of stars){const x=(star.x*width+clock*star.depth*.9)%width,y=(star.y*height+clock*star.depth*.18)%height;ctx.globalAlpha=star.brightness*(.82+.18*Math.sin(clock*.32+star.phase));ctx.fillStyle=star.brightness>.6?'#e2e7ff':'#8a9dbb';ctx.beginPath();ctx.arc(x,y,star.size,0,TWO_PI);ctx.fill();}ctx.globalAlpha=1;
  if(!scene)return;const age=clock-scene.started;if(age>=scene.duration){scene=null;nextScene=clock+9+Math.random()*11;return;}drawComet(scene,age);
 }
 function resize(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,1.4,Math.sqrt(2300000/(width*height)));canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);ctx.imageSmoothingEnabled=true;draw();}
 function tick(now){if(motion.matches){sync();return;}if(paused||document.hidden){frame=0;previous=0;return;}if(!previous)previous=now;const dt=(now-previous)/1000;if(dt>=1/30){clock+=Math.min(dt,.2);previous=now;if(!scene&&clock>=nextScene)createScene();draw();}frame=requestAnimationFrame(tick);}
 function sync(){cancelAnimationFrame(frame);frame=0;previous=0;canvas.hidden=motion.matches;if(motion.matches){scene=null;nextScene=clock+6;}else draw();if(!motion.matches&&!paused&&!document.hidden)frame=requestAnimationFrame(tick);}
 window.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);resize();sync();
 return{get activeScene(){return scene?{kind:scene.kind,duration:scene.duration,elapsed:clock-scene.started}:null;},get paused(){return paused||motion.matches;}};
})();
