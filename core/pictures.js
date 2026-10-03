/* 圖像：程式畫的簡筆圖（動物、物品、頁面）貼到一塊平面上。影像輸入 / 輸出的場景用它，不要只有立方體像素。
   顏色是「照片」的自然色（不走語意色盤：它們是內容，不是標記）；離線單檔不需要任何圖檔。 */
(function(){
  const T=THREE;
  const C={sky:'#7FA8D6',sky2:'#BFD7EE',snow:'#EEF3F8',snow2:'#D6E2EE',grass:'#6E9E5A',grass2:'#4F7A42',fur:'#D9A066',fur2:'#B9803F',cream:'#F6F1E9',ink:'#2B2622',pink:'#E8A3B0',grey:'#8E8E96',grey2:'#5E5E66',
    bowl:'#E6E1D6',bowl2:'#B9B2A3',broth:'#C9843C',noodle:'#F2D98B',egg:'#F7E7A8',yolk:'#E8A838',nori:'#2F4A2E',car:'#C8463C',car2:'#8E2E27',glass:'#BFD9EE',tire:'#2E2E2E',rim:'#C9CDD3',book:'#3F6AA6',book2:'#2B4B7A',page:'#FBFAF6',
    coffee:'#5A3A24',cup:'#F2EEE6',cup2:'#CFC8BC',shoe:'#3C4A6B',shoe2:'#263247',sole:'#E5E3DC',metal:'#8C97A6',metal2:'#5B6675',lens:'#1E2A3A',lens2:'#3C5A80',leaf:'#5F8E4A',leaf2:'#3E6A34',leaf3:'#86B36A',lizard:'#6B9A52',tissue:'#E7B5B0',tissue2:'#D79A95',polyp:'#C8706C',polyp2:'#A8504C',
    paper:'#FBFAF6',text:'#3A4150',text2:'#9AA3B2',table:'#C9D6E8',table2:'#9FB4CF',bar:'#E39A3B',bar2:'#4C86C6',rock:'#8A8E93',rock2:'#5F6368',sun:'#F7D86B',card:'#F3EFE7'};
  const ell=(g,x,y,rx,ry,color,rot=0)=>{ g.fillStyle=color; g.beginPath(); g.ellipse(x,y,Math.max(0.5,rx),Math.max(0.5,ry),rot,0,Math.PI*2); g.fill(); };
  const circ=(g,x,y,r,color)=>ell(g,x,y,r,r,color);
  const rr=(g,x,y,w,h,r,color)=>{ g.fillStyle=color; g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); g.fill(); };
  const tri=(g,a,b,c,color)=>{ g.fillStyle=color; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.closePath(); g.fill(); };
  const line=(g,a,b,color,w)=>{ g.strokeStyle=color; g.lineWidth=w; g.lineCap='round'; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); };
  const hashed=(i)=>((i*2654435761)>>>0)/4294967296; // 固定的「隨機」：同一張圖每次畫都一樣

  const pic={
    /* ---- 背景 ---- */
    plain(g,w,h,color=C.card){ g.fillStyle=color; g.fillRect(0,0,w,h); },
    sky(g,w,h,horizon=0.6){ const s=g.createLinearGradient(0,0,0,h*horizon); s.addColorStop(0,C.sky); s.addColorStop(1,C.sky2); g.fillStyle=s; g.fillRect(0,0,w,h*horizon+1); },
    grass(g,w,h){ pic.sky(g,w,h,0.58); g.fillStyle=C.grass; g.fillRect(0,h*0.58,w,h*0.42); for(let i=0;i<60;i++){ const x=hashed(i)*w, y=h*0.6+hashed(i*31+5)*h*0.38; /* x、y 用不同的雜湊，點才不會排成斜線 */ line(g,[x,y],[x+2,y-h*0.05],C.grass2,2); } },
    snow(g,w,h){ pic.sky(g,w,h,0.55); g.fillStyle=C.snow; g.fillRect(0,h*0.55,w,h*0.45); g.fillStyle=C.snow2; ell(g,w*0.3,h*0.62,w*0.25,h*0.03,C.snow2); ell(g,w*0.75,h*0.75,w*0.2,h*0.025,C.snow2); for(let i=0;i<40;i++) circ(g,hashed(i+7)*w,hashed(i*53+11)*h*0.6,1.5+hashed(i*13+3)*2,C.cream); },
    room(g,w,h){ g.fillStyle='#E9E2D6'; g.fillRect(0,0,w,h*0.62); g.fillStyle='#B8966C'; g.fillRect(0,h*0.62,w,h*0.38); g.strokeStyle='#A07F57'; g.lineWidth=1; for(let i=1;i<6;i++){ g.beginPath(); g.moveTo(0,h*(0.62+i*0.07)); g.lineTo(w,h*(0.62+i*0.07)); g.stroke(); } },

    /* ---- 動物：先給「身體橢圓 + 頭圓」的部位版，再包成「中心 + 大小」的簡單版 ---- */
    dogParts(g,{bx,by,brx,bry,hx,hy,hr,color=C.fur,dark=C.fur2}){ const dir=hx<bx?-1:1;
      ell(g,bx+brx*0.9*dir*-1,by+bry*0.1,brx*0.18,bry*0.5,dark,dir*0.6); // 尾巴
      ell(g,bx,by,brx,bry,color); [-0.5,-0.15,0.2,0.55].forEach(k=>rr(g,bx+brx*k-brx*0.09,by+bry*0.55,brx*0.18,bry*0.7,brx*0.08,dark)); // 腿
      tri(g,[hx-hr*0.75,hy-hr*0.5],[hx-hr*0.45,hy-hr*1.35],[hx-hr*0.1,hy-hr*0.7],dark); tri(g,[hx+hr*0.75,hy-hr*0.5],[hx+hr*0.45,hy-hr*1.35],[hx+hr*0.1,hy-hr*0.7],dark); // 耳
      circ(g,hx,hy,hr,color); ell(g,hx+hr*0.35*dir,hy+hr*0.3,hr*0.5,hr*0.38,C.cream); circ(g,hx-hr*0.3*dir,hy-hr*0.15,hr*0.1,C.ink); circ(g,hx+hr*0.2*dir,hy-hr*0.15,hr*0.1,C.ink); circ(g,hx+hr*0.55*dir,hy+hr*0.25,hr*0.14,C.ink); },
    dog(g,x,y,s,o={}){ const dir=o.flip?1:-1; pic.dogParts(g,{bx:x,by:y,brx:s*0.5,bry:s*0.38,hx:x+dir*s*0.56,hy:y-s*0.3,hr:s*0.27,color:o.color,dark:o.dark}); },
    catParts(g,{bx,by,brx,bry,hx,hy,hr,color=C.grey,dark=C.grey2}){ const dir=hx<bx?-1:1;
      g.strokeStyle=dark; g.lineWidth=Math.max(2,brx*0.16); g.beginPath(); g.moveTo(bx-brx*0.8*dir,by); g.quadraticCurveTo(bx-brx*1.5*dir,by-bry*1.2,bx-brx*1.1*dir,by-bry*1.6); g.stroke(); // 尾巴
      ell(g,bx,by,brx,bry,color); tri(g,[hx-hr*0.8,hy-hr*0.3],[hx-hr*0.6,hy-hr*1.4],[hx-hr*0.1,hy-hr*0.8],color); tri(g,[hx+hr*0.8,hy-hr*0.3],[hx+hr*0.6,hy-hr*1.4],[hx+hr*0.1,hy-hr*0.8],color); circ(g,hx,hy,hr,color);
      [[-0.32,-0.1],[0.32,-0.1]].forEach(([ex,ey])=>ell(g,hx+ex*hr,hy+ey*hr,hr*0.13,hr*0.2,'#4FA36B')); tri(g,[hx-hr*0.1,hy+hr*0.2],[hx+hr*0.1,hy+hr*0.2],[hx,hy+hr*0.35],C.pink);
      [-1,1].forEach(k=>{ line(g,[hx+k*hr*0.2,hy+hr*0.3],[hx+k*hr*1.1,hy+hr*0.15],dark,1.2); line(g,[hx+k*hr*0.2,hy+hr*0.4],[hx+k*hr*1.1,hy+hr*0.5],dark,1.2); }); },
    cat(g,x,y,s,o={}){ const dir=o.flip?1:-1; pic.catParts(g,{bx:x,by:y,brx:s*0.48,bry:s*0.34,hx:x+dir*s*0.5,hy:y-s*0.3,hr:s*0.26,color:o.color,dark:o.dark}); },
    /* 單一橢圓裡塞一隻動物（分割場景的遮罩就是這個橢圓） */
    animal(g,kind,cx,cy,rx,ry,o={}){ const f=kind==='cat'?pic.catParts:pic.dogParts; f(g,{bx:cx-rx*0.15,by:cy+ry*0.1,brx:rx*0.68,bry:ry*0.62,hx:cx+rx*0.55,hy:cy-ry*0.35,hr:Math.min(rx,ry)*0.5,...o}); },

    /* ---- 物品 ---- */
    ball(g,x,y,r){ circ(g,x,y,r,C.cream); g.strokeStyle=C.ink; g.lineWidth=Math.max(1,r*0.06); for(let k=0;k<5;k++){ const a=k/5*Math.PI*2-Math.PI/2; const px=x+Math.cos(a)*r*0.42, py=y+Math.sin(a)*r*0.42; circ(g,px,py,r*0.17,C.ink); g.beginPath(); g.moveTo(px,py); g.lineTo(x+Math.cos(a)*r*0.95,y+Math.sin(a)*r*0.95); g.stroke(); } circ(g,x,y,r*0.2,C.ink); g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.stroke(); },
    mountain(g,x,y,s){ circ(g,x+s*0.35,y-s*0.35,s*0.12,C.sun); tri(g,[x-s*0.5,y+s*0.3],[x-s*0.1,y-s*0.35],[x+s*0.3,y+s*0.3],C.rock2); tri(g,[x-s*0.05,y+s*0.3],[x+s*0.25,y-s*0.2],[x+s*0.55,y+s*0.3],C.rock); tri(g,[x-s*0.22,y-s*0.15],[x-s*0.1,y-s*0.35],[x+s*0.02,y-s*0.15],C.snow); tri(g,[x+s*0.16,y-s*0.05],[x+s*0.25,y-s*0.2],[x+s*0.34,y-s*0.05],C.snow); },
    ramen(g,x,y,s){ ell(g,x,y+s*0.05,s*0.5,s*0.32,C.bowl); ell(g,x,y-s*0.08,s*0.42,s*0.18,C.broth); g.strokeStyle=C.noodle; g.lineWidth=Math.max(1.5,s*0.035); for(let k=0;k<6;k++){ g.beginPath(); g.moveTo(x-s*0.32+k*s*0.11,y-s*0.14); g.quadraticCurveTo(x-s*0.28+k*s*0.11,y-s*0.0,x-s*0.24+k*s*0.11,y-s*0.1); g.stroke(); }
      ell(g,x+s*0.2,y-s*0.1,s*0.1,s*0.07,C.egg); ell(g,x+s*0.2,y-s*0.1,s*0.05,s*0.035,C.yolk); rr(g,x-s*0.33,y-s*0.2,s*0.12,s*0.12,s*0.02,C.nori); ell(g,x-s*0.05,y-s*0.16,s*0.08,s*0.04,C.pink); rr(g,x,y+s*0.18,s*0.5,s*0.1,s*0.03,C.bowl2); line(g,[x+s*0.1,y-s*0.42],[x+s*0.45,y-s*0.05],C.fur2,Math.max(1.5,s*0.03)); line(g,[x+s*0.18,y-s*0.44],[x+s*0.5,y-s*0.1],C.fur2,Math.max(1.5,s*0.03)); },
    car(g,x,y,s){ rr(g,x-s*0.5,y-s*0.08,s,s*0.28,s*0.06,C.car); rr(g,x-s*0.3,y-s*0.3,s*0.55,s*0.26,s*0.08,C.car2); rr(g,x-s*0.26,y-s*0.27,s*0.22,s*0.17,s*0.03,C.glass); rr(g,x+0.0,y-s*0.27,s*0.2,s*0.17,s*0.03,C.glass); [x-s*0.28,x+s*0.28].forEach(wx=>{ circ(g,wx,y+s*0.2,s*0.11,C.tire); circ(g,wx,y+s*0.2,s*0.05,C.rim); }); circ(g,x+s*0.47,y+s*0.02,s*0.03,C.sun); },
    book(g,x,y,s){ rr(g,x-s*0.33,y-s*0.42,s*0.7,s*0.84,s*0.03,C.book2); rr(g,x-s*0.3,y-s*0.42,s*0.67,s*0.8,s*0.03,C.book); g.fillStyle=C.page; g.fillRect(x+s*0.33,y-s*0.38,s*0.04,s*0.76); rr(g,x-s*0.2,y-s*0.3,s*0.42,s*0.05,s*0.02,C.cream); rr(g,x-s*0.2,y-s*0.2,s*0.3,s*0.04,s*0.02,C.cream); },
    coffee(g,x,y,s){ ell(g,x,y+s*0.32,s*0.45,s*0.09,C.cup2); rr(g,x-s*0.28,y-s*0.15,s*0.56,s*0.46,s*0.08,C.cup); ell(g,x,y-s*0.15,s*0.28,s*0.07,C.coffee); g.strokeStyle=C.cup2; g.lineWidth=Math.max(2,s*0.06); g.beginPath(); g.arc(x+s*0.34,y+s*0.05,s*0.12,-Math.PI/2,Math.PI/2); g.stroke(); g.strokeStyle=C.grey; g.lineWidth=Math.max(1,s*0.025); [-0.12,0,0.12].forEach(k=>{ g.beginPath(); g.moveTo(x+k*s,y-s*0.22); g.quadraticCurveTo(x+k*s+s*0.06,y-s*0.32,x+k*s,y-s*0.42); g.stroke(); }); },
    shoe(g,x,y,s){ rr(g,x-s*0.5,y+s*0.08,s,s*0.14,s*0.06,C.sole); g.fillStyle=C.shoe; g.beginPath(); g.moveTo(x-s*0.48,y+s*0.1); g.lineTo(x-s*0.45,y-s*0.25); g.quadraticCurveTo(x-s*0.2,y-s*0.3,x+s*0.05,y-s*0.1); g.quadraticCurveTo(x+s*0.3,y-s*0.02,x+s*0.5,y+s*0.1); g.closePath(); g.fill(); g.strokeStyle=C.cream; g.lineWidth=Math.max(1,s*0.02); for(let k=0;k<4;k++){ g.beginPath(); g.moveTo(x-s*0.32+k*s*0.07,y-s*0.15+k*s*0.02); g.lineTo(x-s*0.2+k*s*0.07,y-s*0.2+k*s*0.02); g.stroke(); } tri(g,[x-s*0.1,y+s*0.08],[x+s*0.2,y-s*0.04],[x+s*0.25,y+s*0.08],C.shoe2); },
    person(g,x,y,s){ circ(g,x,y-s*0.3,s*0.13,C.fur); rr(g,x-s*0.16,y-s*0.15,s*0.32,s*0.36,s*0.06,C.bar2); rr(g,x-s*0.14,y+0.2*s,s*0.12,s*0.3,s*0.03,C.shoe); rr(g,x+s*0.02,y+0.2*s,s*0.12,s*0.3,s*0.03,C.shoe); },

    /* ---- 場景級：鏡頭模組（瑕疵）、文件頁、偽裝、組織 ---- */
    lens(g,w,h,defects=[]){ pic.plain(g,w,h,C.metal2); rr(g,w*0.05,h*0.08,w*0.9,h*0.84,w*0.03,C.metal); circ(g,w*0.5,h*0.5,Math.min(w,h)*0.36,C.lens); circ(g,w*0.5,h*0.5,Math.min(w,h)*0.3,C.lens2); circ(g,w*0.5,h*0.5,Math.min(w,h)*0.2,C.lens); circ(g,w*0.42,h*0.42,Math.min(w,h)*0.05,'#A9C6E6'); for(let k=0;k<4;k++) circ(g,w*(0.1+0.8*(k%2)),h*(0.16+0.68*Math.floor(k/2)),w*0.02,C.grey2);
      defects.forEach(d=>{ if(d.kind==='scratch'){ line(g,[d.x-d.w*0.45,d.y+d.h*0.3],[d.x+d.w*0.45,d.y-d.h*0.3],'#DCE6F2',Math.max(1.5,d.h*0.06)); line(g,[d.x-d.w*0.3,d.y+d.h*0.35],[d.x+d.w*0.4,d.y-d.h*0.15],'#B9C9DC',1); } else if(d.kind==='spot'){ ell(g,d.x,d.y,d.w*0.3,d.h*0.3,'#0E1419'); ell(g,d.x-d.w*0.08,d.y-d.h*0.06,d.w*0.1,d.h*0.1,'#2A3440'); } else { g.strokeStyle='#D6E4F2'; g.lineWidth=Math.max(1.5,d.h*0.08); g.beginPath(); g.ellipse(d.x,d.y,d.w*0.3,d.h*0.3,0,0,Math.PI*2); g.stroke(); circ(g,d.x-d.w*0.1,d.y-d.h*0.1,d.w*0.05,'#F2F7FC'); } }); },
    page(g,w,h,o={}){ const kind=o.kind||'text', fade=o.faded?C.text2:null; pic.plain(g,w,h,C.paper); g.strokeStyle='#D9D5CC'; g.lineWidth=1; g.strokeRect(0.5,0.5,w-1,h-1); const m=w*0.1; let y=h*0.1;
      const title=o.title!==false; if(title){ rr(g,m,y,w*0.5,h*0.05,2,C.text); y+=h*0.1; }
      const lines=(n,len=1)=>{ for(let i=0;i<n;i++){ rr(g,m,y,(w-2*m)*(i===n-1?0.6:len),h*0.025,1.5,C.text2); y+=h*0.045; } };
      if(kind==='cover'){ y=h*0.3; rr(g,m,y,w*0.7,h*0.08,3,C.text); y+=h*0.14; lines(2,0.7); }
      else if(kind==='text'){ lines(6); y+=h*0.03; lines(5); }
      else if(kind==='table'){ lines(2); y+=h*0.02; const rows=5, cols=3, cw=(w-2*m)/cols, rh=h*0.06; for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){ g.fillStyle=fade?'#E8E6E1':(r===0?C.table2:C.table); g.fillRect(m+c*cw+1,y+r*rh+1,cw-2,rh-2); if(!fade&&r>0) rr(g,m+c*cw+cw*0.2,y+r*rh+rh*0.35,cw*0.6,rh*0.25,1,C.text2); } y+=rows*rh+h*0.03; lines(2); }
      else if(kind==='chart'){ lines(1); y+=h*0.02; const bh=h*0.34, bw=(w-2*m)/5; [0.5,0.9,0.65,0.35,0.75].forEach((v,i)=>{ g.fillStyle=fade?'#E8E6E1':(i%2?C.bar2:C.bar); g.fillRect(m+i*bw+bw*0.15,y+bh*(1-v),bw*0.7,bh*v); }); g.strokeStyle=fade?'#E0DDD6':C.text2; g.beginPath(); g.moveTo(m,y+bh); g.lineTo(w-m,y+bh); g.stroke(); y+=bh+h*0.04; lines(3); }
      else if(kind==='manual'){ lines(3); y+=h*0.02; rr(g,m,y,w*0.8,h*0.12,2,fade||C.table); y+=h*0.15; lines(4); } },
    camo(g,w,h,b){ pic.plain(g,w,h,C.leaf2); for(let i=0;i<90;i++){ const x=hashed(i+11)*w, y=hashed(i*47+3)*h, s=w*(0.06+hashed(i*13+5)*0.08); ell(g,x,y,s,s*0.45,i%3?C.leaf:C.leaf3,hashed(i*29+9)*Math.PI); }
      ell(g,b.cx,b.cy,b.rx,b.ry,C.lizard); ell(g,b.cx+b.rx*0.75,b.cy-b.ry*0.1,b.rx*0.3,b.ry*0.45,C.lizard); for(let i=0;i<10;i++) circ(g,b.cx-b.rx*0.7+i*b.rx*0.15,b.cy+(i%2?-1:1)*b.ry*0.3,b.ry*0.1,C.leaf2); circ(g,b.cx+b.rx*0.85,b.cy-b.ry*0.3,b.ry*0.09,C.ink); g.strokeStyle=C.lizard; g.lineWidth=Math.max(2,b.ry*0.18); g.beginPath(); g.moveTo(b.cx-b.rx*0.9,b.cy); g.quadraticCurveTo(b.cx-b.rx*1.5,b.cy+b.ry*0.6,b.cx-b.rx*1.7,b.cy-b.ry*0.4); g.stroke(); },
    tissue(g,w,h,b){ const bg=g.createRadialGradient(w*0.5,h*0.5,w*0.1,w*0.5,h*0.5,w*0.8); bg.addColorStop(0,C.tissue); bg.addColorStop(1,C.tissue2); g.fillStyle=bg; g.fillRect(0,0,w,h); g.strokeStyle='#D9A09B'; g.lineWidth=1.5; for(let i=0;i<8;i++){ g.beginPath(); g.moveTo(0,h*(0.1+i*0.12)); g.quadraticCurveTo(w*0.5,h*(0.1+i*0.12)+h*0.05*(i%2?1:-1),w,h*(0.1+i*0.12)); g.stroke(); }
      const sh=g.createRadialGradient(b.cx-b.rx*0.3,b.cy-b.ry*0.3,b.rx*0.1,b.cx,b.cy,Math.max(b.rx,b.ry)); sh.addColorStop(0,'#E09490'); sh.addColorStop(0.7,C.polyp); sh.addColorStop(1,C.polyp2); g.fillStyle=sh; g.beginPath(); g.ellipse(b.cx,b.cy,b.rx,b.ry,0,0,Math.PI*2); g.fill(); },
  };

  class Picture{
    constructor(w,h,o={}){ this.w=w; this.h=h; this.px=o.px||256; this.py=o.py||Math.max(8,Math.round(this.px*h/w));
      const cv=document.createElement('canvas'); cv.width=this.px; cv.height=this.py; this.canvas=cv; this.g=cv.getContext('2d',{willReadFrequently:true}); // 會常用 getImageData 取樣
      this.tex=new T.CanvasTexture(cv); this.tex.anisotropy=4;
      this.mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:this.tex,toneMapped:false})); // 不透明：圖後面的格子與地面網格才不會透出來
      this.mesh.userData.picture=this; if(o.draw) this.draw(o.draw); }
    draw(fn){ this.g.save(); fn(this.g,this.px,this.py,pic); this.g.restore(); this.tex.needsUpdate=true; return this; }
    clear(){ this.g.clearRect(0,0,this.px,this.py); this.tex.needsUpdate=true; return this; }
    /* 取樣成 N×M 的亮度（0～1，列優先）：像素格場景從「真的圖」拿值 */
    lum(N,M=N){ const d=this.g.getImageData(0,0,this.px,this.py).data; const out=[]; for(let r=0;r<M;r++) for(let c=0;c<N;c++){ const x0=Math.floor(c/N*this.px), x1=Math.max(x0+1,Math.floor((c+1)/N*this.px)), y0=Math.floor(r/M*this.py), y1=Math.max(y0+1,Math.floor((r+1)/M*this.py)); let s=0,n=0; for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){ const i=(y*this.px+x)*4; s+=(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2])*(d[i+3]/255); n++; } out.push(s/n/255); } return out; }
    /* 把現在的畫面和高斯噪聲混合：level 0 = 原圖、1 = 純噪聲（擴散場景用） */
    noise(level,seed=1){ const img=this.g.getImageData(0,0,this.px,this.py); const d=img.data; let s=seed*7919+13; const rnd=()=>{ s=(s*9301+49297)%233280; return s/233280; }; const a=Math.max(0,Math.min(1,level));
      for(let i=0;i<d.length;i+=4){ let z=0; for(let k=0;k<3;k++) z+=rnd(); const nv=(z/3)*255; d[i]=d[i]*(1-a)+nv*a; d[i+1]=d[i+1]*(1-a)+nv*a; d[i+2]=d[i+2]*(1-a)+nv*a; d[i+3]=255; } this.g.putImageData(img,0,0); this.tex.needsUpdate=true; return this; }
    blur(px){ if(!px){ return this; } const tmp=document.createElement('canvas'); tmp.width=this.px; tmp.height=this.py; tmp.getContext('2d').drawImage(this.canvas,0,0); this.g.save(); this.g.filter=`blur(${px}px)`; this.g.drawImage(tmp,0,0); this.g.restore(); this.tex.needsUpdate=true; return this; }
    tint(color){ const m=this.mesh.material; if(color) m.color.copy(P.C(color)); else m.color.setRGB(1,1,1); return this; }
    dispose(){ this.tex.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
  }
  P.Picture=Picture; P.pic=pic; P.PIC=C;
})();
