import * as THREE from './vendor/three.module.js';

// Optical finish for the architecture only. HTML typography stays untouched.
// Half-resolution separable bloom, a restrained lens falloff and static fine grain.
export function createCinematicFinish(renderer) {
  const targetType=renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
  const sceneTarget=new THREE.WebGLRenderTarget(1,1,{type:targetType,samples:Math.min(4,renderer.capabilities.maxSamples)});
  const glowA=new THREE.WebGLRenderTarget(1,1,{type:targetType,depthBuffer:false});
  const glowB=glowA.clone();
  const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
  const blur=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{source:{value:null},stepSize:{value:new THREE.Vector2()},extract:{value:1}},vertexShader,
    fragmentShader:`
      varying vec2 vUv;uniform sampler2D source;uniform vec2 stepSize;uniform float extract;
      vec3 sampleLight(vec2 uv){
        vec3 c=texture2D(source,uv).rgb;
        float brightness=max(max(c.r,c.g),c.b);
        return c*mix(1.,smoothstep(.65,1.8,brightness),extract);
      }
      void main(){
        vec3 c=sampleLight(vUv)*.227027;
        c+=(sampleLight(vUv+stepSize*1.384615)+sampleLight(vUv-stepSize*1.384615))*.316216;
        c+=(sampleLight(vUv+stepSize*3.230769)+sampleLight(vUv-stepSize*3.230769))*.070270;
        gl_FragColor=vec4(c,1.);
      }`});
  const finish=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
    uniforms:{source:{value:sceneTarget.texture},glow:{value:glowB.texture}},vertexShader,
    fragmentShader:`
      varying vec2 vUv;uniform sampler2D source;uniform sampler2D glow;
      void main(){
        vec3 c=texture2D(source,vUv).rgb+texture2D(glow,vUv).rgb*.16;
        vec2 lens=(vUv-vec2(.55,.48))*vec2(.95,.8);
        c*=1.-.30*smoothstep(.12,.68,length(lens));
        vec2 haze=(vUv-vec2(.76,.54))*vec2(1.1,1.8);
        c+=vec3(.003,.004,.005)*exp(-dot(haze,haze)*5.);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
        gl_FragColor.rgb+=grain/420.;
      }`});
  const quadScene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const geometry=new THREE.PlaneGeometry(2,2),quad=new THREE.Mesh(geometry,finish);quadScene.add(quad);
  let width=1,height=1;
  return {
    resize(w,h){
      const ratio=renderer.getPixelRatio();width=Math.round(w*ratio);height=Math.round(h*ratio);
      sceneTarget.setSize(width,height);glowA.setSize(Math.ceil(width/2),Math.ceil(height/2));glowB.setSize(Math.ceil(width/2),Math.ceil(height/2));
    },
    render(scene,sceneCamera){
      renderer.setRenderTarget(sceneTarget);renderer.render(scene,sceneCamera);
      quad.material=blur;blur.uniforms.source.value=sceneTarget.texture;blur.uniforms.extract.value=1;
      blur.uniforms.stepSize.value.set(5/width,0);renderer.setRenderTarget(glowA);renderer.render(quadScene,camera);
      blur.uniforms.source.value=glowA.texture;blur.uniforms.extract.value=0;blur.uniforms.stepSize.value.set(0,5/height);
      renderer.setRenderTarget(glowB);renderer.render(quadScene,camera);
      quad.material=finish;renderer.setRenderTarget(null);renderer.render(quadScene,camera);
    },
    dispose(){sceneTarget.dispose();glowA.dispose();glowB.dispose();blur.dispose();finish.dispose();geometry.dispose();}
  };
}
