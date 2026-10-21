import * as THREE from './vendor/three.module.js';

// One address, three commercial stages. The pavilion remains intact as it grows.
// Proportions describe an architectural model, not a construction specification.
export function createCinematicBuilding(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const stone = new THREE.MeshStandardMaterial({color:0x99958c,roughness:.66,envMapIntensity:.65});
  const porcelain = new THREE.MeshStandardMaterial({color:0xbebeb4,roughness:.42,envMapIntensity:.8});
  const recess = new THREE.MeshStandardMaterial({color:0x323b38,roughness:.84});
  const aluminium = new THREE.MeshStandardMaterial({color:0x383b3b,roughness:.22,metalness:.92});
  const glass = new THREE.MeshPhysicalMaterial({color:0xffffff,transmission:1,roughness:.035,thickness:.065,ior:1.46,metalness:0,clearcoat:1,envMapIntensity:2.1});
  const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=256;
  const grainContext=grainCanvas.getContext('2d'),grain=grainContext.createImageData(256,256);
  // Periodic, multiscale mineral texture; no repeated stripe or photographic asset.
  const lattice=new Float32Array(256*256);let seed=41;
  for(let i=0;i<lattice.length;i++){seed=(seed*1664525+1013904223)>>>0;lattice[i]=seed/4294967295;}
  const sample=(x,y)=>lattice[((y%256+256)%256)*256+(x%256+256)%256];
  function noise(x,y,period){
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(sample(ix%period,iy%period),sample((ix+1)%period,iy%period),u),THREE.MathUtils.lerp(sample(ix%period,(iy+1)%period),sample((ix+1)%period,(iy+1)%period),u),v);
  }
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const mineral=noise(x/64,y/64,4)*.3+noise(x/16,y/16,16)*.35+noise(x/4,y/4,64)*.2+sample(x,y)*.15;
    const v=Math.round(200+mineral*38);grain.data.set([v,v,v,255],(y*256+x)*4);
  }
  grainContext.putImageData(grain,0,0);
  const grainTexture=new THREE.CanvasTexture(grainCanvas);grainTexture.wrapS=grainTexture.wrapT=THREE.RepeatWrapping;grainTexture.repeat.set(2,2);
  stone.map=grainTexture;stone.bumpMap=grainTexture;stone.bumpScale=.006;porcelain.bumpMap=grainTexture;porcelain.bumpScale=.0015;
  const ceilingLight=new THREE.MeshBasicMaterial({color:new THREE.Color(0xffecda).multiplyScalar(3.2)});
  const cube = new THREE.BoxGeometry(1,1,1);
  const levels = [];
  const paving = [];
  const smooth = THREE.MathUtils.smoothstep;
  function prepareReveal(group) {
    const materials=new Map();
    group.traverse(object=>{
      if(!object.isMesh)return;
      if(!materials.has(object.material)) materials.set(object.material,object.material.clone());
      object.material=materials.get(object.material);
    });
    group.userData.revealMaterials=[...materials.values()];
  }
  function reveal(group,amount) {
    group.visible=amount>.001;
    for(const material of group.userData.revealMaterials) {
      const transparent=amount<.999;
      if(material.transparent!==transparent) {material.transparent=transparent;material.needsUpdate=true;}
      material.opacity=amount;material.depthWrite=!transparent;
    }
  }

  function box(parent,w,h,d,x,y,z,material=porcelain) {
    if((material===stone||material===porcelain)&&Math.min(w,h,d)>.04)return slab(parent,w,h,d,x,y,z,material);
    const mesh = new THREE.Mesh(cube,material);
    mesh.scale.set(w,h,d);mesh.position.set(x,y,z);
    mesh.castShadow = material !== glass;mesh.receiveShadow = material !== glass;
    parent.add(mesh);return mesh;
  }
  function slab(parent,w,h,d,x,y,z,material=porcelain) {
    // Real, very small bevels catch the light without rounding the architecture.
    const bevel=Math.min(.012,h/6),shape=new THREE.Shape();
    shape.moveTo(-w/2+bevel,-d/2+bevel);shape.lineTo(w/2-bevel,-d/2+bevel);
    shape.lineTo(w/2-bevel,d/2-bevel);shape.lineTo(-w/2+bevel,d/2-bevel);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:h-2*bevel,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:1});
    geometry.rotateX(-Math.PI/2);geometry.translate(0,-(h-2*bevel)/2,0);
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function line(parent,points,opacity=.24) {
    const object=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0x777f79,transparent:true,opacity}));
    parent.add(object);return object;
  }

  // The beginning is a precise foundation, with the future entrance already legible.
  slab(root,4.9,.16,3.14,0,-.07,0,stone);
  slab(root,4.66,.065,2.94,0,.035,0);
  const plan=new THREE.Group();root.add(plan);
  for(const x of [-1.93,-.66,.62,1.91]) line(plan,[[x,.071,-1.15],[x,.071,1.12]]);
  for(const z of [-1.13,1.12]) line(plan,[[-1.96,.071,z],[1.94,.071,z]]);
  for(const x of [-1.94,.6,1.92]) for(const z of [-1.12,1.12]) box(root,.18,.018,.18,x,.073,z,stone);
  // The same threshold is present from the foundation to the final ensemble.
  slab(root,1.48,.065,.46,.63,.035,1.68,stone);

  function makeLevel({base,left,right,back,front,entry=false}) {
    const structure=new THREE.Group(),enclosure=new THREE.Group(),cap=new THREE.Group();
    structure.position.y=enclosure.position.y=cap.position.y=base;
    root.add(structure,enclosure,cap);
    const height=1.13,span=right-left,depth=front-back,cx=(left+right)/2,cz=(front+back)/2;
    // A solid service core and a glazed working space give the pavilion a front.
    box(structure,.55,height,.76,left+.29,height/2,back+.39,stone);
    box(structure,1.04,height,.13,left+.55,height/2,back+.03,stone);
    for(const x of [left,right]) for(const z of [back,front]) box(structure,.075,height,.075,x,height/2,z);
    box(structure,.055,height,.065,left+span/2,height/2,back);
    // An inset soffit and a separate fascia make the roof read as a thin plane.
    slab(cap,span+.62,.105,depth+.58,cx,height+.07,cz);
    box(cap,span+.45,.027,depth+.40,cx,height+.004,cz,recess);
    slab(cap,span+.48,.016,depth+.44,cx,height+.132,cz,stone);

    function glazing(x0,x1,z,door=false) {
      const width=x1-x0,center=(x0+x1)/2;
      box(enclosure,width-.025,height-.065,.018,center,height/2,z,glass);
      for(const x of [x0,x1]) box(enclosure,.016,height,.025,x,height/2,z,aluminium);
      for(const y of [.018,height-.012]) box(enclosure,width,.019,.026,center,y,z,aluminium);
      if(door) box(enclosure,.012,.22,.038,x1-.105,.54,z+.031,aluminium);
    }
    if(entry) {
      // A recessed portal, no lettering. The later path meets this exact opening.
      const doorLeft=.05,doorRight=1.21,doorZ=front-.28;
      glazing(left,-.68,front);glazing(-.68,doorLeft,front);glazing(doorRight,right,front);
      glazing(doorLeft,.63,doorZ,true);glazing(.63,doorRight,doorZ,true);
      for(const x of [doorLeft,doorRight]) {
        box(structure,.075,height,.36,x,height/2,front-.105,stone);
        box(enclosure,.018,height-.04,.27,x,height/2,front-.14,glass);
      }
      slab(structure,1.2,.022,.48,.63,.011,front-.02,stone);
      box(enclosure,1.12,.026,.055,.63,height-.07,doorZ,porcelain);
    } else {
      for(let i=0;i<4;i++) glazing(left+span*i/4,left+span*(i+1)/4,front);
    }
    // Fine mullions have a common structural rhythm on every storey.
    for(const x of [left,right]) {
      for(let i=0;i<3;i++) {
        const z=back+depth*(i+.5)/3;
        box(enclosure,.018,height-.06,depth/3-.025,x,height/2,z,glass);
        box(enclosure,.025,height,.016,x,height/2,back+depth*i/3,aluminium);
      }
      for(const y of [.018,height-.012]) box(enclosure,.026,.019,depth,x,y,cz,aluminium);
    }
    for(let i=1;i<4;i++) glazing(left+span*i/4,left+span*(i+1)/4,back);
    // Repeated narrow reveals add scale without props, miniature people or furniture.
    for(let i=0;i<6;i++) box(structure,.018,height,.009,left+.05+i*.075,height/2,back+.78,recess);
    // Thin ceiling light gives the glazed space depth, without sign-like accents.
    box(structure,span-.25,.009,.025,cx,height-.04,back+.30,ceilingLight);
    box(structure,span-.30,.007,.018,cx,height-.04,front-.22,ceilingLight);
    const interiorLight=new THREE.PointLight(0xffead5,2.2,3.4,2);
    interiorLight.position.set(cx,height-.13,cz);structure.add(interiorLight);
    for(const group of [structure,enclosure,cap]) prepareReveal(group);
    const level={base,structure,enclosure,cap};levels.push(level);return level;
  }
  makeLevel({base:.086,left:-1.94,right:1.94,back:-1.13,front:1.12,entry:true});
  makeLevel({base:1.357,left:-1.94,right:1.94,back:-1.13,front:1.12});
  makeLevel({base:2.628,left:-1.94,right:.96,back:-1.13,front:.58});

  const terrace=new THREE.Group();terrace.position.y=2.628;root.add(terrace);
  box(terrace,3.88,.30,.018,0,.15,1.17,glass);
  box(terrace,3.94,.017,.022,0,.31,1.17,aluminium);
  box(terrace,.018,.30,2.30,1.99,.15,.02,glass);
  box(terrace,.022,.017,2.33,1.99,.31,.02,aluminium);
  for(const x of [-1.94,0,1.98]) box(terrace,.015,.31,.025,x,.15,1.17,aluminium);

  // Four flush stone planes establish access. No roadway, arrows or moving symbols.
  // They appear from the foreground towards the existing entrance.
  for(let i=0;i<4;i++) {
    const group=new THREE.Group();root.add(group);
    const z=4.66-i*.79;
    slab(group,1.48,.11,.755,.63,-.005,z,stone);
    prepareReveal(group);
    paving.push(group);
  }
  const forecourt=new THREE.Group();root.add(forecourt);
  for(const x of [-.37,1.63]) slab(forecourt,.48,.11,.755,x,-.005,2.29,stone);
  prepareReveal(forecourt);
  // Growth order: first the storeys, then the way widens. A second row of the same
  // stone planes continues the forecourt on both sides, from the house outwards.
  const widening=[];
  for(let i=0;i<3;i++) {
    const group=new THREE.Group();root.add(group);
    const z=3.08+i*.79;
    for(const x of [-.37,1.63]) slab(group,.48,.11,.755,x,-.005,z,stone);
    prepareReveal(group);
    widening.push(group);
  }

  function assemble(level,amount) {
    const frame=smooth(amount,0,.48),walls=smooth(amount,.20,.78),roof=smooth(amount,.42,1);
    reveal(level.structure,smooth(frame,0,.3));
    reveal(level.enclosure,smooth(walls,0,.3));
    reveal(level.cap,smooth(roof,0,.3));
    // Small, firm placements; the material never elastically stretches into a storey.
    level.structure.position.y=level.base+(1-frame)*.18;
    level.enclosure.position.set(0,level.base, (1-walls)*.12);
    level.cap.position.y=level.base+(1-roof)*.28;
  }
  function update(timeline) {
    const pavilion=1;
    const access=smooth(timeline,1.18,1.92);
    const growth=smooth(timeline,2.10,2.98);
    assemble(levels[0],pavilion);
    assemble(levels[1],smooth(growth,0,.58));
    assemble(levels[2],smooth(growth,.38,1));
    plan.visible=pavilion<.7;
    plan.children.forEach(o=>{o.material.opacity=(1-pavilion)*.24;});
    paving.forEach((group,i)=>{
      const t=smooth(access,i*.16,.5+i*.16);
      reveal(group,smooth(t,0,.45));group.position.y=-(1-t)*.085;
    });
    const apron=smooth(growth,.15,.7);
    reveal(forecourt,smooth(apron,0,.45));forecourt.position.y=-(1-apron)*.085;
    terrace.visible=growth>.94;
    // Starts only once the storeys stand (growth completes at 2.98).
    const broadening=smooth(timeline,2.98,3.5);
    widening.forEach((group,i)=>{
      const t=smooth(broadening,i*.22,.56+i*.22);
      reveal(group,smooth(t,0,.45));group.position.y=-(1-t)*.085;
    });
    return {pavilion,access,growth,broadening,storeys:growth>.98?3:growth>.04?2:pavilion>.01?1:0};
  }
  update(0);
  // Visits every shader-relevant combination the scroll can reach (number of interior lights x opaque or
  // fading materials), so all programs can be built ahead of time. Afterwards the start state is restored.
  async function eachVariant(visit) {
    const fading=[...levels.flatMap(level=>[level.structure,level.enclosure,level.cap]),...paving,forecourt,...widening];
    for(const lights of [1,2,3]) for(const transparent of [false,true]) {
      levels.forEach((level,i)=>{level.structure.visible=i<lights;});
      for(const group of fading) for(const material of group.userData.revealMaterials) {material.transparent=transparent;material.needsUpdate=true;}
      await visit();
    }
    for(const group of fading) for(const material of group.userData.revealMaterials) {material.transparent=false;material.needsUpdate=true;}
    update(0);
  }
  return {root,update,eachVariant};
}
