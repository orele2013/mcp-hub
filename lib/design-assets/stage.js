// stage.js — base 3D de MCP Hub → Diseño (Three.js r170).
// Resuelve todo lo que no es el objeto: render, luz de estudio, entorno de reflejos, sombra en el suelo,
// controles de órbita con auto-giro, encuadre automático, tamaño de ventana y enlace con el panel Ajustes.
// Uso mínimo en index.html (con el importmap de three):
//
//   import * as THREE from 'three';
//   import { createStage, materials, labelTexture } from './stage.js';
//   const stage = createStage({ background: 'var(--bg)' });
//   const model = new THREE.Group();          // ← construye aquí tu objeto
//   stage.add(model);                         // lo apoya en el suelo, lo centra y encuadra la cámara
//
// Puedes editar este archivo si hace falta, pero normalmente basta con usarlo.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { THREE, RoundedBoxGeometry };

const css = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};
// Acepta un color CSS ("#123", "var(--bg)", "rgb(...)") y devuelve un THREE.Color
export function cssColor(value, fallback = '#ffffff') {
  let v = String(value || '').trim();
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  if (m) v = css(m[1], fallback);
  try { return new THREE.Color(v || fallback); } catch { return new THREE.Color(fallback); }
}

/**
 * Crea la escena lista para mostrar un objeto.
 * Opciones: container (elemento, por defecto <body>), background (color o 'var(--x)', 'transparent'),
 * autoRotate (true), exposure (1), shadow (0.35 = intensidad de la sombra en el suelo), fov (35),
 * view: dirección desde la que se mira, [x, y, z] (por defecto [1, 0.55, 1.35], tres cuartos un poco desde arriba).
 */
