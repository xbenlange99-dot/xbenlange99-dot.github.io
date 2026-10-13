import * as THREE from './vendor/three.module.js';

// One lighting environment for the building, its reflections and the ground.
export function createCinematicWorld(scene,renderer) {
  const background=new THREE.Color(0x171d1f);
  scene.background=background;scene.fog=new THREE.FogExp2(background,.10);
  const studio=new THREE.Scene();studio.background=new THREE.Color(0x11191f);
  const panelGeometry=new THREE.PlaneGeometry(1,1);
  const lightCanvas=document.createElement('canvas');lightCanvas.width=lightCanvas.height=128;
  const lightContext=lightCanvas.getContext('2d'),lightGradient=lightContext.createRadialGradient(64,64,8,64,64,68);
  lightGradient.addColorStop(0,'#ffffff');lightGradient.addColorStop(.5,'#bbbbbb');lightGradient.addColorStop(1,'#000000');
  lightContext.fillStyle=lightGradient;lightContext.fillRect(0,0,128,128);const softMap=new THREE.CanvasTexture(lightCanvas);
  function softbox(w,h,position,intensity,color=0xffffff) {
    const panel=new THREE.Mesh(panelGeometry,new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide,map:softMap}));
    panel.scale.set(w,h,1);panel.position.set(...position);panel.lookAt(0,0,0);studio.add(panel);
  }
  softbox(8,6,[-5,6,4],4.5,0xfff4e8);
  softbox(2,8,[6,4,-3],2.8,0xe7efff);
  softbox(11,6,[-2,2,7],5);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.08);
  scene.environment=environment.texture;scene.environmentIntensity=.72;
  studio.traverse(o=>{if(o.material)o.material.dispose();});panelGeometry.dispose();softMap.dispose();pmrem.dispose();
  const key=new THREE.DirectionalLight(0xfff0dd,2.1);key.position.set(-4,7,3);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.radius=4;key.shadow.blurSamples=8;
  Object.assign(key.shadow.camera,{left:-7,right:7,top:8,bottom:-8,near:.5,far:24});
  key.shadow.bias=-.00012;key.shadow.normalBias=.018;scene.add(key);
  const edge=new THREE.DirectionalLight(0xcbdcee,1.35);edge.position.set(4,3,-5);scene.add(edge);
  scene.add(new THREE.HemisphereLight(0x9aadb9,0x151b20,.24));
  const pool=new THREE.SpotLight(0xffeedb,46,22,.64,1,2);
  pool.position.set(-3.4,5.5,3.6);pool.target.position.set(.3,0,1.8);scene.add(pool,pool.target);

  // Atmospheric depth is a continuous light field, not a flat backdrop or moving mist.
  const sky=new THREE.Mesh(new THREE.SphereGeometry(70,24,12),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,uniforms:{horizonColor:{value:background}},
    vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;uniform vec3 horizonColor;
      void main(){vec3 d=normalize(direction);
        float horizon=exp(-abs(d.y)*8.);
        float key=pow(max(0.,dot(d,normalize(vec3(-.7,.15,.3)))),5.);
        vec3 c=horizonColor*mix(.45,1.,horizon);
        c+=vec3(.021,.017,.012)*key*(1.-horizon);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));sky.renderOrder=-10;scene.add(sky);

  const reflection=new THREE.WebGLRenderTarget(1,1,{type:renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:true});
  const reflectionCamera=new THREE.PerspectiveCamera(),reflectionMatrix=new THREE.Matrix4();
  const mirrorPosition=new THREE.Vector3(),mirrorTarget=new THREE.Vector3(),viewDirection=new THREE.Vector3();
  const clippingPlane=new THREE.Plane(new THREE.Vector3(0,1,0),.056);
  const groundMaterial=new THREE.MeshStandardMaterial({color:0x303738,roughness:.48,metalness:.12,envMapIntensity:.55});
  groundMaterial.onBeforeCompile=shader=>{
    shader.uniforms.groundReflection={value:reflection.texture};shader.uniforms.reflectionMatrix={value:reflectionMatrix};
    shader.vertexShader='varying vec3 groundPosition;varying vec4 reflectionPosition;uniform mat4 reflectionMatrix;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngroundPosition=(modelMatrix*vec4(position,1.)).xyz;reflectionPosition=reflectionMatrix*vec4(groundPosition,1.);');
    shader.fragmentShader=`varying vec3 groundPosition;varying vec4 reflectionPosition;uniform sampler2D groundReflection;
      float hashGround(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noiseGround(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hashGround(i),hashGround(i+vec2(1,0)),f.x),mix(hashGround(i+vec2(0,1)),hashGround(i+vec2(1,1)),f.x),f.y);}
      `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      float mineral=noiseGround(groundPosition.xz*1.8)*.65+noiseGround(groundPosition.xz*18.)*.35;
      diffuseColor.rgb*=.78+.32*mineral;
      roughnessFactor=.35+.26*mineral;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec2 reflectedUV=reflectionPosition.xy/reflectionPosition.w;
      vec3 reflected=vec3(0.);
      for(int rx=-1;rx<=1;rx++)for(int ry=-1;ry<=1;ry++){
        reflected+=texture2D(groundReflection,reflectedUV+vec2(float(rx),float(ry))*.006).rgb/9.;
      }
      float grazing=pow(1.-abs(dot(normal,normalize(vViewPosition))),3.);
      outgoingLight=mix(outgoingLight,reflected,.16+grazing*.22);
      #include <opaque_fragment>`);
  };
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(220,220),groundMaterial);
  ground.rotation.x=-Math.PI/2;ground.position.y=-.059;ground.receiveShadow=true;scene.add(ground);
  const jointMaterial=new THREE.MeshStandardMaterial({color:0x242c2f,roughness:.8});
  const jointGeometry=new THREE.BoxGeometry(1,1,1);const floorParts=[ground];
  for(const x of [-8,-5,-2,1,4,7]) {
    const joint=new THREE.Mesh(jointGeometry,jointMaterial);joint.scale.set(.003,.001,24);joint.position.set(x,-.058,5);scene.add(joint);floorParts.push(joint);
  }
  for(const z of [-4,-1,2,5,8,11,14]) {
    const joint=new THREE.Mesh(jointGeometry,jointMaterial);joint.scale.set(24,.001,.003);joint.position.set(0,-.058,z);scene.add(joint);floorParts.push(joint);
  }
  return {
    environment,
    reflect(camera,w,h){
      const rw=Math.max(1,Math.round(w*.4)),rh=Math.max(1,Math.round(h*.4));
      if(reflection.width!==rw||reflection.height!==rh)reflection.setSize(rw,rh);
      reflectionCamera.copy(camera);camera.getWorldDirection(viewDirection);
      mirrorPosition.copy(camera.position);mirrorPosition.y=-.118-mirrorPosition.y;
      mirrorTarget.copy(camera.position).add(viewDirection);mirrorTarget.y=-.118-mirrorTarget.y;
      reflectionCamera.position.copy(mirrorPosition);reflectionCamera.up.set(0,-1,0);reflectionCamera.lookAt(mirrorTarget);reflectionCamera.updateMatrixWorld();
      reflectionMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
      reflectionMatrix.multiply(reflectionCamera.projectionMatrix).multiply(reflectionCamera.matrixWorldInverse);
      const previousTarget=renderer.getRenderTarget(),previousClipping=renderer.clippingPlanes;
      floorParts.forEach(part=>part.visible=false);renderer.clippingPlanes=[clippingPlane];
      renderer.setRenderTarget(reflection);renderer.render(scene,reflectionCamera);
      renderer.setRenderTarget(previousTarget);renderer.clippingPlanes=previousClipping;floorParts.forEach(part=>part.visible=true);
    },
    dispose(){reflection.dispose();}
  };
}
