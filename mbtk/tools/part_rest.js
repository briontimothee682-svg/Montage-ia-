/* ---------- post-production : profondeur de champ, bloom, flous de mouvement, étalonnage, FXAA ---------- */
let rtMain, rtH1, rtH2, rtLDR, rtPortal, postScene, postCam, quad, matBright, matBlur, matComp, matFxaa;
const camP = new THREE.PerspectiveCamera(FOV, W / H, 0.03, 80);
function buildPost() {
  const canHalf = renderer.capabilities.isWebGL2 ? !!renderer.extensions.get('EXT_color_buffer_float') || !!renderer.extensions.get('EXT_color_buffer_half_float') : !!renderer.extensions.get('OES_texture_half_float') && !!renderer.extensions.get('EXT_color_buffer_half_float');
  const type = canHalf ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
  rtMain = new THREE.WebGLRenderTarget(RW, RH, { ...lin, type });
  rtMain.depthTexture = new THREE.DepthTexture(RW, RH); rtMain.depthTexture.type = THREE.UnsignedIntType;
  rtPortal = new THREE.WebGLRenderTarget(RW, RH, { ...lin, type });
  rtLDR = new THREE.WebGLRenderTarget(RW, RH, { ...lin, type: THREE.UnsignedByteType });
  const bw = Math.round(RW / 4), bh = Math.round(RH / 4);
  rtH1 = new THREE.WebGLRenderTarget(bw, bh, { ...lin, type });
  rtH2 = rtH1.clone();
  postScene = new THREE.Scene(); postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const vs = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  matBright = new THREE.ShaderMaterial({ uniforms: { tC: { value: null }, uPx: { value: new THREE.Vector2(1 / RW, 1 / RH) }, uThr: { value: 1.35 } }, vertexShader: vs,
    fragmentShader: 'uniform sampler2D tC;uniform vec2 uPx;uniform float uThr;varying vec2 vUv;void main(){vec3 c=vec3(0.);c+=texture2D(tC,vUv+uPx*vec2(-1.,-1.)).rgb;c+=texture2D(tC,vUv+uPx*vec2(1.,-1.)).rgb;c+=texture2D(tC,vUv+uPx*vec2(-1.,1.)).rgb;c+=texture2D(tC,vUv+uPx*vec2(1.,1.)).rgb;c*=.25;c=min(c,vec3(2.5));float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*max(l-uThr,0.)/max(l,1e-4),1.);}' });
  matBlur = new THREE.ShaderMaterial({ uniforms: { tC: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: vs,
    fragmentShader: 'uniform sampler2D tC;uniform vec2 uDir;varying vec2 vUv;void main(){vec3 c=texture2D(tC,vUv).rgb*.227;c+=(texture2D(tC,vUv+uDir*1.385).rgb+texture2D(tC,vUv-uDir*1.385).rgb)*.316;c+=(texture2D(tC,vUv+uDir*3.231).rgb+texture2D(tC,vUv-uDir*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}' });
  matComp = new THREE.ShaderMaterial({
    uniforms: {
      tC: { value: null }, tD: { value: null }, tB: { value: null }, uRes: { value: new THREE.Vector2(RW, RH) }, uNear: { value: camera.near }, uFar: { value: camera.far },
      uFocus: { value: 3 }, uAp: { value: 0 }, uMax: { value: 26 * Q }, uRadial: { value: 0 }, uRadC: { value: new THREE.Vector2(.5, .5) }, uDir: { value: 0 },
      uSlit: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(.62, .1, .2) }, uExpo: { value: 1 }, uBloom: { value: .55 }, uCA: { value: .0007 }
    }, vertexShader: vs,
    fragmentShader: `
      uniform sampler2D tC,tD,tB;uniform vec2 uRes,uRadC;uniform float uNear,uFar,uFocus,uAp,uMax,uRadial,uDir,uSlit,uFlash,uExpo,uBloom,uCA;uniform vec3 uFlashCol;varying vec2 vUv;
      float lin(vec2 uv){float z=texture2D(tD,uv).x*2.-1.;return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
      float coc(float d){return clamp(uAp*abs(1.-uFocus/d),0.,uMax);}
      vec3 tm(vec3 c){vec3 o;for(int i=0;i<3;i++){float x=c[i];o[i]=x<.7?x:.7+.3*(1.-exp(-(x-.7)/.3));}return o;}
      void main(){
        vec2 uv=vUv;
        vec3 col;
        vec2 bv=(uv-uRadC)*uRadial+vec2(uDir,0.);
        float bl=length(bv*uRes);
        if(bl>1.5){
          col=vec3(0.);float ws=0.;
          for(int i=0;i<24;i++){float t=float(i)/23.;vec2 o=bv*(t-.15);float w=1.-t*.5;
            vec2 su=uv-o; col+=vec3(texture2D(tC,su+vec2(uCA*2.,0.)).r,texture2D(tC,su).g,texture2D(tC,su-vec2(uCA*2.,0.)).b)*w;ws+=w;}
          col/=ws;
        } else if(uAp>.01){
          float dc=lin(uv);float cc=coc(dc);
          col=texture2D(tC,uv).rgb;float ws=1.;
          for(int i=0;i<${DOF_TAPS};i++){
            float fi=float(i)+.5;float r=sqrt(fi/${DOF_TAPS}.)*uMax;float a=fi*2.39996;
            vec2 o=vec2(cos(a),sin(a))*r/uRes;
            float ds=lin(uv+o);float sc=coc(ds);
            if(ds>dc)sc=min(sc,cc*2.+.5);
            float w=smoothstep(r-1.5,r+.5,sc);
            col+=texture2D(tC,uv+o).rgb*w;ws+=w;}
          col/=ws;
        } else col=texture2D(tC,uv).rgb;
        vec2 cd=uv-.5;float ca=dot(cd,cd)*uCA*6.;
        if(bl<=1.5){col.r=mix(col.r,texture2D(tC,uv+cd*ca).r,.6);col.b=mix(col.b,texture2D(tC,uv-cd*ca).b,.6);}
        col+=texture2D(tB,uv).rgb*uBloom;
        col*=uExpo;
        float L=dot(col,vec3(.2126,.7152,.0722));
        col=mix(col,col*vec3(1.06,.94,1.0)+vec3(.010,.002,.012),1.-smoothstep(.0,.35,L));
        col=mix(col,col*vec3(1.05,1.0,.92),smoothstep(.4,1.2,L));
        col=tm(col);
        col=mix(col,uFlashCol,uFlash);
        col=pow(max(col,0.),vec3(1./2.2));
        gl_FragColor=vec4(col,1.);
      }`
  });
  matFxaa = new THREE.ShaderMaterial({
    uniforms: { tC: { value: null }, uPx: { value: new THREE.Vector2(1 / RW, 1 / RH) }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(RW, RH) } }, vertexShader: vs,
    fragmentShader: `uniform sampler2D tC;uniform vec2 uPx,uRes;uniform float uTime;varying vec2 vUv;
      float lu(vec3 c){return dot(c,vec3(.299,.587,.114));}
      void main(){
        vec3 nw=texture2D(tC,vUv+vec2(-1.,-1.)*uPx).rgb,ne=texture2D(tC,vUv+vec2(1.,-1.)*uPx).rgb,sw=texture2D(tC,vUv+vec2(-1.,1.)*uPx).rgb,se=texture2D(tC,vUv+vec2(1.,1.)*uPx).rgb,m=texture2D(tC,vUv).rgb;
        float lNW=lu(nw),lNE=lu(ne),lSW=lu(sw),lSE=lu(se),lM=lu(m);
        float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE))),lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
        vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),(lNW+lSW)-(lNE+lSE));
        float red=max((lNW+lNE+lSW+lSE)*.03125,1./128.);float rc=1./(min(abs(dir.x),abs(dir.y))+red);
        dir=clamp(dir*rc,vec2(-8.),vec2(8.))*uPx;
        vec3 a=.5*(texture2D(tC,vUv+dir*(1./3.-.5)).rgb+texture2D(tC,vUv+dir*(2./3.-.5)).rgb);
        vec3 b=a*.5+.25*(texture2D(tC,vUv-dir*.5).rgb+texture2D(tC,vUv+dir*.5).rgb);
        float lB=lu(b);vec3 c=(lB<lMin||lB>lMax)?a:b;
        c+=(fract(sin(dot(vUv*uRes+uTime,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;
        gl_FragColor=vec4(c,1.);}`
  });
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matComp); postScene.add(quad);
}
function renderFrame(scene) {
  if (scene === sceneA && screenUniforms.uPortal.value > 0.001) {
    FAR.forEach(m => m.visible = false);
    renderer.setRenderTarget(rtPortal); renderer.render(sceneB, camP);
    FAR.forEach(m => m.visible = true);
    screenUniforms.tPortal.value = rtPortal.texture;
  }
  if (QS.has('nopost')) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
  renderer.setRenderTarget(rtMain); renderer.render(scene, camera);
  quad.material = matBright; matBright.uniforms.tC.value = rtMain.texture; renderer.setRenderTarget(rtH1); renderer.render(postScene, postCam);
  quad.material = matBlur; matBlur.uniforms.tC.value = rtH1.texture; matBlur.uniforms.uDir.value.set(1.6 / rtH1.width, 0); renderer.setRenderTarget(rtH2); renderer.render(postScene, postCam);
  matBlur.uniforms.tC.value = rtH2.texture; matBlur.uniforms.uDir.value.set(0, 1.6 / rtH1.height); renderer.setRenderTarget(rtH1); renderer.render(postScene, postCam);
  matBlur.uniforms.tC.value = rtH1.texture; matBlur.uniforms.uDir.value.set(3.2 / rtH1.width, 0); renderer.setRenderTarget(rtH2); renderer.render(postScene, postCam);
  matBlur.uniforms.tC.value = rtH2.texture; matBlur.uniforms.uDir.value.set(0, 3.2 / rtH1.height); renderer.setRenderTarget(rtH1); renderer.render(postScene, postCam);
  quad.material = matComp; const u = matComp.uniforms;
  u.tC.value = rtMain.texture; u.tD.value = rtMain.depthTexture; u.tB.value = rtH1.texture;
  renderer.setRenderTarget(rtLDR); renderer.render(postScene, postCam);
  quad.material = matFxaa; matFxaa.uniforms.tC.value = rtLDR.texture;
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}