export function createStage(opts = {}) {
  const o = { container: document.body, background: 'var(--bg)', autoRotate: true, exposure: 1, shadow: 0.45, fov: 35, view: [1, 0.55, 1.35], ...opts };
  const host = o.container;
  if (host === document.body) Object.assign(document.body.style, { margin: '0', overflow: 'hidden' });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: o.background === 'transparent', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
  if (host === document.body) Object.assign(renderer.domElement.style, { position: 'fixed', inset: '0' });
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const applyBackground = () => { if (o.background !== 'transparent') scene.background = cssColor(o.background, '#f2f2f2'); };
  applyBackground();

  // Entorno de reflejos (estudio) — imprescindible para metal, cristal y barnices
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Luz principal con sombra, luz de recorte y relleno suave
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 6;
  const rim = new THREE.DirectionalLight(0xffffff, 1.1);
  rim.position.set(-4, 3, -4);
  const fill = new THREE.HemisphereLight(0xffffff, 0x444444, 0.35);
  scene.add(key, key.target, rim, fill);

  // Suelo invisible que solo recibe sombra
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: o.shadow }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = '__ground';
  scene.add(ground);

  // Sombra de contacto: un halo suave justo debajo del objeto (lo «apoya» en el suelo, como en una foto de producto)
  const blobCanvas = document.createElement('canvas'); blobCanvas.width = blobCanvas.height = 256;
  const bg2 = blobCanvas.getContext('2d'), grad = bg2.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.45, 'rgba(0,0,0,.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  bg2.fillStyle = grad; bg2.fillRect(0, 0, 256, 256);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCanvas), transparent: true, opacity: o.shadow, depthWrite: false, toneMapped: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.0005; contact.renderOrder = -1;
  contact.name = '__contact';
  scene.add(contact);

  const camera = new THREE.PerspectiveCamera(o.fov, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = !!o.autoRotate;
  controls.autoRotateSpeed = 0.8;
  // El auto-giro se pausa mientras el usuario interactúa y vuelve a los 4 s
  let resume;
  controls.addEventListener('start', () => { clearTimeout(resume); controls.autoRotate = false; });
  controls.addEventListener('end', () => { clearTimeout(resume); if (o.autoRotate) resume = setTimeout(() => { controls.autoRotate = true; }, 4000); });

  const root = new THREE.Group();
  scene.add(root);

  // Apoya el contenido en el suelo, céntralo y encuadra la cámara para que se vea entero
  function frame(padding = 1.25) {
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    root.position.x -= center.x; root.position.z -= center.z; root.position.y -= box.min.y;
    box.setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(sphere.radius, 1e-3);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fit = (r * padding) / Math.sin(Math.min(fov, fov * camera.aspect) / 2);
    const dir = new THREE.Vector3(...o.view).normalize();
    controls.target.set(0, size.y / 2, 0);
    camera.position.copy(controls.target).addScaledVector(dir, fit);
    camera.near = fit / 100; camera.far = fit * 100;
    camera.updateProjectionMatrix();
    controls.minDistance = r * 0.6; controls.maxDistance = fit * 4;
    ground.scale.setScalar(r * 12);
    contact.scale.set(Math.max(size.x, 1e-3) * 1.6, Math.max(size.z, 1e-3) * 1.6, 1);
    // La sombra se ajusta al tamaño del objeto (si no, sale pixelada o cortada)
    const s = key.shadow.camera;
    s.left = s.bottom = -r * 2; s.right = s.top = r * 2; s.near = 0.01; s.far = r * 20;
    // Luz casi cenital: la sombra cae justo debajo, como en una foto de producto
    key.position.set(r * 0.9, r * 5, r * 1.1); key.target.position.set(0, 0, 0);
    s.updateProjectionMatrix();
    controls.update();
  }

  // Añade objetos: activa sombras en todas sus mallas y reencuadra
  function add(...objects) {
    for (const obj of objects) {
      obj.traverse?.((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      root.add(obj);
    }
    frame();
    return objects[0];
  }

  function resize() {
    const w = host === document.body ? innerWidth : host.clientWidth, h = host === document.body ? innerHeight : host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host === document.body ? document.documentElement : host);
  resize();

  // Panel Ajustes de MCP Hub: cambia variables CSS en :root; avisamos para que el modelo pueda reaccionar
  const styleListeners = new Set([applyBackground]);
  new MutationObserver(() => styleListeners.forEach((f) => f())).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

  const updaters = new Set();
  const clock = new THREE.Clock();
  let first = true;
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta(), t = clock.elapsedTime;
    updaters.forEach((f) => f(dt, t));
    controls.update();
    renderer.render(scene, camera);
    if (first) { first = false; window.__stageReady = true; }
  });

  const api = {
    THREE, scene, camera, renderer, controls, root, key, rim, fill, ground, contact,
    add, frame,
    /** Ejecuta f(dt, t) en cada fotograma (animaciones). */
    onFrame: (f) => updaters.add(f),
    /** Ejecuta f() cuando el usuario cambia algo en el panel Ajustes. */
    onTweak: (f) => { styleListeners.add(f); f(); },
    /** Mira desde una dirección fija ('front', 'side', 'top', 'three-quarter' o [x, y, z]) y para el auto-giro. */
    setView(view) {
      const V = { front: [0, 0.15, 1], side: [1, 0.15, 0], top: [0.001, 1, 0.001], back: [0, 0.15, -1], 'three-quarter': [1, 0.55, 1.35] };
      o.view = Array.isArray(view) ? view : V[view] || V['three-quarter'];
      o.autoRotate = false; controls.autoRotate = false; root.position.set(0, 0, 0); frame();
    },
    /** Lee una variable CSS (p. ej. '--accent') como THREE.Color. */
    color: (name, fallback) => cssColor(`var(${name})`, fallback),
  };
  window.stage = api; // accesible desde la consola para depurar
  return api;
}

