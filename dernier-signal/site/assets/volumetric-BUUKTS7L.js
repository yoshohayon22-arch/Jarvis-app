import{Et as e,J as t,Lt as n,Y as r,an as i,et as a,qt as o,tt as s}from"./compact-9ZRAR-re.js";var c=`
varying vec3 vW; varying vec3 vN; varying float vH;
uniform float uLen;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vH = -position.y / uLen; // 0 au sommet, 1 en bas
  gl_Position = projectionMatrix * viewMatrix * w;
}`,l=`
uniform vec3 uColor; uniform float uTime; uniform float uIntensity; uniform float uFloor;
varying vec3 vW; varying vec3 vN; varying float vH;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  vec3 V = normalize(cameraPosition - vW);
  float edge = pow(abs(dot(normalize(vN), V)), 1.8);
  float n = noise(vW * 2.2 + vec3(0.0, -uTime * 0.12, uTime * 0.05)) * 0.6 + noise(vW * 5.0 - uTime * 0.2) * 0.4;
  float fall = smoothstep(0.0, 0.15, vH) * (1.0 - smoothstep(0.75, 1.0, vH)) * (1.0 - vH * 0.55);
  float floorFade = smoothstep(uFloor, uFloor + 0.35, vW.y);
  float a = edge * fall * floorFade * (0.55 + 0.9 * n) * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`,u=class extends e{mat;constructor(e,t,n,r,u=.06,d=0){let f=e.distanceTo(t),p=new s(n,f,48,12,!0);p.translate(0,-f/2,0);let m=new o({vertexShader:c,fragmentShader:l,uniforms:{uColor:{value:new a(r)},uTime:{value:0},uIntensity:{value:u},uLen:{value:f},uFloor:{value:d}},transparent:!0,blending:2,depthWrite:!1,side:2});super(p,m),this.mat=m,this.position.copy(e);let h=t.clone().sub(e).normalize();this.quaternion.setFromUnitVectors(new i(0,-1,0),h),this.renderOrder=20}update(e){this.mat.uniforms.uTime.value=e}},d=class extends n{mat;constructor(e,n,s=12573951){let c=new r,l=new Float32Array(e*3),u=new Float32Array(e),d=n.getSize(new i);for(let t=0;t<e;t++)l[t*3]=n.min.x+Math.random()*d.x,l[t*3+1]=n.min.y+Math.random()*d.y,l[t*3+2]=n.min.z+Math.random()*d.z,u[t]=Math.random();c.setAttribute(`position`,new t(l,3)),c.setAttribute(`seed`,new t(u,1));let f=new o({uniforms:{uTime:{value:0},uColor:{value:new a(s)},uMin:{value:n.min.clone()},uSize:{value:d},uPx:{value:window.devicePixelRatio||1}},vertexShader:`
        attribute float seed; uniform float uTime; uniform vec3 uMin; uniform vec3 uSize; uniform float uPx;
        varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.13 + seed * 40.0) * 0.25;
          p.y = uMin.y + mod(p.y - uMin.y + uTime * (0.015 + seed * 0.03), uSize.y);
          p.z += cos(uTime * 0.11 + seed * 30.0) * 0.25;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.0 + seed * 2.2) * uPx * (6.0 / -mv.z);
          vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + seed * 2.0) + seed * 60.0));
        }`,fragmentShader:`
        uniform vec3 uColor; varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor * a * vA * 0.5, 1.0); }`,transparent:!0,blending:2,depthWrite:!1});super(c,f),this.mat=f,this.frustumCulled=!1,this.renderOrder=21}update(e){this.mat.uniforms.uTime.value=e}};export{u as n,d as t};