/* =====================================================================
   POSES & ANIMATION
   ===================================================================== */
const _m = new THREE.Matrix4();
function look(eye, tgt, up) { const m = new THREE.Matrix4().lookAt(V3(...eye), V3(...tgt), up || V3(0, 1, 0)); return { p: V3(...eye), q: new THREE.Quaternion().setFromRotationMatrix(m) }; }
function lookV(eye, tgt, up) { const m = new THREE.Matrix4().lookAt(eye, tgt, up || V3(0, 1, 0)); return { p: eye.clone(), q: new THREE.Quaternion().setFromRotationMatrix(m) }; }
function mixPose(a, b, k) { return { p: a.p.clone().lerp(b.p, k), q: a.q.clone().slerp(b.q, k) }; }
function setFov(f) { if (Math.abs(camera.fov - f) > 1e-4) { camera.fov = f; camera.updateProjectionMatrix(); } TANH = Math.tan(f * DEG / 2); }
const K_OVER = 1.02;
const qFlat = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), -12 * DEG).multiply(new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), -Math.PI / 2));
const BURSTS = [[0, .4], [.6, 1.0], [1.6, 2.0], [2.2, 2.6], [3.2, 3.6], [3.8, 4.2], [4.8, 5.0], [57.2, 57.6]];
function buzzEnv(t) { let e = 0; for (const [a, b] of BURSTS) { if (t > a && t < b) e = Math.max(e, Math.min(1, (t - a) / .03, (b - t) / .05)); } return e; }
function slide(t) { let s = 0; for (let i = 0; i < 7; i++) { const [a, b] = BURSTS[i]; s += E.sine(inv(a, b, t)); } return t > 30 ? 0 : s; }
function phonePose(t) {
  const env = buzzEnv(t), sl = slide(t);
  const flatP = V3(.009 * sl, PD / 2, .0045 * sl);
  const jit = env * .0045;
  flatP.x += Math.sin(t * 2 * Math.PI * 41) * jit; flatP.z += Math.cos(t * 2 * Math.PI * 37) * jit;
  const flatQ = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), -.003 * sl + Math.sin(t * 2 * Math.PI * 29) * env * .006).multiply(qFlat);
  const flat = { p: flatP, q: flatQ };
  const bob = Math.sin(t * 1.3) * .03;
  const upQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(t * .7) * .06, Math.sin(t * .45) * .3 + .05, Math.sin(t * .9) * .02));
  const up = { p: V3(0, 1.38 + bob, 0), q: upQ };
  if (t < 7.45 || t >= 56) return flat;
  const k = E.cubicInOut(inv(7.45, 8.45, t));
  const pose = mixPose(flat, up, k);
  pose.p.y += Math.sin(k * Math.PI) * .25;
  pose.q.multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), E.cubicInOut(k) * Math.PI * 2));
  return pose;
}
function screenPose(over = K_OVER) {
  phone.updateMatrixWorld(true);
  const q = phone.getWorldQuaternion(new THREE.Quaternion());
  const c = V3(0, 0, SZ).applyMatrix4(phone.matrixWorld);
  const d = SW / (over * 2 * TANH * (W / H));
  const n = V3(0, 0, 1).applyQuaternion(q);
  return { p: c.addScaledVector(n, d), q };
}
function relPose(dist, yaw, pitch, ty = 0) {
  phone.updateMatrixWorld(true);
  const q = phone.getWorldQuaternion(new THREE.Quaternion());
  const tgt = V3(0, ty, SZ).applyMatrix4(phone.matrixWorld);
  const dir = V3(0, 0, 1).applyEuler(new THREE.Euler(-pitch * DEG, yaw * DEG, 0, 'YXZ')).applyQuaternion(q);
  const up = V3(0, 1, 0).applyQuaternion(q);
  return lookV(tgt.clone().addScaledVector(dir, dist), tgt, up);
}
const PC = V3(0, 1.38, 0);
const CAMA = {
  A0: look([.66, 3.25, 2.25], [.05, 0, -.38]),
  A1: look([.58, 2.98, 2.0], [.05, 0, -.34]),
  C1: look([1.15, 1.85, 5.1], [0, 1.3, 0]),
  C2: look([-1.05, 1.62, 5.35], [0, 1.32, 0]),
  C3: look([.85, 1.7, 6.9], [0, 1.4, 0]),
  C3b: look([.55, 1.6, 6.5], [0, 1.4, 0]),
  C4: look([.3, 1.52, 6.0], [0, 1.4, 0]),
  C4b: look([.12, 1.48, 5.8], [0, 1.4, 0]),
  C5: look([.5, 3.55, 7.7], [0, .78, 0]),
  C6: look([-.7, 3.35, 7.3], [0, .78, 0]),
};
const S = () => screenPose();
let POSE73 = null;
const KA = [
  [0, CAMA.A0], [3.4, CAMA.A1, E.sine], [4.38, S, E.expoIn], [5.3, S],
  [6.2, () => relPose(2.75, 16, -34), E.expoOut], [7.3, () => relPose(2.95, 30, -30), E.sine], [8.5, CAMA.C1],
  [14.3, CAMA.C2, E.sine], [15.2, CAMA.C3, E.cubicInOut], [22.3, CAMA.C3b, E.sine], [23.0, CAMA.C4, E.expoOut], [25.45, CAMA.C4b, E.sine],
  [26.25, S, E.expoInOut], [26.85, S], [27.7, () => relPose(3.25, -20, 8, .2), E.expoOut], [29.75, () => relPose(3.35, -27, 5, .2), E.sine], [30.25, S, E.cubicInOut],
  [30.85, S], [31.7, () => relPose(3.25, 20, 8, .2), E.expoOut], [33.75, () => relPose(3.35, 27, 5, .2), E.sine], [34.25, S, E.cubicInOut], [34.5, S],
  [35.3, CAMA.C5, E.expoOut], [40.25, CAMA.C6, E.sine], [41.0, S, E.expoIn]
];
function evalPose(p) { return typeof p === 'function' ? p() : p; }
function camA(t) {
  if (t >= 56) { if (t < 57.45) return S(); return mixPose(S(), CAMA.A0, E.expoOut(inv(57.45, 58, t))); }
  if (t >= 7.3 && t < 8.5) { // le téléphone se lève et pivote : la caméra le garde au centre
    const k = E.cubicInOut(inv(7.3, 8.5, t));
    const p0 = POSE73;
    const pos = p0.p.clone().lerp(CAMA.C1.p, k);
    const ctr = phone.position.clone();
    const lk = lookV(pos, ctr);
    return { p: pos, q: p0.q.clone().slerp(lk.q, E.sine(inv(0, .35, k))).slerp(CAMA.C1.q, E.sine(inv(.65, 1, k))) };
  }
  let i = 0; while (i < KA.length - 1 && t >= KA[i + 1][0]) i++;
  const a = KA[i], b = KA[i + 1];
  if (!b) return evalPose(a[1]);
  const pose = mixPose(evalPose(a[1]), evalPose(b[1]), (b[2] || E.lin)(inv(a[0], b[0], t)));
  if (t < 3.4) { const h = Math.sin(Math.PI * Math.min(1, t / 3.4)) * .006; pose.p.x += Math.sin(t * 1.7) * h; pose.p.y += Math.sin(t * 2.3 + 1) * h; }
  return pose;
}
// ---- couloir → chambre
let HALL, B0, B1, B2, DISP_T, BED_T = V3(-.02, .74, -.45);
function computeHall() {
  { const ph = phonePose(7.3); phone.position.copy(ph.p); phone.quaternion.copy(ph.q); phone.updateMatrixWorld(true); POSE73 = relPose(2.95, 30, -30); }
  const d = SW / (K_OVER * 2 * Math.tan(FOV * DEG / 2) * (W / H));
  const p0 = V3(PB.x, PB.y, PB.z + d * PS);
  HALL = new THREE.CatmullRomCurve3([p0, V3(.87, 1.33, 11.4), V3(1.0, 1.42, 8.2), V3(.84, 1.38, 5.2), V3(.9, 1.34, 3.3), V3(.98, 1.33, 2.5), V3(1.02, 1.32, 1.95)], false, 'centripetal');
  B0 = lookV(V3(1.02, 1.32, 1.95), BED_T);
  laptop.updateMatrixWorld(true);
  const disp = laptop.userData.disp; const c = disp.getWorldPosition(new THREE.Vector3()); const q = disp.getWorldQuaternion(new THREE.Quaternion());
  const n = V3(0, 0, 1).applyQuaternion(q), up = V3(0, 1, 0).applyQuaternion(q), rt = V3(1, 0, 0).applyQuaternion(q);
  DISP_T = c.clone().addScaledVector(up, -.012);
  B1 = lookV(c.clone().addScaledVector(n, .6).addScaledVector(rt, .05).addScaledVector(up, .06), DISP_T, V3(0, 1, 0));
  B2 = lookV(c.clone().addScaledVector(n, .2), c, up);
}
function camB(t) {
  if (t < 43.4) {
    const k = inv(41.0, 43.4, t), u = 1 - Math.pow(1 - k, 2.1);
    const pos = HALL.getPointAt(u);
    const tg = pos.clone().add(HALL.getTangentAt(Math.min(1, u + .03)));
    const w = E.cubicInOut(inv(.6, 1, u)); tg.lerp(BED_T, w);
    const pose = lookV(pos, tg);
    pose.q.multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), Math.sin(u * Math.PI * 3) * .035 * (1 - w)));
    pose.q = new THREE.Quaternion().slerp(pose.q, E.cubicOut(inv(41.0, 41.35, t)));
    return pose;
  }
  if (t < 50.5) { // lent travelling : la caméra garde toujours le Mac dans le cadre
    const k = E.quadInOut(inv(43.4, 50.5, t));
    const pos = B0.p.clone().lerp(B1.p, k);
    const tgt = BED_T.clone().lerp(DISP_T, E.cubicInOut(Math.min(1, k * 1.6)));
    return lookV(pos, tgt);
  }
  return mixPose(B1, B2, E.expoIn(inv(50.5, 51.0, t)));
}
// ---- portail : la caméra vue "à travers" l'écran du téléphone, transposée dans le couloir
function updatePortalCam() {
  const q = phone.getWorldQuaternion(new THREE.Quaternion()); const c = V3(0, 0, SZ).applyMatrix4(phone.matrixWorld);
  const qi = q.clone().invert();
  const local = camera.position.clone().sub(c).applyQuaternion(qi).multiplyScalar(PS);
  camP.position.copy(PB).add(local); camP.quaternion.copy(qi.multiply(camera.quaternion));
  if (Math.abs(camP.fov - camera.fov) > 1e-4) { camP.fov = camera.fov; camP.updateProjectionMatrix(); }
  camP.updateMatrixWorld(true);
}
function stageToCam(x, y, depth) { const hh = TANH * depth, hw = hh * W / H; return V3((x / W - .5) * 2 * hw, (.5 - y / H) * 2 * hh, -depth); }
function camWorld(local) { return local.clone().applyMatrix4(camera.matrixWorld); }
function camQuat(extra) { const q = camera.quaternion.clone(); if (extra) q.multiply(extra); return q; }
function stageWidth(px, depth) { return px / W * 2 * TANH * depth * W / H; }

