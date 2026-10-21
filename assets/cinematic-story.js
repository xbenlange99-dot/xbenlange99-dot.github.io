import * as THREE from './vendor/three.module.js';
import { createCinematicWorld } from './cinematic-world.js';
import { createCinematicBuilding } from './cinematic-building.js';
import { createCinematicFinish } from './cinematic-finish.js';

export async function mountArchitecture(story) {
  const stage = story.querySelector('.story-stage');
  const host = stage.querySelector('.scene-canvas');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // The heavy objects are created on demand (see build): visitors of the calm view never pay for them.
  let scene, renderer, camera, world, environment, finish, building, buildPromise = null;
  // Small screens with few cores or little memory render at one pixel per CSS pixel.
  const modest = innerWidth <= 820 && ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4);
  // Quality tier 1 exists for weaker devices only: one pixel per CSS pixel, a smaller shadow map, fewer multisample taps.
  let tier = 0, built = false, intent = 0;
  const pixelRatioFor = width => modest || tier > 0 ? 1 : Math.min(devicePixelRatio, width <= 820 ? 1.3 : 1.6);
  const nextTask = () => new Promise(resolve => setTimeout(resolve));
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
  let shadowSignature = null;
  let active = false, lost = false, userStatic = reducedMotion.matches, lastChapter = -1;
  let readingChapter = 0;
  // Frame-time guard: if the first moving frames are slow, the calm view takes over.
  const slowFrameMs = 34, sampleTarget = 30;
  let guardDone = false, guardSkip = 3, guardLast = 0, guardChained = false, lastScrollTime = 0;
  const guardSamples = [];

  function createRenderer() {
    scene = new THREE.Scene();
    scene.background = null;
    // Create the context ourselves first: without WebGL we switch to the calm view quietly, without console errors.
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2',{alpha:true,depth:true,stencil:false,antialias:false,premultipliedAlpha:true,powerPreference:'high-performance'});
    if (!context) throw new Error('WebGL ist nicht verfügbar.');
    renderer = new THREE.WebGLRenderer({canvas,context,antialias:false,alpha:true,powerPreference:'high-performance'});
    // Shader programs are linked in parallel and checked on first use, so compiling never stalls the page.
    renderer.debug.checkShaderErrors = false;
    renderer.setPixelRatio(pixelRatioFor(innerWidth));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .94;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    // The light never moves: shadows are redrawn only while the building itself changes.
    renderer.shadowMap.autoUpdate = false;
    camera = new THREE.PerspectiveCamera(38,1,.05,180);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
  }
  function onContextLost(e) {
    e.preventDefault(); lost = true; setMode(true,true); story.dataset.scene = 'fallback'; mode.hidden = true;
  }
  function onContextRestored() {
    lost = false; shadowSignature = null; mode.hidden = false; setMode(reducedMotion.matches,false);
  }
  // Graphics done in software (no graphics hardware, e.g. test environments or virtual machines) cannot carry the scene.
  function isSoftwareRenderer() {
    const gl = renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
    return /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render/i.test(String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : ''));
  }
  function discard() {
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
    renderer.dispose(); renderer.forceContextLoss();
    scene = renderer = camera = world = environment = finish = building = undefined; buildPromise = null;
  }
  async function build() {
    if (!renderer) createRenderer();
    world = createCinematicWorld(scene,renderer);
    environment = world.environment;
    await nextTask();
    finish = createCinematicFinish(renderer);
    building = createCinematicBuilding(scene);
    await document.fonts.ready;
    // Every shader variant the scroll can reach is built now, in the background, instead of mid-scroll.
    camera.aspect = innerWidth / innerHeight;
    // Small steps, so no single task grows long on slow processors.
    await building.eachVariant(async () => {
      finish.prepareScene(scene,camera); await nextTask();
      world.prepare(camera); await nextTask();
      finish.prepareQuad(); await nextTask();
    });
    // Wait for the parallel shader build, at most 15 s and never beyond a lost context.
    for (let waited = 0; waited < 15000 && !lost && renderer.info.programs.some(program => !program.isReady()); waited += 16) await new Promise(resolve => setTimeout(resolve,16));
    built = true;
  }
  const ensureBuilt = () => buildPromise || (buildPromise = build());

  function applyTier() {
    tier = 1; world.lowerShadow(); finish.lowerSamples(); shadowSignature = null;
    story.dataset.quality = 'reduced';
  }
  // Time one finished frame on the graphics hardware, without blocking the page.
  function gpuFrame(gl, start) {
    return new Promise(resolve => {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) { resolve(0); return; }
      gl.flush();
      const poll = () => {
        const elapsed = performance.now() - start;
        const status = gl.clientWaitSync(sync, 0, 0);
        if (status === gl.TIMEOUT_EXPIRED && elapsed < 6000) { setTimeout(poll, 2); return; }
        if (status !== gl.TIMEOUT_EXPIRED) gl.deleteSync(sync);
        resolve(status === gl.WAIT_FAILED ? 0 : elapsed);
      };
      poll();
    });
  }
  // One warm-up frame (allocates the buffers), then four queued frames of the full building: the average per frame.
  async function measureFrame() {
    const gl = renderer.getContext();
    for (let attempt = 0; attempt < 4; attempt++) {
      if (document.hidden) await new Promise(resolve => document.addEventListener('visibilitychange', resolve, {once:true}));
      let interrupted = false; const mark = () => { interrupted = true; };
      document.addEventListener('visibilitychange', mark);
      w = document.documentElement.clientWidth; h = innerHeight;
      renderer.setPixelRatio(pixelRatioFor(w)); renderer.setSize(w,h,false); finish.resize(w,h); camera.aspect = w / h;
      shadowSignature = null;
      let start = performance.now();
      drawScene(.7);
      let result = await gpuFrame(gl,start);
      if (result <= 1500) {
        start = performance.now();
        for (let i = 0; i < 4; i++) drawScene(.7);
        result = (await gpuFrame(gl,start)) / 4;
      }
      document.removeEventListener('visibilitychange', mark);
      if (!interrupted) return result;
    }
    return 0;
  }
  // Decides before anything is shown: full quality, a lighter tier, or the calm view.
  async function chooseQuality() {
    const fine = 28, limit = 140;
    let frame = await measureFrame();
    story.dataset.frameMs = frame.toFixed(1);
    if (frame <= fine) return true;
    if (frame > limit) return false;
    applyTier();
    frame = await measureFrame();
    story.dataset.frameMs = frame.toFixed(1);
    return frame <= fine;
  }
  function quiet() {
    setMode(true,false); story.dataset.scene = 'static'; story.dataset.autoQuiet = 'true';
    if (world) { world.shrink(); finish.resize(1,1); }
  }
  function showFallback(error) {
    lost = true; active = false; cancelAnimationFrame(frame); frame = 0;
    story.classList.remove('story-enhanced'); story.dataset.scene = 'fallback';
    ui.hidden = true; mode.hidden = true;
    console.warn('Die Architecture wird als lesbare Seite dargestellt.', error);
  }
  // First visit with moving scene: build, measure, then switch over only if the device can carry it.
  async function enter(auto, keepChapter) {
    const mine = intent;   // a later click or preference change wins over this still running start
    try {
      if (auto) {
        createRenderer();
        if (isSoftwareRenderer()) { discard(); mode.hidden = false; quiet(); story.dataset.frameMs = 'software'; return; }
      }
      await ensureBuilt();
      if (mine !== intent) return;
      const fine = !auto || await chooseQuality();
      if (mine !== intent) return;
      mode.hidden = false;
      if (!fine) { quiet(); return; }
      // Whoever already scrolled down in the calm layout stays at the chapter they are reading.
      setMode(false, keepChapter || (auto && !location.hash && scrollY > 30));
    } catch (error) { showFallback(error); }
  }
  function applyMode(staticMode, keepChapter) {
    intent++;
    if (!staticMode && !built) enter(false,keepChapter); else setMode(staticMode,keepChapter);
  }

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
      if (guardLast && moving && gap > 0 && gap < 6000) { if (guardSkip > 0) guardSkip--; else guardSamples.push(gap); }
      guardLast = now;
    }
    const scrollProgress=clamp((scrollY-top)/travel);
    const dt=Math.min(50,Math.max(1,now-lastTime||16));lastTime=now;
    if(visualProgress===null)visualProgress=scrollProgress;
    else visualProgress+= (scrollProgress-visualProgress)*(1-Math.exp(-dt/135));
    if(Math.abs(scrollProgress-visualProgress)<.00006)visualProgress=scrollProgress;
    const p=visualProgress;
    const {timeline,state}=drawScene(p);
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
    // Decide after ~30 frames; clearly unusable speeds (median > 100 ms) already after 4.
    const median = () => [...guardSamples].sort((x, y) => x - y)[guardSamples.length >> 1];
    if (!guardDone && (guardSamples.length >= sampleTarget || (guardSamples.length >= 4 && median() > 100))) {
      if (median() > slowFrameMs) {
        // One lighter tier first; the calm view only if that is still too slow (or far too slow to help).
        if (tier === 0 && median() <= 400) {
          applyTier(); guardSamples.length = 0; guardSkip = 3; dimensions();
        } else {
          guardDone = true;
          setMode(true, true); story.dataset.scene = 'static'; story.dataset.autoQuiet = 'true';
          return;
        }
      } else guardDone = true;
    }
    // A short settling motion, then rendering stops completely.
    guardChained = visualProgress !== scrollProgress;
    if (guardChained) requestFrame();
  }
  // Pure 3D part of a frame: camera along the path, building state, shadows, reflection, finish.
  function drawScene(p) {
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
    // Shadows are only redrawn while the building itself changes (the light never moves).
    const signature=`${state.access}|${state.growth}|${state.broadening}`;
    if(signature!==shadowSignature){shadowSignature=signature;renderer.shadowMap.needsUpdate=true;}
    world.reflect(camera,w,h);
    finish.render(scene,camera);
    return {timeline,state};
  }
  function restoreArticles() {
    copies.forEach((copy,i) => {
      copy.id = ids[i]; copy.inert = false; copy.removeAttribute('aria-hidden');
      copy.removeAttribute('data-active'); copy.style.removeProperty('opacity'); copy.style.removeProperty('transform');
    });
    markers.splice(0).forEach(marker => marker.remove());
  }
  // Chapter being read in the calm layout: the last one whose top has passed 40 % of the window height.
  function currentChapter() {
    let index = 0;
    copies.forEach((copy,i) => { if (copy.getBoundingClientRect().top <= innerHeight * .4) index = i; });
    return index;
  }
  function setMode(staticMode, keepChapter = false) {
    const previous = active ? Math.max(0,lastChapter) : currentChapter();
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
      if (renderer && !renderer.domElement.isConnected) host.append(renderer.domElement);
      readingChapter = previous;
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
  mode.addEventListener('click', () => applyMode(!userStatic,true));
  reducedMotion.addEventListener('change', () => applyMode(reducedMotion.matches,true));
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
  window.addEventListener('pagehide', e => {
    cancelAnimationFrame(frame);frame=0;
    if (!e.persisted) {
      resize.disconnect();
      if (!scene) return;
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
  if (userStatic) { mode.hidden = false; setMode(true,false); }
  else await enter(true,false);
}
