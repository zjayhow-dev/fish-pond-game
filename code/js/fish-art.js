(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  function ellipse(ctx, x, y, rx, ry, color, angle = 0) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, angle, 0, TAU); ctx.fill();
  }
  // One renderer shared by the live school and atlas: colors and silhouettes cannot drift.
  function draw(ctx, variety, size, phase = 0, variation = 0) {
    const width = variety.form === 'round' ? .43 : variety.form === 'slender' ? .23 : .32;
    const long = variety.form === 'butterfly', tailEnd = long ? -1.95 : -1.35;
    const sway = Math.sin(phase) * .14, opacity = ctx.globalAlpha;
    ctx.save(); ctx.scale(size, size);
    ctx.fillStyle = variety.body;
    ctx.globalAlpha = opacity * .72;
    ctx.beginPath(); ctx.moveTo(-.65, 0);
    ctx.bezierCurveTo(-1, sway - .12, tailEnd + .22, sway - .58, tailEnd, sway - .34);
    ctx.quadraticCurveTo(tailEnd + .28, sway, tailEnd, sway + .34);
    ctx.bezierCurveTo(tailEnd + .22, sway + .58, -1, sway + .12, -.65, 0); ctx.fill();
    ctx.strokeStyle = variety.accent; ctx.lineWidth = .014;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-.73,0); ctx.quadraticCurveTo(-1.1,sway + i * .07,tailEnd + .12,sway + i * .14); ctx.stroke(); }
    for (const side of [-1,1]) {
      ctx.beginPath(); ctx.moveTo(.23,side * width * .65);
      ctx.bezierCurveTo(.1,side * (long ? .95 : .65),long ? -.9 : -.45,side * (long ? .72 : .4),-.2,side * width * .5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-.25,side * width*.6); ctx.quadraticCurveTo(-.55,side*.48,-.65,side*.25); ctx.fill();
    }
    ctx.globalAlpha = opacity;
    ctx.beginPath(); ctx.moveTo(.98,0); ctx.bezierCurveTo(.86,-width*1.25,-.05,-width*1.35,-.84,0); ctx.bezierCurveTo(-.05,width*1.35,.86,width*1.25,.98,0); ctx.closePath();
    ctx.fillStyle=variety.body; ctx.fill(); ctx.save(); ctx.clip();
    const mark = variety.marking, accent = variety.accent;
    const spots = () => { for (let i=0;i<18;i++) ellipse(ctx,-.63+(i*.31)%1.5,Math.sin(i*2.4+variation)*width*.72,.035+(i%3)*.015,.03, i%4 ? mark:accent); };
    const net = () => {
      ctx.strokeStyle=mark;ctx.lineWidth=.016;ctx.globalAlpha=opacity*.7;
      for(let row=-2;row<=2;row++) for(let col=0;col<9;col++) {
        const x=-.7+col*.19+(row%2)*.09,y=row*width*.32;
        ctx.beginPath();ctx.arc(x,y,.1,-1.15,1.15);ctx.stroke();
      } ctx.globalAlpha=opacity;
    };
    switch(variety.pattern) {
      case 'islands':
        ellipse(ctx,.58,-.03,.23,width*.8,mark,.2);ellipse(ctx,.04,.07,.25,width*.8,mark,-.6);ellipse(ctx,-.49,-.03,.14,width*.68,mark,.35);break;
      case 'crown': ellipse(ctx,.6,0,.18,width*.62,mark);break;
      case 'speckles': spots();break;
      case 'net': net();break;
      case 'bands':
        for(let i=0;i<3;i++){ctx.fillStyle=mark;ctx.beginPath();ctx.moveTo(-.6+i*.52,-.6);ctx.lineTo(-.35+i*.52,-.6);ctx.lineTo(-.08+i*.52,.6);ctx.lineTo(-.33+i*.52,.6);ctx.fill();}break;
      case 'back':
        ellipse(ctx,.1,0,.74,width*.37,mark);ellipse(ctx,.28,0,.45,width*.15,accent);break;
      case 'tricolor':
        ellipse(ctx,.55,-.08,.29,width,mark,.4);ellipse(ctx,-.34,.06,.28,width*.8,mark,-.5);
        ellipse(ctx,.05,.13,.18,width*.62,accent);ellipse(ctx,-.55,-.12,.14,width*.8,accent);ellipse(ctx,.64,.2,.13,.12,accent);if(variety.name==='孔雀')net();break;
      case 'sides':
        for(const side of [-1,1])ellipse(ctx,.05,side*width*.77,.9,width*.4,mark);net();break;
      case 'petals':
        for(let i=0;i<9;i++)ellipse(ctx,-.52+(i*.29)%1.3,Math.sin(i*2.1)*width*.65,.1,.055,i%3?mark:accent,i*.9);break;
      case 'marble':
        ctx.strokeStyle=mark;ctx.lineWidth=.17;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(-1,i*.25);ctx.bezierCurveTo(-.3,-.5+i*.3,.1,.5+i*.1,1,i*.2);ctx.stroke();}break;
      case 'stars':
        spots();for(let i=0;i<4;i++){const x=-.4+i*.34,y=Math.sin(i*3)*width*.6;ctx.strokeStyle=accent;ctx.lineWidth=.018;ctx.beginPath();ctx.moveTo(x-.07,y);ctx.lineTo(x+.07,y);ctx.moveTo(x,y-.06);ctx.lineTo(x,y+.06);ctx.stroke();}break;
      case 'cloud':
        ['#cb665d','#c9a24e','#4b9997','#9b7db5'].forEach((color,i)=>{ellipse(ctx,-.45+i*.35,Math.sin(i*2)*.13,.27,.18,color,i*.7);});break;
      case 'dragon':
        net();ellipse(ctx,.65,0,.17,.14,accent);ctx.strokeStyle=mark;ctx.lineWidth=.075;ctx.beginPath();ctx.moveTo(-.8,0);ctx.bezierCurveTo(-.3,.2,.2,-.18,.6,0);ctx.stroke();break;
    }
    // A translucent sheen preserves dark, blue and green bases instead of painting them cream.
    const sheen=ctx.createLinearGradient(0,-width,0,width);
    sheen.addColorStop(0,'rgba(0,20,25,.3)');sheen.addColorStop(.42,'rgba(255,255,245,.22)');sheen.addColorStop(1,'rgba(0,20,25,.28)');
    ctx.fillStyle=sheen;ctx.fillRect(-1,-.6,2.1,1.2);
    ctx.strokeStyle='rgba(255,255,240,.25)';ctx.lineWidth=.018;ctx.beginPath();ctx.moveTo(.6,0);ctx.quadraticCurveTo(0,-.04,-.6,0);ctx.stroke();
    ctx.restore();
    for(const side of [-1,1]){ellipse(ctx,.75,side*width*.48,.037,.031,'#142d2c');ellipse(ctx,.76,side*width*.48,.012,.01,'#e9edce');}
    ctx.strokeStyle='rgba(40,65,55,.45)';ctx.lineWidth=.016;
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(.52,side*width*.75);ctx.quadraticCurveTo(.37,side*width*.4,.48,side*.06);ctx.stroke();}
    ctx.restore();
  }
  function preview(canvas, variety, locked = false) {
    const ctx=canvas.getContext('2d'); if(!ctx)return;
    const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.save();
    ctx.translate(w*.56,h*.5);ctx.rotate(-.13);ctx.globalAlpha=locked ? .42 : 1;
    draw(ctx,variety,Math.min(w/3.65,h/1.6)*(variety.size/70*.35+.65),.5);ctx.restore();
  }
  root.PondFishArt=Object.freeze({draw,preview});
})(globalThis);