/* ---------- état animé (piloté par GSAP) ---------- */
const P = { radial: 0, dir: 0, flash: 0, rip: 0, pulse: 1, pglow: 0, scroll: 0, shade: 0, portal: 0, glow: 0, fov: FOV };
let tl;
function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/); const frag = document.createDocumentFragment();
        parts.forEach(p => { if (!p) return; if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(' ')); else { const s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s); } });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'SMALL') walk(n);
    });
  };
  walk(el); return el.querySelectorAll('.w, small');
}
function fitWidth(el, max = 860) { let fs = parseFloat(getComputedStyle(el).fontSize); el.style.opacity = 1; while (el.scrollWidth > max + 1 && fs > 20) { fs -= 2; el.style.fontSize = fs + 'px'; } el.style.opacity = 0; }
const CARD_T = [8.5, 10.0, 11.5, 13.0], ARG_T = [15.0, 16.3, 17.6, 18.9, 20.2], SNAPS = [36.0, 36.75, 37.5, 38.25, 39.0], LAND = [51.58, 51.72, 51.86, 52.0];

function buildTimeline() {
  ['t1', 't4', 't5', 't6'].forEach(id => fitWidth(document.getElementById(id)));
  tl = gsap.timeline({ paused: true });
  const $ = id => document.getElementById(id);
  const slamIn = (id, at, st = .06) => { const el = $(id); const ws = splitWords(el); tl.set(el, { opacity: 1 }, at); tl.fromTo(ws, { opacity: 0, y: 70, scale: 1.4, filter: 'blur(14px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: .45, ease: 'expo.out', stagger: st }, at); return ws; };
  const out = (id, at, d = .28) => { tl.to($(id), { opacity: 0, y: -50, filter: 'blur(12px)', duration: d, ease: 'power2.in' }, at); };
  const ir = { immediateRender: false };
  // 1 · accroche
  tl.to(P, { shade: 1, duration: .2 }, .25);
  slamIn('t1', .3, 0);
  slamIn('t2', 1.0, .06);
  tl.to(['#t1', '#t2'], { opacity: 0, scale: 1.5, y: -120, filter: 'blur(18px)', duration: .45, ease: 'power3.in', transformOrigin: '50% 0%' }, 3.35);
  tl.to(P, { shade: 0, duration: .4 }, 3.45);
  tl.fromTo(P, { radial: 0 }, { radial: .16, duration: .88, ease: 'expo.in' }, 3.5).to(P, { radial: 0, duration: .16, ease: 'power2.out' }, 4.38);
  // 2 · décroché, l'interface sort de l'écran
  tl.fromTo(P, { rip: 0 }, { rip: 1, duration: .3, ease: 'power2.out' }, 5.0);
  tl.fromTo(P, { pulse: 1 }, { pulse: .9, duration: .08, ease: 'power2.out' }, 5.0).to(P, { pulse: 1, duration: .2, ease: 'back.out(3)' }, 5.08);
  tl.fromTo(P, { flash: 0 }, { flash: .5, duration: .06 }, 5.12).to(P, { flash: 0, duration: .45, ease: 'power2.out' }, 5.18);
  tl.fromTo(P, { radial: 0 }, { radial: .05, duration: .12, ...ir }, 7.35).to(P, { radial: 0, duration: .5 }, 7.47);
  // 3 · ce qu'on crée
  tl.to(P, { shade: .8, duration: .3 }, 8.2);
  slamIn('t3', 8.3, .07); out('t3', 14.2);
  // 4 · pourquoi nous
  slamIn('t4', 14.6, .08); out('t4', 22.25);
  tl.to(P, { shade: 0, duration: .3 }, 22.2);
  tl.fromTo(P, { flash: 0 }, { flash: .22, duration: .06, ...ir }, 22.7).to(P, { flash: 0, duration: .35 }, 22.76);
  // 5 · réseaux
  tl.fromTo(P, { radial: 0 }, { radial: .09, duration: .55, ease: 'power2.in', ...ir }, 25.6).to(P, { radial: 0, duration: .15 }, 26.15);
  for (const a of [26.5, 30.5]) tl.fromTo(P, { dir: 0 }, { keyframes: [{ dir: .05, duration: .15, ease: 'power2.in' }, { dir: 0, duration: .15, ease: 'power2.out' }], ...ir }, a);
  tl.to(P, { shade: .9, duration: .25 }, 26.9);
  slamIn('t5', 27.0, .05); out('t5', 29.6, .2);
  slamIn('t6', 31.0, .05); out('t6', 33.6, .2);
  tl.to(P, { shade: 0, duration: .25 }, 33.8);
  for (const [a, b] of [[27.7, 29.7], [31.7, 33.7]]) {
    tl.fromTo(P, { pglow: 0 }, { pglow: 1, duration: .25, ...ir }, a);
    for (let k = a; k < b - .3; k += .5) tl.to(P, { keyframes: [{ pulse: 1.1, duration: .16, ease: 'power2.out' }, { pulse: 1, duration: .34, ease: 'power2.inOut' }] }, k);
    tl.to(P, { pglow: 0, duration: .2 }, b - .15);
  }
  for (const [a, b] of [[27.95, 29.45], [31.95, 33.45]]) {
    tl.fromTo('#hand', { opacity: 0, x: 60, y: 120, rotate: -10 }, { opacity: 1, x: 0, y: 0, rotate: 0, duration: .3, ease: 'back.out(2)', ...ir }, a);
    tl.to('#hand', { keyframes: [{ y: -30, duration: .22, ease: 'power2.out' }, { y: 0, duration: .22, ease: 'power2.in' }], repeat: 1, repeatDelay: .06 }, a + .15);
    tl.to('#hand', { opacity: 0, duration: .15 }, b);
  }
  // 6 · commerces
  tl.fromTo(P, { radial: 0 }, { radial: .07, duration: .08, ...ir }, 34.5).to(P, { radial: 0, duration: .5, ease: 'power2.out' }, 34.58);
  tl.to(P, { shade: .85, duration: .3 }, 35.3);
  slamIn('t7', 35.4, .07); out('t7', 39.75, .2);
  tl.to(P, { shade: 0, duration: .25 }, 39.85);
  // 7 · l'écran devient une fenêtre sur la maison, puis le couloir
  tl.fromTo(P, { portal: 0 }, { portal: 1, duration: .45, ease: 'power2.inOut' }, 39.95);
  tl.fromTo(P, { glow: 0 }, { keyframes: [{ glow: 1, duration: .25 }, { glow: 0, duration: .55 }] }, 39.9);
  tl.fromTo(P, { radial: 0 }, { radial: .12, duration: .75, ease: 'expo.in', ...ir }, 40.25).to(P, { radial: .07, duration: .2 }, 41.0).to(P, { radial: .025, duration: .5 }, 41.2).to(P, { radial: 0, duration: .5 }, 42.7);
  tl.fromTo(P, { fov: FOV }, { fov: 50, duration: .55, ease: 'power2.out', ...ir }, 41.0).to(P, { fov: FOV, duration: .7, ease: 'power2.inOut' }, 42.7);
  // 8 · la chambre, le site
  tl.to(P, { shade: .85, duration: .3 }, 43.8);
  slamIn('t8', 43.9, .07);
  slamIn('t9', 46.4, .05);
  tl.fromTo('#t10', { opacity: 0, y: 30, scale: .9 }, { opacity: 1, y: 0, scale: 1, duration: .45, ease: 'back.out(2)' }, 47.6);
  out('t8', 50.25, .2); out('t9', 50.25, .2); out('t10', 50.25, .2);
  tl.to(P, { shade: 0, duration: .2 }, 50.3);
  tl.set(P, { scroll: 0 }, 43.4);
  [[44.4, .2], [45.8, .43], [47.2, .68], [48.6, 1]].forEach(([a, v]) => tl.to(P, { scroll: v, duration: a > 48 ? 1.4 : 1.0, ease: 'power2.inOut', ...ir }, a));
  tl.fromTo(P, { radial: 0 }, { radial: .12, duration: .45, ease: 'expo.in', ...ir }, 50.55);
  tl.fromTo(P, { flash: 0 }, { flash: 1, duration: .2, ease: 'power2.in', ...ir }, 50.8);
  // 9 · fin
  tl.set('#end', { opacity: 1 }, 51.0); tl.set(P, { radial: 0, flash: 0 }, 51.0);
  tl.fromTo('#endFlash', { opacity: 1 }, { opacity: 0, duration: .5, ease: 'power2.out' }, 51.0);
  tl.fromTo('#card', { scale: .88, opacity: 0, y: 40 }, { scale: 1, opacity: 1, y: 0, duration: .45, ease: 'expo.out' }, 51.0);
  ['M', 'B', 'T', 'K'].forEach((L, i) => {
    tl.fromTo(LOGOEL[L], { y: -760, opacity: 1 }, { keyframes: [{ y: 0, duration: .34, ease: 'power3.in' }, { y: -30, duration: .11, ease: 'power2.out' }, { y: 0, duration: .11, ease: 'power2.in' }, { y: -6, duration: .05 }, { y: 0, duration: .05 }] }, LAND[i] - .34);
  });
  tl.fromTo(LOGOEL.line, { scaleX: 0 }, { scaleX: 1, duration: .38, ease: 'expo.out' }, 52.0);
  ['D', 'E', 'S', 'I', 'G', 'N'].forEach((L, i) => { const dx = (LOGO_W / 2 - (LOGO_PARTS[L][0] + LOGO_PARTS[L][2] / 2)) * LOGOK * .55; tl.fromTo(LOGOEL[L], { x: dx, opacity: 0 }, { x: 0, opacity: 1, duration: .6, ease: 'expo.out' }, 52.1 + i * .03); });
  tl.fromTo('#card', { y: 0 }, { keyframes: [{ y: 10, duration: .05 }, { y: -4, duration: .06 }, { y: 0, duration: .08 }], ...ir }, 52.0);
  tl.fromTo('#endSweep', { x: 0, opacity: 0 }, { x: 2300, opacity: 1, duration: 1.4, ease: 'power2.inOut' }, 52.25);
  ['#e1', '#e2', '#e3', '#e4'].forEach((s, i) => tl.fromTo(s, { opacity: 0, y: 40, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .45, ease: 'expo.out' }, 52.6 + i * .25));
  // boucle : le logo se pose sur la photo de contact de l'appel, retour sur la table
  const ly = 960 + (905 - SCH / 2) * K_OVER;
  tl.to(['#e1', '#e2', '#e3', '#e4'], { opacity: 0, y: 30, duration: .18, ease: 'power2.in' }, 55.95);
  tl.to('#card', { scale: 375 * K_OVER / 682, y: ly - 570, backgroundColor: 'rgba(245,234,224,0)', boxShadow: '0 0 0 rgba(0,0,0,0)', duration: .32, ease: 'power3.inOut', transformOrigin: '400px 270px' }, 56.0);
  tl.to(['#endBg', '#endSweep'], { opacity: 0, duration: .2, ease: 'power1.inOut' }, 56.12);
  tl.to('#end', { opacity: 0, duration: .08 }, 56.32);
  tl.fromTo(P, { radial: 0 }, { keyframes: [{ radial: .12, duration: .1 }, { radial: 0, duration: .35, ease: 'power2.out' }], ...ir }, 57.45);
  tl.set({}, {}, DUR);
}

/* ---------- carte de fin (logo découpé, jamais déformé) ---------- */
const LOGOK = 682 / LOGO_W; const LOGOEL = {};
function buildLogoPieces() {
  const box = document.getElementById('logoBox');
  for (const [k, [x, y, w, h]] of Object.entries(LOGO_PARTS)) {
    const cv = document.createElement('canvas'); const s = 2; cv.width = Math.ceil(w * LOGOK * s); cv.height = Math.ceil(h * LOGOK * s);
    cv.style.width = (w * LOGOK) + 'px'; cv.style.height = (h * LOGOK) + 'px'; cv.style.left = (x * LOGOK) + 'px'; cv.style.top = (y * LOGOK) + 'px';
    const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(LOGO, x, y, w, h, 0, 0, cv.width, cv.height);
    box.appendChild(cv); LOGOEL[k] = cv;
  }
}

/* ---------- mise à jour par image ---------- */
let curPageA = null, curPageB = null, lastTimer = -1;
function setPages(a, b) { if (curPageA !== a) { screenUniforms.tA.value = PAGE[a]; curPageA = a; } if (curPageB !== b) { screenUniforms.tB.value = PAGE[b]; curPageB = b; } }
function pulseRect(x, y, w, h) { screenUniforms.uPulseRect.value.set(x / SCW, 1 - (y + h) / SCH, w / SCW, h / SCH); }
const liftCall = t => Math.min(inv(5.3, 6.2, t), 1 - inv(7.1, 7.55, t));
const liftTT = t => Math.min(inv(26.85, 27.7, t), 1 - inv(29.75, 30.2, t));
const liftIG = t => Math.min(inv(30.85, 31.7, t), 1 - inv(33.75, 34.2, t));
function applyLayers(key, L, t) {
  const Ly = LAYERS[key]; Ly.grp.visible = L > .0001;
  if (!Ly.grp.visible) return;
  const br = screenUniforms.uBright.value;
  for (const it of Ly.items) {
    const li = E.cubicInOut(clamp((L - it.d * .55) / (1 - it.d * .55)));
    it.m.position.z = SZ + .0012 + li * it.h + Math.sin(t * 1.6 + it.lx * 9 + it.ly * 5) * .005 * li;
    it.m.material.color.setScalar(br);
    const s = it.k === 'follow' ? P.pulse : 1; it.m.scale.set(s, s, 1);
    it.sm.position.set(it.lx + li * it.h * .2, it.ly - li * it.h * .28, SZ + .0006);
    it.sm.material.opacity = .62 * li; const ss = 1 + li * it.h * 1.3; it.sm.scale.set(ss, ss, 1);
  }
  if (Ly.glow && Ly.follow) { const f = Ly.follow; Ly.glow.position.set(f.lx, f.ly, f.m.position.z - .004); Ly.glow.material.opacity = P.pglow * clamp(L * 2); Ly.glow.scale.setScalar(P.pulse); }
}
const _hv = new THREE.Vector3();
function update(t) {
  tl.time(Math.min(t, DUR));
  const inB = t >= 41.0 && t < 51.0, inEnd = t >= 51.0 && t < 56.1;
  setFov(inB ? P.fov : FOV);
  // ----- téléphone
  const ph = phonePose(t); phone.position.copy(ph.p); phone.quaternion.copy(ph.q); phone.updateMatrixWorld(true);
  const hgt = Math.max(0, phone.position.y - PD / 2);
  contact.position.x = phone.position.x; contact.position.z = phone.position.z; contact.rotation.z = -12 * DEG; contact.material.opacity = clamp(1 - hgt * 3) * .85; contact.visible = hgt < .3;
  // ----- caméra
  const cp = inB ? camB(t) : camA(t);
  camera.position.copy(cp.p); camera.quaternion.copy(cp.q); camera.updateMatrixWorld(true);
  // ----- écran
  const su = screenUniforms;
  const scrC = V3(0, 0, SZ).applyMatrix4(phone.matrixWorld);
  const pq = phone.getWorldQuaternion(new THREE.Quaternion());
  const dFill = SW / (K_OVER * 2 * TANH * (W / H));
  const away = clamp((camera.position.distanceTo(scrC) - dFill) / (dFill * .5));
  su.uBright.value = 1 + .18 * away; su.uGlass.value = away;
  const Lc = liftCall(t), Lt = liftTT(t), Li = liftIG(t);
  const sw1 = E.expoInOut(inv(26.5, 26.8, t)), sw2 = E.expoInOut(inv(30.5, 30.8, t));
  let A, B = null, sw = 0;
  if (t < 5.15 || t >= 56) A = 'in';
  else if (t < 26.5) A = Lc > 0 ? 'callBase' : 'call';
  else if (t < 26.8) { A = 'call'; B = 'tt'; sw = sw1; }
  else if (t < 30.5) A = Lt > 0 ? 'ttBase' : 'tt';
  else if (t < 30.8) { A = 'tt'; B = 'ig'; sw = sw2; }
  else A = Li > 0 ? 'igBase' : 'ig';
  setPages(A, B || A); su.uSwipe.value = sw; su.uBlur.value = Math.sin(Math.PI * sw) * .2;
  su.uRip.value = t > 5.0 && t < 5.2 ? P.rip : 0; su.uRipC.value.set(830 / 1080, 1 - 1880 / 2341);
  if (t >= 5.15 && t < 26.8) { const s = Math.max(1, Math.floor(t - 5.15) + 1); if (s !== lastTimer) { drawTimer(TIMER, s); TIMER_TEX.needsUpdate = true; lastTimer = s; } }
  su.uTimerOn.value = t >= 5.15 && t < 26.5 && Lc <= 0 ? 1 : 0;
  if (t > 4.95 && t < 5.2) { su.uPulseRect.value.set(730 / 1080, 1 - 1980 / 2341, 200 / 1080, 200 / 2341); su.uPulse.value = P.pulse; su.uPulseGlow.value = 0; }
  else { su.uPulseRect.value.set(0, 0, 0, 0); su.uPulse.value = 1; su.uPulseGlow.value = 0; }
  su.uFlash.value = 0; su.uPortal.value = t < 41 ? P.portal : 0; su.uGlow.value = P.glow;
  applyLayers('call', Lc, t); applyLayers('tt', Lt, t); applyLayers('ig', Li, t);
  // main qui montre "S'abonner"
  const hk = Lt > 0 ? 'tt' : Li > 0 ? 'ig' : null;
  if (hk) { const f = LAYERS[hk].follow.m; f.getWorldPosition(_hv); _hv.project(camera); const hd = document.getElementById('hand'); hd.style.left = ((_hv.x * .5 + .5) * W + 40) + 'px'; hd.style.top = ((-_hv.y * .5 + .5) * H + 34) + 'px'; }
  // ----- cartes
  const ringQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(.28, .95, 0));
  cards.forEach((m, i) => {
    const t0 = CARD_T[i]; const kOut = inv(25.15 + i * .05, 25.55 + i * .05, t);
    if (t < t0 || t > 25.7 || inB || inEnd) { m.visible = false; return; }
    m.visible = true;
    const a = Math.PI * .5 + i * Math.PI / 2 + (t - 8.5) * .42;
    const orbit = PC.clone().add(V3(Math.cos(a) * 1.08, Math.sin(a) * 1.0, 0).applyQuaternion(ringQ));
    const present = camWorld(stageToCam(540 + (i % 2 ? 70 : -70), 930, 1.55));
    const k1 = E.expoOut(inv(t0, t0 + .35, t)), k2 = E.cubicInOut(inv(t0 + 1.15, t0 + 1.9, t));
    const pos = scrC.clone().lerp(present, k1).lerp(orbit, k2);
    const qPresent = camQuat(new THREE.Quaternion().setFromEuler(new THREE.Euler(.05, (i % 2 ? -1 : 1) * .18, (i % 2 ? 1 : -1) * .04)));
    const qOrbit = new THREE.Quaternion().setFromRotationMatrix(_m.lookAt(orbit, camera.position, V3(0, 1, 0))).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.PI)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.sin(a) * .5, Math.cos(a) * .12)));
    const q = pq.clone().slerp(qPresent, k1).slerp(qOrbit, k2);
    let s = lerp(.15, stageWidth(620, 1.55) / .6, k1); s = lerp(s, 1, k2);
    const kr = E.expoIn(kOut); pos.lerp(scrC, kr); s *= 1 - kr * .9;
    m.position.copy(pos); m.quaternion.copy(q); m.scale.setScalar(Math.max(s, .001));
  });
  // ----- arguments
  argMeshes.forEach((m, i) => {
    const t0 = ARG_T[i]; if (t < t0 || t > 22.75 || inB || inEnd) { m.visible = false; return; }
    m.visible = true;
    const y = 400 + i * 208 + 95, depth = 1.6;
    const target = camWorld(stageToCam(510, y, depth));
    const from = camWorld(stageToCam(540 + (i % 2 ? 900 : -900), y + 260, depth * 1.4));
    const k = E.expoOut(inv(t0, t0 + .55, t));
    const pos = from.clone().lerp(target, k); pos.y += Math.sin(t * 1.4 + i) * .004;
    const rq = new THREE.Quaternion().setFromEuler(new THREE.Euler((1 - k) * .9 + Math.sin(t + i) * .03, (1 - k) * (i % 2 ? -.9 : .9) + Math.sin(t * .8 + i) * .05, (1 - k) * (i % 2 ? .3 : -.3)));
    const q = camQuat(rq);
    let s = stageWidth(870, depth);
    const g = E.expoIn(inv(22.3 + i * .04, 22.62 + i * .04, t)); pos.lerp(scrC, g); s *= 1 - g * .92; q.slerp(pq, g);
    m.position.copy(pos); m.quaternion.copy(q); m.scale.setScalar(s);
  });
  // ----- affiche
  if (t > 22.68 && t < 25.78 && !inB) {
    poster.visible = true; const depth = 1.9;
    const target = camWorld(stageToCam(540, 800, depth));
    const k = E.expoOut(inv(22.7, 23.1, t)), kb = E.expoIn(inv(25.4, 25.75, t));
    const pos = scrC.clone().lerp(target, k).lerp(scrC, kb); pos.y += Math.sin(t * 1.6) * .006;
    let s = lerp(.15, stageWidth(820, depth), k); s = lerp(s, .1, kb);
    const q = pq.clone().slerp(camQuat(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(t * 1.2) * .04, Math.sin(t * .9) * .07 - .04, .01))), k).slerp(pq, kb);
    poster.position.copy(pos); poster.quaternion.copy(q); poster.scale.setScalar(s);
  } else poster.visible = false;
  // ----- carrousel
  let st = 0; for (const s0 of SNAPS) st += E.cubicInOut(inv(s0, s0 + .45, t));
  trades.forEach((m, i) => {
    if (t < 34.55 || t > 40.9 || inB || inEnd) { m.visible = false; return; }
    m.visible = true;
    const a = (i - st) * Math.PI / 3 + (t - 35) * .03;
    const ring = V3(Math.sin(a) * 1.3, .62 + Math.sin(t * 1.2 + i) * .02, Math.cos(a) * 1.3);
    const k = E.expoOut(inv(34.6 + i * .06, 35.25 + i * .06, t));
    m.position.copy(scrC.clone().lerp(ring, k));
    m.quaternion.copy(pq.clone().slerp(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), a * .85), k)); m.scale.setScalar(lerp(.12, 1, k) * (1 + .1 * Math.pow(Math.max(0, Math.cos(a)), 8)));
  });
  bokehs.forEach(b => b.quaternion.copy(camera.quaternion));
  siteUniforms.uScroll.value = P.scroll;
  // ----- mise au point
  let focus = camera.position.distanceTo(scrC), ap = 0;
  if (t < 3.4) ap = 13; else if (t < 4.38) ap = 13 * (1 - inv(3.4, 4.1, t));
  else if (t < 5.3) ap = 0;
  else if (t < 7.6) { ap = 9 * Math.min(Lc * 1.5, 1); focus -= .1 * Lc; }
  else if (t < 8.5) ap = lerp(9, 20, inv(7.6, 8.4, t));
  else if (t < 14.5) { ap = 20; for (let i = 0; i < 4; i++) { const t0 = CARD_T[i]; const w = Math.min(inv(t0, t0 + .2, t), 1 - inv(t0 + 1.0, t0 + 1.35, t)); if (w > 0) focus = lerp(focus, 1.55, E.sine(w)); } }
  else if (t < 22.7) { ap = 22; focus = lerp(focus, 1.6, E.sine(inv(14.6, 15.2, t))); }
  else if (t < 25.4) { ap = 20; focus = 1.9; }
  else if (t < 26.25) ap = 20 * (1 - inv(25.4, 26.0, t));
  else if (t < 34.5) { const L = Math.max(Lt, Li); ap = 8 * Math.min(L * 1.5, 1); focus -= .14 * L; }
  else if (t < 40.25) { ap = lerp(0, 18, inv(34.5, 35.1, t)); const front = trades.reduce((b, m) => m.visible && m.position.z > (b ? b.position.z : -99) ? m : b, null); if (front) focus = lerp(focus, camera.position.distanceTo(front.position), .55); }
  else if (t < 41) ap = 18 * (1 - inv(40.25, 40.7, t));
  if (inB) {
    if (t < 43.4) { ap = 6; focus = 3.0; }
    else { focus = camera.position.distanceTo(laptop.userData.disp.getWorldPosition(new THREE.Vector3())); ap = lerp(6, 18, inv(43.4, 44, t)); }
  }
  if (t >= 56) ap = 13 * inv(57.6, 58, t);
  const u = matComp.uniforms;
  u.uFocus.value = focus; u.uAp.value = ap * Q; u.uRadial.value = P.radial; u.uDir.value = P.dir; u.uFlash.value = P.flash;
  u.uBloom.value = inB ? .32 : .16 + .2 * away; u.uExpo.value = inB ? .92 : 1.0;
  matFxaa.uniforms.uTime.value = t * 60 % 1000;
  dust.material.uniforms.uT.value = t; dust.material.uniforms.uFocus.value = focus; dust.material.uniforms.uAp.value = ap * Q; dust.visible = away > .5;
  dustB.material.uniforms.uT.value = t; dustB.material.uniforms.uFocus.value = focus; dustB.material.uniforms.uAp.value = ap * Q;
  document.getElementById('topShade').style.opacity = P.shade;
  // ----- rendu
  if (inEnd) { renderer.setRenderTarget(null); renderer.setClearColor(0x000000); renderer.clear(); return; }
  if (!inB && su.uPortal.value > .001) updatePortalCam();
  renderFrame(inB ? sceneB : sceneA);
}

