/* ---------- shader écran du téléphone (pages, swipe, ripple, minuteur, portail vers la maison) ---------- */
const screenUniforms = {
  tA: { value: null }, tB: { value: null }, tTimer: { value: null }, tPortal: { value: null },
  uSwipe: { value: 0 }, uBlur: { value: 0 }, uBright: { value: 1.35 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(0.75, 0.08, 0.16) },
  uRip: { value: 0 }, uRipC: { value: new THREE.Vector2(830 / 1080, 1 - 1880 / 2341) },
  uTimerOn: { value: 0 }, uTimerRect: { value: new THREE.Vector4(300 / 1080, 1 - 600 / 2341, 480 / 1080, 96 / 2341) },
  uPulse: { value: 1 }, uPulseRect: { value: new THREE.Vector4(0, 0, 0, 0) }, uPulseGlow: { value: 0 }, uPulseCol: { value: new THREE.Color(1, .17, .33) },
  uGlass: { value: 1 }, uAspect: { value: 0.4613 }, uPortal: { value: 0 }, uRes: { value: new THREE.Vector2(RW, RH) }, uGlow: { value: 0 }
};
const screenMat = new THREE.ShaderMaterial({
  uniforms: screenUniforms,
  vertexShader: `varying vec2 vUv;varying vec3 vN;varying vec3 vV;
    void main(){vUv=uv;vec4 wp=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}`,
  fragmentShader: `
    uniform sampler2D tA,tB,tTimer,tPortal;uniform float uSwipe,uBlur,uBright,uFlash,uRip,uTimerOn,uPulse,uPulseGlow,uGlass,uAspect,uPortal,uGlow;
    uniform vec3 uFlashCol,uPulseCol;uniform vec2 uRipC,uRes;uniform vec4 uTimerRect,uPulseRect;
    varying vec2 vUv;varying vec3 vN;varying vec3 vV;
    vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
    vec3 pageA(vec2 uv){
      vec2 c=uPulseRect.xy+uPulseRect.zw*.5; vec2 hs=uPulseRect.zw*.5*uPulse;
      vec2 d=abs(uv-c);
      if(uPulseRect.z>0.&&d.x<hs.x&&d.y<hs.y){uv=c+(uv-c)/uPulse;}
      vec3 col=texture2D(tA,uv).rgb;
      if(uTimerOn>0.){vec2 t=(uv-uTimerRect.xy)/uTimerRect.zw; if(t.x>0.&&t.x<1.&&t.y>0.&&t.y<1.){vec4 tc=texture2D(tTimer,t);col=mix(col,tc.rgb,tc.a*uTimerOn);}}
      return col;}
    vec3 pageAt(float x,float y){float u=x-uSwipe; if(u>=0.) return pageA(vec2(u,y)); return texture2D(tB,vec2(u+1.,y)).rgb;}
    void main(){
      vec2 p=(vUv-.5)*vec2(uAspect,1.);vec2 hs=vec2(uAspect*.5,.5);float r=.075;
      vec2 q=abs(p)-hs+r;float sd=length(max(q,0.))+min(max(q.x,q.y),0.)-r;
      vec3 col;
      if(uBlur>0.0005){col=vec3(0.);for(int i=0;i<15;i++){float o=(float(i)/14.-.5)*uBlur;col+=pageAt(vUv.x+o,vUv.y);}col/=15.;}
      else col=pageAt(vUv.x,vUv.y);
      col=toLin(col);
      if(uPulseGlow>0.){vec2 c=uPulseRect.xy+uPulseRect.zw*.5;vec2 d=(vUv-c)/(uPulseRect.zw*.5*uPulse);float e=length(max(abs(d)-vec2(.82),0.));col+=uPulseCol*uPulseGlow*exp(-e*e*18.)*step(1.,max(abs(d.x),abs(d.y)))*.9;}
      if(uRip>0.){vec2 dv=(vUv-uRipC)*vec2(uAspect,1.);float dd=length(dv);float rad=.03+uRip*.08;float ring=exp(-pow((dd-rad)*70.,2.))*(1.-uRip);col+=vec3(.85,1.,.88)*ring*.9+vec3(.4,1.,.5)*smoothstep(rad,0.,dd)*(1.-uRip)*.18;}
      col=mix(col,uFlashCol,uFlash);
      col*=uBright;
      if(uPortal>0.){vec3 pc=texture2D(tPortal,gl_FragCoord.xy/uRes).rgb;col=mix(col,pc,uPortal);}
      if(uGlow>0.){float e=1.-smoothstep(0.,.06,-sd);col+=vec3(.9,.16,.32)*uGlow*(e*2.5+.25);}
      float f=pow(1.-max(dot(normalize(vN),normalize(vV)),0.),3.);
      float sweep=smoothstep(.0,.5,sin((vUv.x*1.2+vUv.y*.7+vV.x*.9+vV.y*.4)*3.1)*.5+.5)*.06;
      col+=uGlass*(vec3(1.,.85,.75)*(sweep+f*.25));
      float a=1.-smoothstep(-.002,.002,sd);
      if(a<.01)discard;
      gl_FragColor=vec4(col*a,1.);
    }`
});

