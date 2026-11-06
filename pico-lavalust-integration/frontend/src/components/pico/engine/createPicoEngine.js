import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { superGeo, patchGeo, onSurface, mesh, radialTexture } from './geometry.js';
import { createFace } from './face.js';
import { VIEWS, GLOWS } from './views.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const Z = new THREE.Vector3(0, 0, 1);

/**
 * Creates the whole Pico scene on a <canvas> and returns a small control API.
 *
 * opts:
 *   glow            initial glow color, "#rrggbb"
 *   view            { az, el, zoom } initial camera (degrees, degrees, multiplier)
 *   viewShift       0..0.2, lifts the robot so UI at the bottom does not cover it (default 0.09)
 *   reducedMotion   boolean, defaults to the OS setting
 *   onReady()                       first frame drawn
 *   onReadout({az, el, zoom})       camera readout, about 10 times a second
 *   onViewChange(id | null)         a preset camera angle was reached (or left)
 *   onSleepChange(boolean)
 *   onSpinChange(boolean)           auto-spin turned on or off
 *   onGlowChange(hex)
 *   onSpeak(text, mood)             Pico reacts to being tapped
 *   onInteract()                    the viewer touched the scene
 */
export function createPicoEngine(canvas, opts = {}) {
  const reduceMotion =
    opts.reducedMotion ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    throw new Error('WebGL is not available in this browser.');
  }
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x04090e, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  scene.add(camera);

  /* ---------- state ---------- */
  const initialGlow = /^#[0-9a-f]{6}$/i.test(opts.glow || '') ? opts.glow : GLOWS[0].c;
  const S = {
    glow: new THREE.Color(initialGlow),
    glowHex: initialGlow,
    expr: 'neutral',
    exprUntil: 0,
    talkUntil: 0,
    talk: 0,
    thinking: false,
    sleeping: false,
    danceUntil: 0,
    danceStart: 0,
    dance: 0,
    waveUntil: 0,
    wave: 0,
    squish: 0,
    squishPh: 0,
    nod: 0,
    nodPh: 0,
    earFlash: 0,
    antVel: 0,
    kick: 0,
    blink: 0,
    blinkT: 0,
    nextBlink: 2,
    gx: 0,
    gy: 0,
    pause: false,
    noLook: false,
    clean: false,
  };

  /* ---------- environment (studio reflections) ---------- */
  function makeEnv() {
    const s = new THREE.Scene();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader:
          'varying vec3 vP; void main(){ float h=normalize(vP).y; vec3 top=vec3(.07,.13,.17); vec3 mid=vec3(.02,.04,.055); vec3 bot=vec3(.006,.01,.014); vec3 c = h>0.0 ? mix(mid,top,smoothstep(0.0,1.0,h)) : mix(mid,bot,smoothstep(0.0,-1.0,h)); gl_FragColor=vec4(c,1.0); }',
      })
    );
    s.add(dome);
    const panel = (w, h, pos, color, k) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })
      );
      m.position.set(pos[0], pos[1], pos[2]);
      m.lookAt(0, 0, 0);
      s.add(m);
    };
    panel(20, 11, [-22, 15, 18], '#fff1de', 7);
    panel(9, 14, [27, 6, -12], '#5fe9ff', 8);
    panel(8, 9, [-26, 3, -6], '#ff9a48', 5);
    panel(34, 6, [0, 30, 2], '#d4ecf6', 2.6);
    panel(14, 5, [0, 9, 30], '#eaf6ff', 2.4);
    panel(10, 3, [18, 4, 22], '#bfefff', 3);
    return s;
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = makeEnv();
  const envRT = pmrem.fromScene(envScene, 0.03);
  scene.environment = envRT.texture;
  envScene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  pmrem.dispose();

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0x9fd8ee, 0x05080c, 0.35));
  const key = new THREE.DirectionalLight(0xfff0de, 2.1);
  key.position.set(-6, 10, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 7, bottom: -5, near: 1, far: 30 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x59e8ff, 0.75);
  rim.position.set(8, 13, -8);
  scene.add(rim);
  const warm = new THREE.DirectionalLight(0xff9a50, 0.45);
  warm.position.set(-9, 8, 4);
  scene.add(warm);
  const floorGlow = new THREE.PointLight(0x35e6ff, 1.6, 9, 2);
  floorGlow.position.set(0, 0.6, 1.7);
  scene.add(floorGlow);

  /* ---------- background: bokeh studio ---------- */
  const bokeh = [
    [0.1, 0.62, 0.17, 0.3, 0], [0.2, 0.42, 0.07, 0.22, 0], [0.06, 0.28, 0.09, 0.18, 0], [0.27, 0.78, 0.06, 0.2, 0],
    [0.86, 0.7, 0.1, 0.2, 1], [0.93, 0.45, 0.07, 0.16, 1], [0.75, 0.88, 0.06, 0.15, 1], [0.97, 0.8, 0.05, 0.14, 1],
    [0.6, 0.92, 0.05, 0.1, 1], [0.38, 0.9, 0.04, 0.1, 0],
  ];
  const bgMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uAspect: { value: 1 },
      uTime: { value: 0 },
      uGlow: { value: S.glow.clone() },
      uB: { value: bokeh.map((b) => new THREE.Vector4(b[0], b[1], b[2], b[3])) },
      uK: { value: bokeh.map((b) => b[4]) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy*2.0,0.9999,1.0); }',
    fragmentShader: `
      uniform float uAspect, uTime; uniform vec3 uGlow; uniform vec4 uB[10]; uniform float uK[10]; varying vec2 vUv;
      void main(){
        vec2 p=vec2(vUv.x*uAspect, vUv.y);
        vec3 col=mix(vec3(0.004,0.010,0.015), vec3(0.020,0.050,0.068), smoothstep(0.0,1.0,vUv.y*0.85+0.15));
        col += vec3(0.50,0.20,0.05)*0.075*smoothstep(0.65,0.0,vUv.x)*smoothstep(0.1,0.7,vUv.y);
        col += uGlow*0.030*smoothstep(0.45,1.0,vUv.x);
        for(int i=0;i<10;i++){
          vec4 b=uB[i];
          vec2 c=vec2(b.x*uAspect, b.y); c.y += sin(uTime*0.15+float(i)*1.7)*0.008;
          float r=b.z; float d=length(p-c);
          float m=smoothstep(r,r*0.82,d);
          float rimk=smoothstep(r*0.55,r,d);
          vec3 tint = uK[i]<0.5 ? vec3(1.0,0.52,0.20) : mix(uGlow, vec3(0.3,0.8,1.0), 0.4);
          col += tint*m*(0.45+0.55*rimk)*b.w*0.55;
        }
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -1000;
  scene.add(bg);

  /* ---------- screen texture and materials ---------- */
  const face = createFace();
  const M = {
    shell: new THREE.MeshPhysicalMaterial({ color: 0xeaf2f6, roughness: 0.27, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.0 }),
    dark: new THREE.MeshPhysicalMaterial({ color: 0x0a0e13, roughness: 0.22, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.3 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x252d35, roughness: 0.38, metalness: 0.75, envMapIntensity: 1.1 }),
    seam: new THREE.MeshStandardMaterial({ color: 0xb4c2cb, roughness: 0.32, metalness: 0.5 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x021016, emissive: S.glow.clone(), emissiveIntensity: 2.4, roughness: 0.4 }),
    strip: new THREE.MeshStandardMaterial({ color: 0x021016, emissive: S.glow.clone(), emissiveIntensity: 2.0, roughness: 0.4 }),
    earIn: new THREE.MeshStandardMaterial({ color: 0x010608, emissive: S.glow.clone(), emissiveIntensity: 0.16, roughness: 0.25, metalness: 0.6 }),
    deck: new THREE.MeshStandardMaterial({ color: 0x03070a, roughness: 0.8, metalness: 0.15, envMapIntensity: 0.15 }),
    visor: new THREE.MeshPhysicalMaterial({
      color: 0x020407, roughness: 0.06, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.0,
      emissive: 0xffffff, emissiveMap: face.texture, emissiveIntensity: 1.8,
    }),
  };

  /* ---------- robot ---------- */
  const robot = new THREE.Group();
  scene.add(robot);
  const HEAD = new THREE.Vector3(1.5, 1.22, 1.32);
  const HN = 2.4;
  const TORSO = new THREE.Vector3(0.86, 0.92, 0.72);
  const TN = 2.3;

  const pelvis = mesh(superGeo(new THREE.Vector3(0.8, 0.34, 0.64), 2.2, 48, 32), M.dark, 'belly');
  pelvis.position.y = 0.36;
  robot.add(pelvis);
  const torso = new THREE.Group();
  torso.position.y = 1.22;
  robot.add(torso);
  torso.add(mesh(superGeo(TORSO, TN, 64, 44), M.shell, 'belly'));
  for (let i = 0; i < 3; i++) {
    const s = onSurface(TORSO, TN, -22, -26 - i * 4.2, 0.004);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.2 - i * 0.03, 0.022), M.dark);
    v.position.copy(s.p);
    v.quaternion.setFromUnitVectors(Z, s.n);
    torso.add(v);
  }
  const ledPos = onSurface(TORSO, TN, 0, 14, 0.004);
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.042, 24), new THREE.MeshBasicMaterial({ color: S.glow.clone().multiplyScalar(2.4) }));
  led.position.copy(ledPos.p);
  led.quaternion.setFromUnitVectors(Z, ledPos.n);
  torso.add(led);
  const ledRing = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.068, 28), M.dark);
  ledRing.position.copy(ledPos.p);
  ledRing.quaternion.copy(led.quaternion);
  torso.add(ledRing);
  {
    // back plate with status lights
    const bp = mesh(patchGeo(TORSO, TN, { phi: rad(24), theta: rad(20), thetaOff: rad(10), off: 0.012, p: 3, seg: 36 }), M.dark, 'belly', false);
    bp.rotation.y = Math.PI;
    torso.add(bp);
    for (let i = 0; i < 3; i++) {
      const s2 = onSurface(TORSO, TN, 0, 18 - i * 7, 0.03);
      const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.12, 4, 8), M.strip);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(s2.p.x, s2.p.y, -s2.p.z);
      bar.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(Z, new THREE.Vector3(s2.n.x, s2.n.y, -s2.n.z)));
      torso.add(bar);
    }
  }

  const neck = mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.34, 32), M.dark, 'head');
  neck.position.y = 2.3;
  robot.add(neck);
  const neckRing = mesh(new THREE.TorusGeometry(0.34, 0.045, 12, 40), M.graphite, 'head');
  neckRing.rotation.x = Math.PI / 2;
  neckRing.position.y = 2.16;
  robot.add(neckRing);

  const headPivot = new THREE.Group();
  headPivot.rotation.order = 'YXZ';
  headPivot.position.set(0, 2.36, 0.02);
  robot.add(headPivot);
  const head = new THREE.Group();
  head.position.set(0, 1.1, 0.04);
  headPivot.add(head);
  head.add(mesh(superGeo(HEAD, HN, 96, 64), M.shell, 'head'));
  head.add(mesh(patchGeo(HEAD, HN, { phi: rad(54), theta: rad(46.5), thetaOff: rad(-2), off: 0.006, seg: 72 }), M.graphite, 'visor', false));
  const visor = mesh(patchGeo(HEAD, HN, { phi: rad(50), theta: rad(42), thetaOff: rad(-2), off: 0.016, seg: 72 }), M.visor, 'visor', false);
  head.add(visor);
  head.add(mesh(patchGeo(HEAD, HN, { phi: rad(13), theta: rad(6.5), thetaOff: rad(63), off: 0.008, seg: 24 }), M.seam, 'head', false));
  {
    const bk = mesh(patchGeo(HEAD, HN, { phi: rad(16), theta: rad(10), thetaOff: rad(8), off: 0.008, seg: 28 }), M.graphite, 'head', false);
    bk.rotation.y = Math.PI;
    head.add(bk);
    for (let i = -1; i <= 1; i++) {
      const q = onSurface(HEAD, HN, 0, 8 + i * 4.2, 0.016);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.03), M.dark);
      v.position.set(q.p.x, q.p.y, -q.p.z);
      v.quaternion.setFromUnitVectors(Z, new THREE.Vector3(q.n.x, q.n.y, -q.n.z));
      head.add(v);
    }
  }

  function makeEar(side) {
    const g = new THREE.Group();
    g.userData.part = 'ear';
    const cyl = mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.56, 56), M.dark, 'ear');
    cyl.rotation.z = Math.PI / 2;
    cyl.position.x = side * 1.4;
    g.add(cyl);
    const rimT = mesh(new THREE.TorusGeometry(0.6, 0.08, 16, 64), M.dark, 'ear');
    rimT.rotation.y = Math.PI / 2;
    rimT.position.x = side * 1.68;
    g.add(rimT);
    const ring = mesh(new THREE.TorusGeometry(0.4, 0.078, 20, 72), M.glow, 'ear', false);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = side * 1.7;
    g.add(ring);
    const disc = mesh(new THREE.CircleGeometry(0.33, 48), M.earIn, 'ear', false);
    disc.rotation.y = (side * Math.PI) / 2;
    disc.position.x = side * 1.69;
    g.add(disc);
    const dot = mesh(new THREE.CircleGeometry(0.09, 32), M.dark, 'ear', false);
    dot.rotation.y = (side * Math.PI) / 2;
    dot.position.x = side * 1.695;
    g.add(dot);
    const light = new THREE.PointLight(0x35e6ff, 0.9, 6, 2);
    light.position.set(side * 2.9, 0, 0.3);
    g.add(light);
    g.userData.light = light;
    return g;
  }
  const earL = makeEar(1);
  const earR = makeEar(-1);
  head.add(earL, earR);

  const antenna = new THREE.Group();
  {
    const s = onSurface(HEAD, HN, 10, 80, 0.0);
    antenna.position.copy(s.p).add(new THREE.Vector3(0.08, 0, -0.32));
    const stalk = mesh(new THREE.CylinderGeometry(0.026, 0.04, 0.7, 12), M.dark, 'antenna');
    stalk.position.y = 0.35;
    antenna.add(stalk);
    const tip = mesh(new THREE.SphereGeometry(0.075, 20, 16), M.dark, 'antenna');
    tip.position.y = 0.72;
    antenna.add(tip);
    const base = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 20), M.graphite, 'antenna');
    antenna.add(base);
    antenna.rotation.set(-0.12, 0, -0.1);
  }
  head.add(antenna);
  let antPos = 0;

  function makeArm(side) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.86, 1.82, 0.0);
    sh.add(mesh(new THREE.SphereGeometry(0.27, 28, 20), M.dark, 'arm'));
    const upper = mesh(new THREE.CapsuleGeometry(0.2, 0.42, 8, 24), M.shell, 'arm');
    upper.position.y = -0.5;
    sh.add(upper);
    const el = new THREE.Group();
    el.position.y = -0.88;
    sh.add(el);
    el.add(mesh(new THREE.SphereGeometry(0.21, 24, 18), M.dark, 'arm'));
    const fore = mesh(new THREE.CapsuleGeometry(0.17, 0.34, 8, 24), M.shell, 'arm');
    fore.position.y = -0.42;
    el.add(fore);
    const band = mesh(new THREE.TorusGeometry(0.172, 0.02, 10, 40), M.strip, 'arm', false);
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.62;
    el.add(band);
    const hand = mesh(new THREE.SphereGeometry(1, 24, 18), M.dark, 'arm');
    hand.scale.set(0.2, 0.25, 0.18);
    hand.position.y = -0.88;
    el.add(hand);
    const thumb = mesh(new THREE.SphereGeometry(0.075, 14, 10), M.dark, 'arm');
    thumb.position.set(0, -0.84, 0.17);
    el.add(thumb);
    sh.userData.el = el;
    robot.add(sh);
    return sh;
  }
  const armL = makeArm(1);
  const armR = makeArm(-1);
  const A = { L: { sx: -0.28, sz: 0.22, ex: -0.7, ez: 0 }, R: { sx: -0.28, sz: 0.22, ex: -0.7, ez: 0 } };

  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.55, 0.43, 0.1);
    const thigh = mesh(new THREE.CapsuleGeometry(0.29, 0.34, 8, 24), M.shell, 'leg');
    thigh.rotation.x = Math.PI / 2;
    thigh.position.z = 0.38;
    hip.add(thigh);
    const knee = mesh(new THREE.SphereGeometry(0.31, 24, 18), M.dark, 'leg');
    knee.position.set(0, 0, 0.86);
    hip.add(knee);
    const foot = new THREE.Group();
    foot.position.set(0, 0, 0.78);
    hip.add(foot);
    const R = 0.43;
    const L = 1.05;
    const c = 0.17;
    const pts = [new THREE.Vector2(0.0001, 0)];
    for (let a = 0; a <= 90; a += 10) pts.push(new THREE.Vector2(R - c + c * Math.sin(rad(a)), c - c * Math.cos(rad(a))));
    for (let a = 0; a <= 90; a += 10) pts.push(new THREE.Vector2(R - c + c * Math.cos(rad(a)), L - c + c * Math.sin(rad(a))));
    pts.push(new THREE.Vector2(0.0001, L));
    const body = mesh(new THREE.LatheGeometry(pts, 56), M.shell, 'foot');
    body.rotation.x = Math.PI / 2;
    foot.add(body);
    const capD = mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.07, 48), M.dark, 'foot');
    capD.rotation.x = Math.PI / 2;
    capD.position.z = L + 0.002;
    foot.add(capD);
    const capR = mesh(new THREE.TorusGeometry(0.3, 0.032, 12, 56), M.graphite, 'foot');
    capR.position.z = L + 0.03;
    foot.add(capR);
    for (let k = -1; k <= 1; k += 2) {
      const bar = mesh(new THREE.CapsuleGeometry(0.026, 0.19, 6, 12), M.strip, 'foot', false);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, k * 0.075, L + 0.045);
      foot.add(bar);
    }
    const heel = mesh(new THREE.TorusGeometry(0.2, 0.025, 10, 40), M.graphite, 'foot');
    heel.position.z = 0.08;
    foot.add(heel);
    robot.add(hip);
    return hip;
  }
  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  /* ---------- stage: turntable, floor, shadow ---------- */
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.0, 0.3, 120), M.deck);
  deck.position.y = -0.15;
  deck.receiveShadow = true;
  scene.add(deck);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(32, 64),
    new THREE.MeshLambertMaterial({ color: 0x05090d, transparent: true, alphaMap: radialTexture([[0, '#fff'], [0.45, '#bbb'], [1, '#000']]) })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.31;
  floor.receiveShadow = true;
  scene.add(floor);
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(3, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8, depthWrite: false, alphaMap: radialTexture([[0, '#fff'], [0.5, '#888'], [1, '#000']]) })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0, 0.006, 0.7);
  blob.scale.set(0.95, 1.18, 1);
  scene.add(blob);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(3.95, 0.028, 10, 160), new THREE.MeshBasicMaterial({ color: S.glow.clone().multiplyScalar(2.2) }));
  edge.rotation.x = Math.PI / 2;
  scene.add(edge);

  // degree dial on the turntable
  const ringC = document.createElement('canvas');
  ringC.width = ringC.height = 1024;
  const ringTex = new THREE.CanvasTexture(ringC);
  ringTex.encoding = THREE.sRGBEncoding;
  ringTex.anisotropy = 8;
  function drawRing() {
    const x = ringC.getContext('2d');
    const S2 = 1024;
    const c = S2 / 2;
    const Ro = 3.88;
    const px = c / Ro;
    x.clearRect(0, 0, S2, S2);
    const hex = S.glowHex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const C = (a) => `rgba(${r},${g},${b},${a})`;
    for (let a = 0; a < 360; a += 5) {
      const major = a % 90 === 0;
      const mid = a % 30 === 0;
      const r1 = Ro - 0.04;
      const r2 = Ro - (major ? 0.42 : mid ? 0.28 : 0.15);
      const sx = Math.sin(rad(a));
      const cz = Math.cos(rad(a));
      x.strokeStyle = C(major ? 0.95 : mid ? 0.65 : 0.32);
      x.lineWidth = major ? 4 : mid ? 3 : 2;
      x.beginPath();
      x.moveTo(c + sx * r1 * px, c + cz * r1 * px);
      x.lineTo(c + sx * r2 * px, c + cz * r2 * px);
      x.stroke();
      if (mid) {
        const rt = Ro - 0.62;
        x.save();
        x.translate(c + sx * rt * px, c + cz * rt * px);
        x.rotate(-rad(a) + Math.PI);
        x.fillStyle = C(major ? 0.95 : 0.6);
        x.font = `500 ${major ? 26 : 20}px ui-monospace, Menlo, Consolas, monospace`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(`${a}°`, 0, 0);
        x.restore();
      }
    }
    ringTex.needsUpdate = true;
  }
  drawRing();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.01, 3.9, 128, 1),
    new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, color: new THREE.Color(1.35, 1.35, 1.35) })
  );
  {
    const pos = ring.geometry.attributes.position;
    const uv = ring.geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * 3.88), 0.5 + pos.getY(i) / (2 * 3.88));
  }
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.004;
  scene.add(ring);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.5, 2.5) }));
  marker.position.y = 0.08;
  scene.add(marker);

  /* ---------- post-processing ---------- */
  let composer = null;
  let bloom = null;
  let finalPass = null;
  function buildComposer() {
    try {
      const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(sz.x, sz.y, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        samples: 4,
      });
      composer = new EffectComposer(renderer, rt);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(sz.x, sz.y), 0.85, 0.4, 1.45);
      composer.addPass(bloom);
      finalPass = new ShaderPass({
        uniforms: { tDiffuse: { value: null }, uExp: { value: 1.12 }, uTime: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform sampler2D tDiffuse; uniform float uExp, uTime; varying vec2 vUv;
          vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
          float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
          void main(){
            vec4 c=texture2D(tDiffuse,vUv);
            vec3 col=aces(c.rgb*uExp);
            col=pow(col,vec3(1.0/2.2));
            vec2 q=vUv-0.5; col*=1.0-0.5*smoothstep(0.3,0.95,length(q*vec2(1.1,1.0)));
            col+=(hash(gl_FragCoord.xy+fract(uTime)*91.0)-0.5)*0.016;
            gl_FragColor=vec4(col,1.0);
          }`,
      });
      composer.addPass(finalPass);
    } catch (e) {
      console.warn('[Pico] Post-processing unavailable, using direct render.', e);
      composer = null;
    }
  }
  buildComposer();

  /* ---------- controls and camera views ---------- */
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, {
    enableDamping: true,
    dampingFactor: 0.07,
    enablePan: false,
    minDistance: 3.4,
    maxDistance: 34,
    minPolarAngle: 0.02,
    maxPolarAngle: 1.62,
    rotateSpeed: 0.8,
    zoomSpeed: 0.8,
    autoRotateSpeed: 1.6,
  });
  const TGT = new THREE.Vector3(0, 2.65, 0.5);
  controls.target.copy(TGT);
  let D0 = 10.5;
  const viewShift = opts.viewShift ?? 0.09;

  let tween = null;
  const _v = new THREE.Vector3();
  const _s = new THREE.Spherical();
  function camState() {
    _v.copy(camera.position).sub(controls.target);
    _s.setFromVector3(_v);
    return { az: _s.theta, pol: _s.phi, dist: _s.radius };
  }
  function fitDist() {
    const t = Math.tan(rad(camera.fov / 2));
    return Math.max(3.0 / t, 2.3 / (t * camera.aspect)) * 1.3;
  }
  function flyTo(target, ms) {
    const v = typeof target === 'string' ? VIEWS.find((x) => x.id === target) : target;
    if (!v) return;
    if (controls.autoRotate) {
      controls.autoRotate = false;
      opts.onSpinChange?.(false);
    }
    const f = camState();
    let d = rad(v.az) - f.az;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    tween = {
      t0: performance.now(),
      ms: ms !== undefined ? ms : reduceMotion ? 1 : 1150,
      v,
      f,
      toAz: f.az + d,
      toPol: Math.PI / 2 - rad(v.el),
      toDist: D0 * v.d,
      ft: controls.target.clone(),
      tt: new THREE.Vector3(0, v.ty !== undefined ? v.ty : TGT.y, v.tz !== undefined ? v.tz : TGT.z),
    };
    opts.onViewChange?.(null);
    opts.onInteract?.();
  }
  function setView(az, el, zoom = 1, ty) {
    tween = null;
    controls.target.set(0, ty !== undefined ? ty : TGT.y, TGT.z);
    _s.set(D0 * zoom, Math.PI / 2 - rad(el), rad(az));
    _v.setFromSpherical(_s);
    camera.position.copy(controls.target).add(_v);
    controls.update();
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function stepTween(now) {
    if (!tween) return;
    const k = clamp((now - tween.t0) / tween.ms, 0, 1);
    const e = ease(k);
    controls.target.lerpVectors(tween.ft, tween.tt, e);
    _s.set(lerp(tween.f.dist, tween.toDist, e), lerp(tween.f.pol, tween.toPol, e), lerp(tween.f.az, tween.toAz, e));
    _s.phi = clamp(_s.phi, 0.02, 1.62);
    _v.setFromSpherical(_s);
    camera.position.copy(controls.target).add(_v);
    if (k >= 1) {
      const id = tween.v.id || null;
      tween = null;
      opts.onViewChange?.(id);
    }
  }
  const onControlsStart = () => {
    tween = null;
    opts.onViewChange?.(null);
    opts.onInteract?.();
  };
  controls.addEventListener('start', onControlsStart);

  // keyboard: only while the canvas itself has focus, so host-page shortcuts are untouched
  const onKey = (e) => {
    const c = camState();
    let az = deg(c.az);
    let el = 90 - deg(c.pol);
    let d = c.dist / D0;
    let hit = true;
    if (e.key === 'ArrowLeft') az += 20;
    else if (e.key === 'ArrowRight') az -= 20;
    else if (e.key === 'ArrowUp') el = Math.min(84, el + 8);
    else if (e.key === 'ArrowDown') el = Math.max(1, el - 8);
    else if (e.key === '+' || e.key === '=') d = Math.max(0.35, d * 0.85);
    else if (e.key === '-') d = Math.min(3, d / 0.85);
    else hit = false;
    if (hit) {
      e.preventDefault();
      flyTo({ id: null, az, el, d, ty: controls.target.y, tz: controls.target.z }, reduceMotion ? 1 : 350);
    }
  };
  canvas.addEventListener('keydown', onKey);

  /* ---------- resize ---------- */
  function resize() {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 150;
    const pr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.75 : 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const shift = S.clean ? 0 : camera.aspect < 0.95 ? Math.min(viewShift, 0.07) : viewShift;
    if (shift > 0) camera.setViewOffset(w, h, 0, Math.round(h * shift), w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
    }
    bgMat.uniforms.uAspect.value = w / h;
    const keepZoom = camState().dist / (D0 || 1);
    D0 = fitDist();
    if (!tween) {
      const c = camState();
      _s.set(D0 * keepZoom, c.pol, c.az);
      _v.setFromSpherical(_s);
      camera.position.copy(controls.target).add(_v);
    }
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  {
    const v = opts.view || {};
    setView(v.az ?? 28, v.el ?? 8, v.zoom ?? 1);
  }

  /* ---------- pointer, gaze, picking ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(0, 0);
  const ptr = { active: false, last: 0, down: null };
  const setNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  function pick() {
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(robot.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.part) o = o.parent;
      if (o) return o.userData.part;
    }
    return null;
  }
  let lastHover = 0;
  const onMove = (e) => {
    setNdc(e);
    ptr.active = true;
    ptr.last = performance.now();
    if (e.pointerType === 'mouse' && !ptr.down) {
      const now = performance.now();
      if (now - lastHover > 70) {
        lastHover = now;
        canvas.style.cursor = pick() ? 'pointer' : '';
      }
    }
  };
  const onLeave = () => {
    ptr.active = false;
    canvas.style.cursor = '';
  };
  const onDown = (e) => {
    setNdc(e);
    ptr.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    opts.onInteract?.();
  };
  const onUp = (e) => {
    const d = ptr.down;
    ptr.down = null;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && performance.now() - d.t < 600) {
      setNdc(e);
      poke(pick());
    }
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  /* ---------- actions ---------- */
  function setExpression(name, ms) {
    S.expr = name === 'calm' ? 'neutral' : name;
    S.exprUntil = ms ? performance.now() + ms : 0;
  }
  function talkFor(ms) {
    S.talkUntil = Math.max(S.talkUntil, performance.now() + ms);
  }
  function setThinking(on) {
    S.thinking = on;
    if (on) setExpression('think');
    else if (S.expr === 'think') setExpression('neutral');
  }
  function wake() {
    if (!S.sleeping) return false;
    S.sleeping = false;
    setExpression('wow', 700);
    setTimeout(() => {
      if (!S.sleeping && S.expr === 'wow') setExpression('neutral');
    }, 700);
    opts.onSleepChange?.(false);
    return true;
  }
  function wave() {
    wake();
    S.waveUntil = performance.now() + 3200;
    setExpression('happy', 3200);
  }
  function dance() {
    wake();
    const n = performance.now();
    S.danceStart = n;
    S.danceUntil = n + 7000;
    setExpression('happy', 7000);
  }
  function sleep() {
    S.sleeping = true;
    setExpression('sleep');
    S.danceUntil = 0;
    S.waveUntil = 0;
    opts.onSleepChange?.(true);
  }
  function setGlow(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    S.glowHex = hex;
    S.glow.set(hex);
    [M.glow, M.strip, M.earIn].forEach((m) => m.emissive.copy(S.glow));
    led.material.color.copy(S.glow).multiplyScalar(2.4);
    edge.material.color.copy(S.glow).multiplyScalar(2.2);
    bgMat.uniforms.uGlow.value.copy(S.glow);
    floorGlow.color.copy(S.glow);
    rim.color.copy(S.glow).lerp(new THREE.Color(1, 1, 1), 0.35);
    earL.userData.light.color.copy(S.glow);
    earR.userData.light.color.copy(S.glow);
    drawRing();
    face.invalidate();
    opts.onGlowChange?.(hex);
  }
  function setAutoSpin(on) {
    controls.autoRotate = !!on;
    if (on) {
      tween = null;
      opts.onViewChange?.(null);
    }
    opts.onSpinChange?.(!!on);
  }

  const POKES = {
    head: [['happy', 'Hee! That tickles my shell.'], ['love', 'Aww. Do that again.'], ['sparkle', 'Ooh, pat accepted. +10 happiness.']],
    visor: [['wink', 'Eyes up here! Well, they are all up here.'], ['wow', 'Whoa, my screen is not a touchscreen. Okay, a little.'], ['sparkle', 'Careful, I just cleaned that.']],
    ear: [['wow', 'Bzzt! Those are my ear rings, they glow when I listen.'], ['happy', 'I can hear you. Loud and clear.']],
    antenna: [['wow', 'Whoa! Careful with the antenna, it is how I find good ideas.'], ['sparkle', 'Boing! Signal boosted.']],
    belly: [['happy', 'Ha! Ticklish! Stop, my servos are giggling.'], ['love', 'That is my battery bay. Very cozy in there.']],
    arm: [['happy', 'Hello!']],
    leg: [['happy', 'Wiggle wiggle. These feet are built for sitting, mostly.']],
    foot: [['happy', 'Wiggle wiggle. These feet are built for sitting, mostly.'], ['sparkle', 'Go on, count the stripes. Two each.']],
  };
  function poke(part) {
    if (!part) return;
    if (S.sleeping) {
      wake();
      opts.onSpeak?.('Mm? Oh, hello. I was just resting my eyes.', 'happy');
      return;
    }
    const lst = POKES[part];
    const [mood, line] = lst[Math.floor(Math.random() * lst.length)];
    S.squish = 1;
    S.squishPh = 0;
    if (part === 'head' || part === 'visor') {
      S.nod = 1;
      S.nodPh = 0;
    }
    if (part === 'ear') S.earFlash = 1;
    if (part === 'antenna') S.antVel += 9;
    if (part === 'arm') S.waveUntil = performance.now() + 2600;
    if (part === 'leg' || part === 'foot') S.kick = performance.now() + 1800;
    opts.onSpeak?.(line, mood);
  }

  /* ---------- animation ---------- */
  const headWorld = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  let yawCur = 0;
  let pitchCur = 0;
  let rollCur = 0;
  let lastYaw = 0;
  let lastFace = 0;
  let lastRead = 0;
  let last = performance.now();

  function update(dt, t, now) {
    if (S.exprUntil && now > S.exprUntil && !S.sleeping) {
      S.expr = S.thinking ? 'think' : 'neutral';
      S.exprUntil = 0;
    }
    const talking = now < S.talkUntil;
    S.talk = damp(S.talk, talking ? 0.55 + 0.45 * Math.abs(Math.sin(t * 9.7)) : 0, 14, dt);
    if (!S.sleeping) {
      S.nextBlink -= dt;
      if (S.nextBlink < 0) {
        S.blinkT = 0.15;
        S.nextBlink = 2 + Math.random() * 3.5;
      }
    }
    if (S.blinkT > 0) {
      S.blinkT -= dt;
      const k = S.blinkT / 0.15;
      S.blink = Math.sin(clamp(k, 0, 1) * Math.PI);
    } else S.blink = 0;

    S.dance = damp(S.dance, now < S.danceUntil ? 1 : 0, 6, dt);
    S.wave = damp(S.wave, now < S.waveUntil ? 1 : 0, 7, dt);
    const beat = t * 6.4;
    const dn = S.dance;
    const hop = dn * Math.abs(Math.sin(beat)) * (reduceMotion ? 0.04 : 0.15);
    S.squishPh += dt * 18;
    S.squish = Math.max(0, S.squish - dt * 2.2);
    const sq = S.squish * Math.cos(S.squishPh) * 0.5;
    robot.position.y = hop;
    robot.rotation.y = dn * Math.sin(beat * 0.5) * (reduceMotion ? 0.05 : 0.32);
    robot.rotation.z = dn * Math.sin(beat * 0.5 + 0.6) * 0.05;
    robot.scale.set(1 + 0.05 * sq, 1 - 0.07 * sq, 1 + 0.05 * sq);
    blob.scale.set(0.95 * (1 - hop * 0.5), 1.18 * (1 - hop * 0.5), 1);
    blob.material.opacity = 0.8 - hop * 1.2;
    torso.scale.y = 1 + 0.012 * Math.sin(t * 1.7);

    // head looks at the pointer, or at the camera when the pointer is idle
    headPivot.getWorldPosition(headWorld);
    if (ptr.active && now - ptr.last < 5000) {
      ray.setFromCamera(ndc, camera);
      const d = camera.position.distanceTo(headWorld);
      tmp.copy(ray.ray.direction).multiplyScalar(d).add(ray.ray.origin);
    } else tmp.copy(camera.position);
    robot.worldToLocal(tmp2.copy(tmp));
    tmp2.sub(headPivot.position);
    const wantYaw = Math.atan2(tmp2.x, tmp2.z);
    const wantPitch = Math.atan2(tmp2.y - 1.1, Math.hypot(tmp2.x, tmp2.z));
    const sleepy = S.sleeping ? 1 : 0;
    const still = S.sleeping || S.noLook;
    const tYaw = still ? 0 : clamp(wantYaw, -0.8, 0.8);
    const tPitch = still ? 0 : clamp(wantPitch, -0.25, 0.3);
    yawCur = damp(yawCur, tYaw, 6, dt);
    pitchCur = damp(pitchCur, tPitch, 6, dt);
    S.nodPh += dt * 14;
    S.nod = Math.max(0, S.nod - dt * 1.6);
    const nodv = S.nod * Math.sin(S.nodPh) * 0.12;
    rollCur = damp(rollCur, dn * 0.2 * Math.sin(beat * 0.5), 8, dt);
    headPivot.rotation.set(-pitchCur + sleepy * 0.38 + nodv + S.talk * 0.02 * Math.sin(t * 13), yawCur, rollCur - sleepy * 0.08);
    headPivot.position.y = 2.36 + 0.015 * Math.sin(t * 1.7 + 0.5) - sleepy * 0.04 + dn * Math.abs(Math.sin(beat)) * 0.04;
    const yawVel = (yawCur - lastYaw) / Math.max(dt, 1e-3);
    lastYaw = yawCur;
    S.gx = damp(S.gx, still ? 0 : clamp((wantYaw - yawCur) * 190, -64, 64), 10, dt);
    S.gy = damp(S.gy, still ? 0 : clamp(-(wantPitch - pitchCur) * 190, -36, 36), 10, dt);

    // antenna spring
    S.antVel += (-120 * antPos - 5 * S.antVel) * dt - yawVel * dt * 1.8;
    antPos += S.antVel * dt;
    antPos = clamp(antPos, -0.9, 0.9);
    antenna.rotation.z = -0.1 + antPos;
    antenna.rotation.x = -0.12 + antPos * 0.4;

    // arms
    const wv = S.wave;
    const tL = { sx: lerp(-0.28, -1.0 * Math.sin(beat), dn), sz: lerp(0.22, 1.1 + 0.5 * Math.sin(beat), dn), ex: lerp(-0.7, -1.2, dn), ez: 0 };
    const tR = { sx: lerp(-0.28, 1.0 * Math.sin(beat), dn), sz: lerp(0.22, 1.1 - 0.5 * Math.sin(beat), dn), ex: lerp(-0.7, -1.2, dn), ez: 0 };
    if (wv > 0.01) {
      tL.sx = lerp(tL.sx, 0, wv);
      tL.sz = lerp(tL.sz, 2.55, wv);
      tL.ex = lerp(tL.ex, -0.1, wv);
      tL.ez = wv * 0.55 * Math.sin(t * 11);
    }
    if (S.sleeping) {
      tL.sx = tR.sx = -0.1;
      tL.sz = tR.sz = 0.12;
      tL.ex = tR.ex = -0.35;
    }
    const sm = (k) => 1 - Math.exp(-k * dt);
    [['L', armL, 1], ['R', armR, -1]].forEach(([k, arm, sd]) => {
      const c = A[k];
      const tg = k === 'L' ? tL : tR;
      c.sx += (tg.sx - c.sx) * sm(9);
      c.sz += (tg.sz - c.sz) * sm(9);
      c.ex += (tg.ex - c.ex) * sm(9);
      c.ez += (tg.ez - c.ez) * sm(18);
      arm.rotation.set(c.sx, 0, sd * c.sz);
      arm.userData.el.rotation.set(c.ex, 0, sd * c.ez);
    });
    // legs
    const kick = now < S.kick ? Math.sin(((S.kick - now) / 1800) * Math.PI * 4) : 0;
    const kl = clamp(Math.sin(beat), 0, 1) * dn;
    const kr = clamp(-Math.sin(beat), 0, 1) * dn;
    legL.rotation.x = -0.5 * kl - 0.25 * Math.max(0, kick);
    legR.rotation.x = -0.5 * kr - 0.25 * Math.max(0, -kick) - 0.1 * Math.max(0, kick);

    // glow pulse
    S.earFlash = Math.max(0, S.earFlash - dt * 1.4);
    const base = S.sleeping ? 0.55 : 2.3;
    const pulse = S.sleeping
      ? 0.15 * (0.5 + 0.5 * Math.sin(t * 1.2))
      : 0.25 * Math.sin(t * 2.1) + S.talk * 1.1 + S.earFlash * 2.2 + dn * 0.8 * Math.abs(Math.sin(beat));
    M.glow.emissiveIntensity = base + pulse;
    M.strip.emissiveIntensity = (S.sleeping ? 0.5 : 2.0) + pulse * 0.4;
    M.earIn.emissiveIntensity = (S.sleeping ? 0.05 : 0.16) + S.talk * 0.35 + S.earFlash * 0.8;
    earL.userData.light.intensity = earR.userData.light.intensity = (S.sleeping ? 0.2 : 0.8) + pulse * 0.35;
    led.material.color.copy(S.glow).multiplyScalar(S.sleeping ? 0.4 : 1.4 + 1.2 * (0.5 + 0.5 * Math.sin(t * 2.6)));

    if (now - lastFace > 33) {
      lastFace = now;
      face.update(S, t);
    }

    const c = camState();
    marker.position.set(Math.sin(c.az) * 3.52, 0.08, Math.cos(c.az) * 3.52);
    if (opts.onReadout && now - lastRead > 100) {
      lastRead = now;
      opts.onReadout({ az: (Math.round(deg(c.az)) + 360) % 360, el: Math.round(90 - deg(c.pol)), zoom: D0 / c.dist });
    }
  }

  function render(now) {
    bgMat.uniforms.uTime.value = now / 1000;
    if (composer) {
      if (finalPass) finalPass.uniforms.uTime.value = (now / 1000) % 10;
      composer.render();
    } else renderer.render(scene, camera);
  }

  /* ---------- loop ---------- */
  let visible = true;
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }) : null;
  io?.observe(canvas);
  let raf = 0;
  let first = true;
  let disposed = false;
  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (S.pause || !visible) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepTween(now);
    controls.update();
    update(dt, now / 1000, now);
    render(now);
    if (first) {
      first = false;
      opts.onReady?.();
    }
  }
  raf = requestAnimationFrame(frame);

  /* ---------- public API ---------- */
  function snapshot() {
    return new Promise((resolve) => {
      render(performance.now());
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
  }

  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    io?.disconnect();
    controls.removeEventListener('start', onControlsStart);
    controls.dispose();
    canvas.removeEventListener('keydown', onKey);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => {
        ['map', 'alphaMap', 'emissiveMap'].forEach((k) => m[k] && m[k].dispose());
        m.dispose();
      });
    });
    face.texture.dispose();
    ringTex.dispose();
    envRT.dispose();
    composer?.renderTarget1?.dispose();
    composer?.renderTarget2?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  setGlow(initialGlow);

  return {
    views: VIEWS,
    glows: GLOWS,
    flyTo,
    setView,
    setGlow,
    getGlow: () => S.glowHex,
    wave,
    dance,
    sleep,
    wake,
    isSleeping: () => S.sleeping,
    setAutoSpin,
    isAutoSpinning: () => controls.autoRotate,
    setExpression,
    talkFor,
    setThinking,
    snapshot,
    resize,
    dispose,
    /** Test and screenshot helpers */
    pause: (v = true) => { S.pause = !!v; },
    renderOnce: () => { controls.update(); render(performance.now()); },
    tick: (sec) => { for (let i = 0; i < sec * 60; i++) { last = performance.now(); update(1 / 60, performance.now() / 1000 + i / 60, performance.now() + i * 16); } },
    clean: (v = true) => { S.clean = !!v; resize(); },
    lookAtCamera: (v = true) => { S.noLook = !v; },
    state: S,
  };
}