/* =====================================================================
   SON : bande-son originale intégrée (musique + bruitages), lue en Web Audio
   ?son=sfx → bruitages seuls · ?son=0 → muet
   ===================================================================== */
let AC = null, BUF = null, SRC = null, AT = 0;
function b64ToBuf(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
async function prepareAudio() {
  const mode = QS.get('son');
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return; }
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
  if (mode === '0' || !window.MBTK_AUDIO) return;
  const data = b64ToBuf(mode === 'sfx' ? MBTK_AUDIO.sfx : MBTK_AUDIO.mix);
  BUF = await new Promise(res => { try { const p = AC.decodeAudioData(data, b => res(b), () => res(null)); if (p && p.catch) p.catch(() => res(null)); } catch (e) { res(null); } });
}

/* =====================================================================
   LECTURE
   ===================================================================== */
const stage = document.getElementById('stage');
function layout() { const vw = window.innerWidth, vh = window.innerHeight; const s = QS.get('fit') === 'cover' ? Math.max(vw / W, vh / H) : Math.min(vw / W, vh / H); stage.style.transform = `translate(${(vw - W * s) / 2}px,${(vh - H * s) / 2}px) scale(${s})`; }
window.addEventListener('resize', layout); layout();
const grainCv = document.getElementById('grain'), grainG = grainCv.getContext('2d');
const grainFrames = []; for (let f = 0; f < 6; f++) { const id = grainG.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } grainFrames.push(id); }
let gf = 0; function grainStep() { gf = (gf + 1) % 6; grainG.putImageData(grainFrames[gf], 0, 0); grainCv.style.transform = `translate(${(Math.random() * 64) | 0}px,${(Math.random() * 64) | 0}px)`; }

