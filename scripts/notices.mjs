import fs from 'node:fs';
import path from 'node:path';
const roots=[];for(const name of fs.readdirSync('node_modules')){if(name.startsWith('.'))continue;const p=path.join('node_modules',name);if(name.startsWith('@')){for(const sub of fs.readdirSync(p))roots.push(path.join(p,sub));}else roots.push(p);}
let text='Third-party software notices\nVersions are those used by this build. Build-only dependencies may also be listed.\n\n';
for(const p of roots){try{const pkg=JSON.parse(fs.readFileSync(path.join(p,'package.json'),'utf8'));text+=`\n${'='.repeat(70)}\n${pkg.name} ${pkg.version}\nDeclared license: ${typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license||'see package')}\n`;for(const name of fs.readdirSync(p)){if(/^(license|licence|copying|notice)(\.|$)/i.test(name)&&fs.statSync(path.join(p,name)).isFile())text+='\n'+fs.readFileSync(path.join(p,name),'utf8')+'\n';}}catch{}}
fs.mkdirSync('release/win-unpacked/resources',{recursive:true});fs.writeFileSync('release/win-unpacked/resources/third-party-licenses.txt',text);console.log('Third-party notices saved');
