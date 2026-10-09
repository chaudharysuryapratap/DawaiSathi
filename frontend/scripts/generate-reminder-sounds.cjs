/* global __dirname, Buffer */
// Original synthesized preview tones, without third-party media.
const fs = require('node:fs'), path = require('node:path');
const target = path.resolve(__dirname, '../assets/sounds');
fs.mkdirSync(target, {recursive:true});
for (const [name, frequencies] of Object.entries({ gentle:[660,880], chime:[523,659,784], bell:[880,1320], soft:[440,554] })) {
  const rate=22050, count=26460, data=Buffer.alloc(44+count*2);
  data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(count*2,40);
  for(let i=0;i<count;i++){const t=i/rate,envelope=Math.min(1,t/0.02)*Math.exp(-4*t);const wave=frequencies.reduce((v,h)=>v+Math.sin(2*Math.PI*h*t),0)/frequencies.length;data.writeInt16LE(Math.round(wave*envelope*6500),44+i*2);}
  fs.writeFileSync(path.join(target,name+'.wav'),data);
}