// ---------- Materiales de partida (PBR). Pasa un color o 'var(--x)'. ----------
export const materials = {
  plastic: (color = '#e8e8e8', roughness = 0.45) => new THREE.MeshStandardMaterial({ color: cssColor(color), roughness, metalness: 0 }),
  matte: (color = '#d0d0d0') => new THREE.MeshStandardMaterial({ color: cssColor(color), roughness: 0.9, metalness: 0 }),
  metal: (color = '#c8c8c8', roughness = 0.25) => new THREE.MeshStandardMaterial({ color: cssColor(color), roughness, metalness: 1 }),
  gold: (roughness = 0.2) => new THREE.MeshStandardMaterial({ color: new THREE.Color('#e6b85c'), roughness, metalness: 1 }),
  chrome: () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), roughness: 0.04, metalness: 1 }),
  // Cristal de verdad: transmisión + grosor. Para líquido dentro, pon otra malla un poco más pequeña con liquid().
  glass: (tint = '#ffffff', { roughness = 0.02, thickness = 0.35, ior = 1.5 } = {}) => new THREE.MeshPhysicalMaterial({
    color: cssColor(tint), roughness, metalness: 0, transmission: 1, thickness, ior, specularIntensity: 1, envMapIntensity: 1.4 }),
  // Opaco a propósito: Three.js no dibuja un material transmisivo dentro de otro, así el líquido se ve a través del cristal
  liquid: (color = '#f3c97a') => new THREE.MeshPhysicalMaterial({ color: cssColor(color), roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, sheen: 0.4, sheenColor: cssColor(color) }),
  lacquer: (color = '#b0182b') => new THREE.MeshPhysicalMaterial({ color: cssColor(color), roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }),
  fabric: (color = '#8a8f99') => new THREE.MeshPhysicalMaterial({ color: cssColor(color), roughness: 1, sheen: 1, sheenRoughness: 0.6, sheenColor: cssColor(color).clone().offsetHSL(0, 0, 0.2) }),
  wood: (color = '#9a6b3f') => new THREE.MeshStandardMaterial({ color: cssColor(color), roughness: 0.7, metalness: 0 }),
  emissive: (color = '#ffffff', intensity = 2) => new THREE.MeshStandardMaterial({ color: cssColor(color), emissive: cssColor(color), emissiveIntensity: intensity }),
};

/**
 * Textura con texto o un logo sencillo dibujado en canvas, para etiquetas, marcas y placas.
 * labelTexture({ text: 'NO. 5', sub: 'CHANEL', bg: '#f4efe6', fg: '#111', font: '600 120px Didot, serif', width: 1024, height: 512 })
 * Úsala en un material: materials.plastic() con .map = labelTexture(...), o new THREE.MeshStandardMaterial({ map }).
 */
export function labelTexture({ text = '', sub = '', bg = 'transparent', fg = '#111111', font = '600 140px system-ui, sans-serif', subFont = '500 54px system-ui, sans-serif', width = 1024, height = 512, draw } = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');
  if (bg !== 'transparent') { g.fillStyle = cssColor(bg).getStyle(); g.fillRect(0, 0, width, height); }
  g.fillStyle = cssColor(fg).getStyle();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (draw) draw(g, width, height);
  else {
    g.font = font; g.fillText(text, width / 2, sub ? height * 0.42 : height / 2);
    if (sub) { g.font = subFont; g.fillText(sub, width / 2, height * 0.72); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Perfil de revolución (frascos, botellas, vasos, jarrones, lámparas…): puntos [radio, altura] de abajo arriba. */
export function lathe(profile, segments = 96) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  g.computeVertexNormals();
  return g;
}

/** Extruye una silueta 2D (logos, piezas planas, letras) con bisel: shape = [[x, y], …] */
export function extrude(points, depth = 0.1, bevel = 0.01) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 32 });
  g.center();
  return g;
}

/** Caja con esquinas redondeadas (casi todo lo fabricado tiene cantos suaves). */
export const roundedBox = (w, h, d, radius = Math.min(w, h, d) * 0.08, segments = 5) => new RoundedBoxGeometry(w, h, d, segments, radius);