let playing = false, startPerf = 0, ended = false, corr = 0;
function clock() {
  const tp = (performance.now() - startPerf) / 1000;
  if (AC && SRC && AC.getOutputTimestamp) {
    const ts = AC.getOutputTimestamp();
    if (ts && ts.contextTime > 0 && ts.performanceTime > 0) { const ta = ts.contextTime + (performance.now() - ts.performanceTime) / 1000 - AT; corr += (ta - tp - corr) * .08; }
  }
  return tp + corr;
}
function frame() {
  if (!playing) return;
  const t = clock();
  if (t >= DUR) { update(DUR); playing = false; ended = true; try { SRC && SRC.stop(); } catch (e) { } return; }
  update(Math.max(0, t)); grainStep();
  if (QS.has('debug')) document.getElementById('dbg').textContent = t.toFixed(2);
  requestAnimationFrame(frame);
}
function start() {
  const lead = .12;
  if (AC) { try { AC.resume(); } catch (e) { } }
  if (SRC) { try { SRC.stop(); } catch (e) { } SRC = null; }
  if (AC && BUF) { SRC = AC.createBufferSource(); SRC.buffer = BUF; SRC.connect(AC.destination); AT = AC.currentTime + lead; SRC.start(AT); }
  startPerf = performance.now() + lead * 1000; corr = 0;
  ended = false; playing = true;
  update(0); requestAnimationFrame(frame);
}
document.getElementById('go').addEventListener('click', e => {
  e.stopPropagation();
  const el = document.documentElement; const rf = el.requestFullscreen || el.webkitRequestFullscreen; if (rf) { try { const p = rf.call(el); if (p && p.catch) p.catch(() => { }); } catch (_) { } }
  document.getElementById('launch').style.display = 'none';
  start();
});
document.body.addEventListener('click', () => { if (ended) start(); });

