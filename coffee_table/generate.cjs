const fs = require('fs');
const p = [[0,0],[153,0],[155,.7],[156,2],[156,4],[150,235],[149.5,247],[148,257],[145,266],[141,274],[135,282],[127,289],[117,295],[106,301],[94,307],[85,313],[78,320],[73,328],[70.5,336],[70,345],[70,421],[71,425],[74,428],[228,428],[242,430],[248,432],[250,434],[250,436],[246,456],[245,459],[243,460],[241,459.5],[239.5,457.5],[237,447],[234,443],[230,440.5],[225,439.5],[218,439],[0,439]];
const n=96, v=[], f=[];
const rings=p.map(([r,z])=>Array.from({length:r?n:1},(_,i)=>v.push([+(r*Math.cos(i*2*Math.PI/n)).toFixed(6),+(r*Math.sin(i*2*Math.PI/n)).toFixed(6),z])));
for(let j=1;j<rings.length;j++) for(let i=0;i<n;i++){
 const a=rings[j-1], b=rings[j], k=(i+1)%n;
 f.push(a.length===1?[a[0],b[k],b[i]]:b.length===1?[a[i],a[k],b[0]]:[a[i],a[k],b[k],b[i]]);
}
const tri=[], hidden=[];
for(const a of f) if(a.length===3)tri.push(a); else {
 hidden.push(tri.length+1);
 tri.push([a[0],a[1],a[2]],[a[0],a[2],a[3]]);
}
const list=a=>a.map(x=>'['+x+']').join(',\n');
const dir=process.argv[2];
fs.writeFileSync(dir+'/Coffee_Table.obj',['# Millimeters, Z up','o Coffee_Table',...v.map(x=>'v '+x.join(' ')),'s 1',...f.map(x=>'f '+x.join(' '))].join('\n')+'\n');
fs.writeFileSync(dir+'/build.ms',[
'resetMaxFile #noPrompt','units.SystemType = #millimeters','units.SystemScale = 1.0','units.DisplayType = #metric','units.MetricType = #millimeters',
'(',
'local obj = mesh name:"Coffee_Table_500x500x460" vertices:#('+list(v)+') faces:#('+list(tri)+')',
'for i in #('+hidden.join(',')+') do (setEdgeVis obj i 3 false; setEdgeVis obj (i+1) 1 false)',
'for i = 1 to (getNumFaces obj) do setFaceSmoothGroup obj i 1',
'update obj','convertToPoly obj','obj.wirecolor = color 70 70 70',
'local mat = standardMaterial name:"Satin Black" diffuse:(color 36 36 36) specularLevel:65 glossiness:45',
'obj.material = mat',
'try (local corona = CoronaPhysicalMtl name:"Satin Black"; corona.baseColor = color 36 36 36; corona.baseRoughness = 0.38; obj.material = corona) catch()',
'select obj','max zoomext sel all',
'saveMaxFile "'+dir+'/Coffee_Table.max" quiet:true',
'exportFile "'+dir+'/Coffee_Table.fbx" #noPrompt selectedOnly:true using:FBXEXP',')'].join('\n'));
