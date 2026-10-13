import * as THREE from './vendor/three.module.js';
import { createCinematicWorld } from './cinematic-world.js';
import { createCinematicBuilding } from './cinematic-building.js';
import { createCinematicFinish } from './cinematic-finish.js';

export async function mountArchitecture(story) {
  const stage = story.querySelector('.story-stage');
  const host = stage.querySelector('.scene-canvas');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene();
  scene.background = null;

  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  // Small screens with few cores or little memory render at one pixel per CSS pixel.
  const modest = innerWidth <= 820 && ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4);
  const pixelRatioFor = width => modest ? 1 : Math.min(devicePixelRatio, width <= 820 ? 1.3 : 1.6);
  renderer.setPixelRatio(pixelRatioFor(innerWidth));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .94;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  host.append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(38,1,.05,180);
  const world=createCinematicWorld(scene,renderer);
  const {environment}=world;
  const finish=createCinematicFinish(renderer);
  await document.fonts.ready;
  const building=createCinematicBuilding(scene);
  // Five photographic compositions, joined through one spatial camera path.
  const poses=[
    {camera:[3.5,1.55,4.4],target:[0,.63,.35],center:[.62,.68],fov:38},
    {camera:[3.0,1.20,3.65],target:[.45,.63,.52],center:[.72,.80],fov:38},
    {camera:[.9,1.38,6.35],target:[.55,.46,1.0],center:[.23,.55],fov:42},
    {camera:[6.3,3.6,10.4],target:[.15,1.0,1.4],center:[.70,.50],fov:39},
    {camera:[6.6,4.3,11.8],target:[.1,.85,1.7],center:[.64,.60],fov:37},
  ];
  const positionPath=new THREE.CatmullRomCurve3(poses.map(p=>new THREE.Vector3(...p.camera)),false,'centripetal');
  const targetPath=new THREE.CatmullRomCurve3(poses.map(p=>new THREE.Vector3(...p.target)),false,'centripetal');
  const position=new THREE.Vector3(),target=new THREE.Vector3();
  let visualProgress=null,lastTime=0;
  const copies = [...story.querySelectorAll('.story-copy')];
  const ids = copies.map(copy => copy.id);
  const rail = [...story.querySelectorAll('.story-nav a')];
  const ui = story.querySelector('.story-ui');
  const progressBar = story.querySelector('.story-progress span');
  const mode = story.querySelector('.story-mode');
  const backdropWord = story.querySelector('.story-backdrop-word');
  const markers = [];
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const mix = THREE.MathUtils.lerp;
  let frame = 0, frameCount = 0, w = 1, h = 1, travel = 1, top = 0;
  let active = false, lost = false, userStatic = reducedMotion.matches, lastChapter = -1;
  let readingChapter = 0;
  // Frame-time guard: if the first moving frames are slow, the calm view takes over.
  const slowFrameMs = 34, sampleTarget = 30;
  let guardDone = false, guardSkip = 3, guardLast = 0, guardChained = false, lastScrollTime = 0;
  const guardSamples = [];

  function requestFrame() {
    if (!frame && active && !lost && !document.hidden) frame = requestAnimationFrame(render);
  }
  function dimensions() {
    if (!active) return;
    w = stage.clientWidth; h = stage.clientHeight;
    if (!w || !h) return;
    top = story.getBoundingClientRect().top + scrollY;
    travel = Math.max(1, story.offsetHeight - h);
    renderer.setPixelRatio(pixelRatioFor(w));
    renderer.setSize(w,h,false);finish.resize(w,h);
    camera.aspect=w/h;
    markers.forEach((marker,i) => marker.style.top = `${i/(copies.length-1)*travel}px`);
    requestFrame();
  }
  function render(now=performance.now()) {
    frame = 0;
    if (!active || lost || document.hidden) return;
    if (!guardDone) {
      const gap = now - guardLast;
      const moving = guardChained || performance.now() - lastScrollTime < 300;
      if (guardLast && moving && gap > 0 && gap < 1500) { if (guardSkip > 0) guardSkip--; else guardSamples.push(gap); }
      guardLast = now;
    }
    const scrollProgress=clamp((scrollY-top)/travel);
    const dt=Math.min(50,Math.max(1,now-lastTime||16));lastTime=now;
    if(visualProgress===null)visualProgress=scrollProgress;
    else visualProgress+= (scrollProgress-visualProgress)*(1-Math.exp(-dt/135));
    if(Math.abs(scrollProgress-visualProgress)<.00006)visualProgress=scrollProgress;
    const p=visualProgress;
    const timeline = p * (poses.length - 1);
    const segment = Math.min(poses.length - 2, Math.floor(timeline));
    const f = THREE.MathUtils.smoothstep(timeline - segment,0,1);
    const a = poses[segment], b = poses[segment+1];
    const mobile = w <= 820;
    const state = building.update(timeline);
    // The lens lives inside a continuous world; deliberate crops replace the miniature.
    const railPosition=p;
    positionPath.getPoint(railPosition,position);targetPath.getPoint(railPosition,target);
    let centerX=mix(a.center[0],b.center[0],f),centerY=mix(a.center[1],b.center[1],f);
    camera.fov=mix(a.fov,b.fov,f);
    if(mobile){
      // A portrait composition keeps the doorway large and reserves a clear reading area.
      position.multiplyScalar(1.16);position.y+=.35;
      centerX=.55;centerY=.71;
      camera.fov=43;
      const expansion=THREE.MathUtils.smoothstep(timeline,2,3);
      centerY=mix(.71,.665,expansion);centerX=mix(.55,.50,expansion);position.multiplyScalar(mix(1,1.12,expansion));
    }
    camera.position.copy(position);camera.lookAt(target);
    camera.setViewOffset(w,h,(.5-centerX)*w,(.5-centerY)*h,w,h);
    camera.updateProjectionMatrix();
    // Each heading introduces its operation, before the new elements are placed.
    // Only a short crossfade separates the readings; most of the build stays readable.
    const boundaries=[.56,1.28,2.18,3.52];
    const chapter=boundaries.filter(boundary=>timeline>=boundary).length;
    const textOpacity=THREE.MathUtils.smoothstep(Math.min(...boundaries.map(boundary=>Math.abs(timeline-boundary))),0,.14);
    copies.forEach((copy,i) => {
      const opacity = textOpacity;
      const current = chapter === i;
      copy.style.opacity = String(current ? opacity : 0);
      copy.style.transform = current ? `translate3d(0,${(1-opacity)*16}px,0)` : 'none';
      copy.dataset.active = String(current);
      copy.inert = !current || opacity < .05;
      copy.setAttribute('aria-hidden',String(!current));
    });
    if (chapter !== lastChapter) {
      rail.forEach((link,i) => { if (i === chapter) link.setAttribute('aria-current','step'); else link.removeAttribute('aria-current'); });
      lastChapter = chapter;
    }
    progressBar.style.transform = `scaleX(${p})`;
    backdropWord.style.transform = `translate3d(${-p*9}vw,${p*2}vh,0)`;
    world.reflect(camera,w,h);
    renderer.shadowMap.autoUpdate=false;
    finish.render(scene,camera);
    renderer.shadowMap.autoUpdate=true;
    story.dataset.scene = 'ready';
    story.dataset.model = 'cinematic-architecture';
    story.dataset.pavilion = state.pavilion.toFixed(3);
    story.dataset.access = state.access.toFixed(3);
    story.dataset.growth = state.growth.toFixed(3);
    story.dataset.broadening = state.broadening.toFixed(3);
    story.dataset.storeys = String(state.storeys);
    story.dataset.scrollProgress = scrollProgress.toFixed(5);
    story.dataset.progress = p.toFixed(5);
    story.dataset.departed = String(scrollY>top+travel+2);
    story.dataset.chapter = ids[chapter];
    story.dataset.frames = String(++frameCount);
    // Decide after ~30 frames; clearly unusable speeds (median > 100 ms) already after 8.
    const median = () => [...guardSamples].sort((x, y) => x - y)[guardSamples.length >> 1];
    if (!guardDone && (guardSamples.length >= sampleTarget || (guardSamples.length >= 8 && median() > 100))) {
      guardDone = true;
      if (median() > slowFrameMs) {
        setMode(true, true); story.dataset.scene = 'static'; story.dataset.autoQuiet = 'true';
        return;
      }
    }
    // A short settling motion, then rendering stops completely.
    guardChained = visualProgress !== scrollProgress;
    if (guardChained) requestFrame();
  }
  function restoreArticles() {
    copies.forEach((copy,i) => {
      copy.id = ids[i]; copy.inert = false; copy.removeAttribute('aria-hidden');
      copy.removeAttribute('data-active'); copy.style.removeProperty('opacity'); copy.style.removeProperty('transform');
    });
    markers.splice(0).forEach(marker => marker.remove());
  }
  function setMode(staticMode, keepChapter = false) {
    const previous = active ? Math.max(0,lastChapter) : readingChapter;
    userStatic = staticMode;
    if (!staticMode && active) { dimensions(); return; }
    if (staticMode) {
      active = false; cancelAnimationFrame(frame); frame = 0;
      story.classList.remove('story-enhanced'); story.classList.add('story-static');
      restoreArticles(); ui.hidden = true; story.dataset.scene = 'static';
      mode.querySelector('.story-mode-label').textContent = 'Scroll-Ansicht';
      mode.setAttribute('aria-label','Scroll-Ansicht aktivieren'); mode.title = 'Scroll-Ansicht aktivieren';
      mode.setAttribute('aria-pressed','true');
      if (keepChapter) { readingChapter = previous; copies[previous].scrollIntoView({block:'start',behavior:'instant'}); }
    } else {
      if (lost) return;
      copies.forEach((copy,i) => {
        const marker = document.createElement('span'); marker.id = ids[i]; marker.className = 'story-marker';
        marker.setAttribute('aria-hidden','true'); copy.removeAttribute('id'); story.append(marker); markers.push(marker);
      });
      story.classList.add('story-enhanced'); story.classList.remove('story-static');
      active = true; ui.hidden = false; lastChapter = -1;visualProgress=null;
      mode.querySelector('.story-mode-label').textContent = 'Ruhige Ansicht';
      mode.setAttribute('aria-label','Ruhige Ansicht'); mode.title = 'Ruhige Ansicht'; mode.setAttribute('aria-pressed','false');
      dimensions();
      if (keepChapter) scrollTo({top:top+readingChapter/4*travel,behavior:'instant'});
      else {
        const hashIndex = ids.indexOf(decodeURIComponent(location.hash.slice(1)));
        if (hashIndex >= 0) scrollTo({top:top+hashIndex/4*travel,behavior:'instant'});
        else if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({block:'start',behavior:'instant'});
      }
      cancelAnimationFrame(frame);frame=0;render();
    }
  }
  mode.addEventListener('click', () => setMode(!userStatic,true));
  reducedMotion.addEventListener('change', () => setMode(reducedMotion.matches,true));
  window.addEventListener('scroll', () => {
    lastScrollTime = performance.now();
    if (!active) return;
    const y = scrollY - top;
    if (y >= -h && y <= travel + h) requestFrame();
  },{passive:true});
  const resize = new ResizeObserver(dimensions); resize.observe(stage);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {cancelAnimationFrame(frame);frame=0;} else requestFrame();
  });
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault(); lost = true; setMode(true,true); story.dataset.scene = 'fallback'; mode.hidden = true;
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    lost = false; mode.hidden = false; setMode(reducedMotion.matches,false);
  });
  window.addEventListener('pagehide', e => {
    cancelAnimationFrame(frame);frame=0;
    if (!e.persisted) {
      resize.disconnect();
      const geometries = new Set(), materials = new Set(), textures = new Set();
      scene.traverse(o => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material) for (const m of (Array.isArray(o.material)?o.material:[o.material])) {materials.add(m);for(const key of ['map','bumpMap','roughnessMap','normalMap'])if(m[key])textures.add(m[key]);}
      });
      textures.forEach(t=>t.dispose()); materials.forEach(m=>m.dispose()); geometries.forEach(g=>g.dispose());
      finish.dispose(); world.dispose(); environment.dispose(); renderer.dispose();
    }
  });
  window.addEventListener('pageshow', e => {if(e.persisted){dimensions();requestFrame();}});
  mode.hidden = false;
  setMode(userStatic,false);
}