async function init() {
  await Promise.all([document.fonts.load("900 40px Unbounded"), document.fonts.load("800 40px Unbounded"), document.fonts.load("700 40px Unbounded"), document.fonts.load("700 40px 'Space Grotesk'"), document.fonts.load("600 40px 'Space Grotesk'"), document.fonts.load("500 40px 'Space Grotesk'"), document.fonts.load("400 40px 'Space Grotesk'")]).catch(() => { });
  LOGO = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = LOGO_SRC; });
  document.getElementById('siteTxt').textContent = CFG.site; document.getElementById('urlTxt').textContent = CFG.site;
  const audioP = prepareAudio();
  GLOWRECT = T(rectGlowTex());
  TIMER = mk(480, 96); TIMER_TEX = T(TIMER.c, { keep: true }); screenUniforms.tTimer.value = TIMER_TEX; drawTimer(TIMER, 1);
  defPages();
  PAGE.in = T(pageIncoming());
  for (const k of ['call', 'tt', 'ig']) { PAGE[k] = T(renderPage(PAGES[k], true)); PAGE[k + 'Base'] = T(renderPage(PAGES[k], false)); }
  const st = T(sitePage()); st.anisotropy = MAXANI; siteUniforms.tSite.value = st;
  buildSceneA(); buildHouse(); buildPost(); buildLogoPieces(); computeHall();
  endBgTex(document.getElementById('endBg'));
  buildTimeline();
  // préchauffage (compilation des shaders + envoi des textures)
  for (const tt of [44, 41.5, 40.3, 22.9, 36.5, 15.5, 9, 28.5, 32.5, 6, 0]) update(tt);
  await audioP;
  if (DEBUG_T !== null) { update(DEBUG_T); grainStep(); document.getElementById('launch').style.display = 'none'; window.__ready = true; return; }
  update(0); grainStep();
  const b = document.getElementById('go'); b.disabled = false; b.textContent = '▶ Lancer';
  window.__ready = true;
}
init();