/* ---------- shader écran MacBook (site qui défile) ---------- */
const siteUniforms = { tSite: { value: null }, uScroll: { value: 0 }, uVis: { value: 0.162 }, uBright: { value: 1.3 } };
const siteMat = new THREE.ShaderMaterial({
  uniforms: siteUniforms,
  vertexShader: 'varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vec4 wp=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}',
  fragmentShader: `uniform sampler2D tSite;uniform float uScroll,uVis,uBright;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
    vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
    void main(){float y=1.-(uScroll*(1.-uVis)+(1.-vUv.y)*uVis);vec3 c=toLin(texture2D(tSite,vec2(vUv.x,y)).rgb)*uBright;
    float f=pow(1.-max(dot(normalize(vN),normalize(vV)),0.),3.);c+=vec3(1.,.8,.7)*(f*.1+smoothstep(.3,1.,sin((vUv.x+vUv.y*.6+vV.x)*2.6))*.03);
    gl_FragColor=vec4(c,1.);}`
});

/* ---------- construction téléphone ---------- */
const PW = 0.716, PH = 1.47, PD = 0.083, SW = 0.648, SH = SW / 0.4613, SZ = PD / 2 + 0.0036;
function brushedTex() {
  const { c, g } = mk(1024, 64); const id = g.createImageData(1024, 64), d = id.data, R = rng(17);
  for (let y = 0; y < 64; y++) { const row = (R() - .5) * 40; for (let x = 0; x < 1024; x++) { const v = 150 + row + (N1(x * .01, y * 4, 0, 0) - .5) * 70 + (R() - .5) * 26; const i = (y * 1024 + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } }
  g.putImageData(id, 0, 0); return T(c, { linear: true, repeat: [6, 6] });
}
function buildPhone(env) {
  const g = new THREE.Group();
  const brush = brushedTex();
  // cadre en titane brossé bleu marine : flancs plats, arêtes légèrement arrondies
  const frame = new THREE.MeshPhysicalMaterial({ color: 0x27304e, metalness: 1, roughness: .34, roughnessMap: brush, envMap: env, envMapIntensity: 1.9, clearcoat: .25, clearcoatRoughness: .3 });
  const body = new THREE.Mesh(slab(PW, PH, .115, PD - .004, .011), frame); body.castShadow = true; body.receiveShadow = true; g.add(body);
  // vitre avant (avec tranche visible) et bordure noire
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: .08, metalness: 0, clearcoat: 1, clearcoatRoughness: .05, envMap: env, envMapIntensity: 1.4 });
  const glass = new THREE.Mesh(slab(PW - .012, PH - .012, .109, .007, .0028), glassMat); glass.position.z = PD / 2 - .0005; g.add(glass);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat); scr.position.z = SZ; g.add(scr);
  // Dynamic Island en relief
  const isl = new THREE.Mesh(shapeGeo(380 / 1080 * SW, 108 / 2341 * SH, 54 / 2341 * SH), new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: .15, clearcoat: 1, envMap: env, envMapIntensity: .8 }));
  isl.position.set(0, (.5 - 88 / 2341) * SH, SZ + .0004); g.add(isl);
  // dos en verre dépoli bordeaux
  const back = new THREE.Mesh(slab(PW - .012, PH - .012, .109, .006, .0025), new THREE.MeshPhysicalMaterial({ color: 0x5a1426, roughness: .5, metalness: .1, clearcoat: .6, clearcoatRoughness: .45, envMap: env, envMapIntensity: 1.1 }));
  back.position.z = -PD / 2 + .0005; g.add(back);
  // bloc photo : plateau en verre brillant, 3 objectifs avec bague titane, verre traité, LiDAR, flash
  const bumpMat = new THREE.MeshPhysicalMaterial({ color: 0x4a1020, roughness: .12, metalness: .15, clearcoat: 1, clearcoatRoughness: .05, envMap: env, envMapIntensity: 1.4 });
  const bump = new THREE.Mesh(slab(.3, .31, .07, .02, .006), bumpMat); bump.position.set(.17, .5, -PD / 2 - .01); bump.castShadow = true; g.add(bump);
  const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x060a16, roughness: .02, metalness: .2, clearcoat: 1, clearcoatRoughness: .01, envMap: env, envMapIntensity: 2.6 });
  const inner = new THREE.MeshPhysicalMaterial({ color: 0x0b0f22, roughness: .3, metalness: .6, envMap: env });
  [[.235, .565], [.235, .435], [.105, .5]].forEach(([x, y]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.057, .059, .02, 48), frame); ring.rotation.x = Math.PI / 2; ring.position.set(x, y, -PD / 2 - .028); ring.castShadow = true; g.add(ring);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(.05, .006, 12, 48), frame); lip.position.set(x, y, -PD / 2 - .038); g.add(lip);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(.051, 40), inner); disc.rotation.y = Math.PI; disc.position.set(x, y, -PD / 2 - .0362); g.add(disc);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(.05, 40, 16, 0, Math.PI * 2, 0, Math.PI * .22), lensGlass); lens.rotation.x = -Math.PI / 2; lens.position.set(x, y, -PD / 2 + .0025); g.add(lens);
  });
  const flash = new THREE.Mesh(new THREE.CircleGeometry(.017, 24), new THREE.MeshStandardMaterial({ color: 0xfff2d8, roughness: .3, emissive: 0x2a2218 })); flash.rotation.y = Math.PI; flash.position.set(.105, .605, -PD / 2 - .0205); g.add(flash);
  const lidar = new THREE.Mesh(new THREE.CircleGeometry(.014, 24), lensGlass); lidar.rotation.y = Math.PI; lidar.position.set(.105, .395, -PD / 2 - .0205); g.add(lidar);
  // boutons latéraux arrondis (action, volume +/-, côté)
  [[-1, .38, .085], [-1, .24, .14], [-1, .07, .14], [1, .25, .22]].forEach(([sd, y, l]) => {
    const b = new THREE.Mesh(slab(.03, l, .014, .011, .004), frame); b.rotation.y = Math.PI / 2; b.position.set(sd * (PW / 2 + .0015), y, 0); b.castShadow = true; g.add(b);
  });
  // lignes d'antenne, port USB-C, grilles de haut-parleur
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x0a0c14, roughness: .5, metalness: .3 });
  [[-PW / 2 + .11, PH / 2], [PW / 2 - .11, PH / 2], [-PW / 2 + .11, -PH / 2], [PW / 2 - .11, -PH / 2]].forEach(([x, y]) => { const a = new THREE.Mesh(new THREE.BoxGeometry(.008, .012, PD - .02), dark); a.position.set(x, y + Math.sign(y) * -.0005, 0); g.add(a); });
  const port = new THREE.Mesh(slab(.105, .03, .014, .02, .004), new THREE.MeshBasicMaterial({ color: 0x020202 })); port.rotation.x = Math.PI / 2; port.position.set(0, -PH / 2 - .002, 0); g.add(port);
  const hole = new THREE.CylinderGeometry(.0055, .0055, .02, 12);
  for (let k = 0; k < 6; k++) for (const sd of [-1, 1]) { const h = new THREE.Mesh(hole, dark); h.position.set(sd * (.1 + k * .022), -PH / 2 - .002, 0); g.add(h); }
  return g;
}
