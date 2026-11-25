import{Bt as e,C as t,E as n,Et as r,F as i,Gt as a,It as o,Kt as s,Lt as c,Pt as l,Rt as u,Tt as d,_n as f,a as p,bn as m,dt as h,in as g,it as _,j as v,k as y,mn as b,n as x,nn as S,o as C,pt as w,st as T,t as E,vn as D,xn as O,yn as k}from"./parts-BNMX0yhE.js";var A=class e extends c{constructor(t,n={}){super(t),this.isReflector=!0,this.type=`Reflector`,this.forceUpdate=!1,this._reflectionCameras=new WeakMap;let i=this,s=n.color===void 0?new h(8355711):new h(n.color),c=n.textureWidth||512,l=n.textureHeight||512,u=n.clipBias||0,d=n.shader||e.ReflectorShader,p=n.multisample===void 0?4:n.multisample,_=new a,v=new k,y=new k,b=new k,x=new o,S=new k(0,0,-1),C=new m,w=new k,T=new k,E=new m,D=new o,A=new O(c,l,{samples:p,type:r}),j=new g({name:d.name===void 0?`unspecified`:d.name,uniforms:f.clone(d.uniforms),fragmentShader:d.fragmentShader,vertexShader:d.vertexShader});j.uniforms.tDiffuse.value=A.texture,j.uniforms.color.value=s,j.uniforms.textureMatrix.value=D,this.material=j,this.onBeforeRender=function(e,t,n){let r=this.getReflectionCamera(n);if(y.setFromMatrixPosition(i.matrixWorld),b.setFromMatrixPosition(n.matrixWorld),x.extractRotation(i.matrixWorld),v.set(0,0,1),v.applyMatrix4(x),w.subVectors(y,b),w.dot(v)>0&&this.forceUpdate===!1)return;w.reflect(v).negate(),w.add(y),x.extractRotation(n.matrixWorld),S.set(0,0,-1),S.applyMatrix4(x),S.add(b),T.subVectors(y,S),T.reflect(v).negate(),T.add(y),r.position.copy(w),r.up.set(0,1,0),r.up.applyMatrix4(x),r.up.reflect(v),r.lookAt(T),r.far=n.far,r.updateMatrixWorld(),r.projectionMatrix.copy(n.projectionMatrix),r.projectionMatrix.elements[8]*=-1,r.projectionMatrix.elements[12]*=-1,D.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),D.multiply(r.projectionMatrix),D.multiply(r.matrixWorldInverse),D.multiply(i.matrixWorld),_.setFromNormalAndCoplanarPoint(v,y),_.applyMatrix4(r.matrixWorldInverse),C.set(_.normal.x,_.normal.y,_.normal.z,_.constant);let a=r.projectionMatrix;r.isOrthographicCamera?(E.x=(Math.sign(C.x)+a.elements[8])/a.elements[0],E.y=(Math.sign(C.y)+a.elements[9])/a.elements[5],E.z=-n.far,E.w=1):(E.x=(Math.sign(C.x)+a.elements[8])/a.elements[0],E.y=(Math.sign(C.y)+a.elements[9])/a.elements[5],E.z=-1,E.w=(1+a.elements[10])/a.elements[14]),C.multiplyScalar(2/C.dot(E)),a.elements[2]=C.x,a.elements[6]=C.y,r.isOrthographicCamera?(a.elements[10]=C.z-u,a.elements[14]=C.w-1):(a.elements[10]=C.z+1-u,a.elements[14]=C.w),i.visible=!1;let o=e.getRenderTarget(),s=e.xr.enabled,c=e.shadowMap.autoUpdate;e.xr.enabled=!1,e.shadowMap.autoUpdate=!1,e.setRenderTarget(A),e.state.buffers.depth.setMask(!0),e.autoClear===!1&&e.clear(),e.render(t,r),e.xr.enabled=s,e.shadowMap.autoUpdate=c,e.setRenderTarget(o);let l=n.viewport;l!==void 0&&e.state.viewport(l),i.visible=!0,this.forceUpdate=!1},this.getRenderTarget=function(){return A},this.dispose=function(){A.dispose(),i.material.dispose()},this.getReflectionCamera=function(e){let t=this._reflectionCameras.get(e);return t===void 0&&(t=e.clone(),this._reflectionCameras.set(e,t)),t}}};A.ReflectorShader={name:`ReflectorShader`,uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null}},vertexShader:`
		uniform mat4 textureMatrix;
		varying vec4 vUv;

		#include <common>
		#include <logdepthbuf_pars_vertex>

		void main() {

			vUv = textureMatrix * vec4( position, 1.0 );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

			#include <logdepthbuf_vertex>

		}`,fragmentShader:`
		uniform vec3 color;
		uniform sampler2D tDiffuse;
		varying vec4 vUv;

		#include <logdepthbuf_pars_fragment>

		float blendOverlay( float base, float blend ) {

			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );

		}

		vec3 blendOverlay( vec3 base, vec3 blend ) {

			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );

		}

		void main() {

			#include <logdepthbuf_fragment>

			vec4 base = texture2DProj( tDiffuse, vUv );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`};var j={name:`BlurredReflector`,uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},uArm:{value:null},uNor:{value:null},uRepeat:{value:4},uStrength:{value:.75},uTexel:{value:new D(1/512,1/512)},uRadius:{value:9}},vertexShader:`
    uniform mat4 textureMatrix;
    varying vec4 vUv; varying vec2 vLocal; varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main(){
      vUv = textureMatrix * vec4(position, 1.0);
      vLocal = position.xy;
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,fragmentShader:`
    uniform vec3 color; uniform sampler2D tDiffuse; uniform sampler2D uArm; uniform sampler2D uNor;
    uniform float uRepeat; uniform float uStrength; uniform vec2 uTexel; uniform float uRadius;
    varying vec4 vUv; varying vec2 vLocal; varying vec3 vWorld;
    #include <logdepthbuf_pars_fragment>
    const vec2 P[8] = vec2[8](vec2(-0.613,0.617), vec2(0.17,-0.04), vec2(-0.299,-0.791), vec2(0.645,0.493),
                              vec2(-0.651,0.717), vec2(0.421,0.027), vec2(-0.817,-0.271), vec2(0.977,-0.108));
    void main(){
      #include <logdepthbuf_fragment>
      vec2 tuv = vLocal / uRepeat;
      float rough = texture2D(uArm, tuv).g;
      vec3 n = texture2D(uNor, tuv).xyz * 2.0 - 1.0;
      vec2 uv = vUv.xy / vUv.w + n.xy * 0.012;
      float lod = mix(0.6, 4.2, smoothstep(0.2, 0.9, rough));
      float blur = mix(1.0, 3.0, smoothstep(0.25, 0.85, rough)) * exp2(lod);
      vec3 acc = textureLod(tDiffuse, uv, lod).rgb * 2.0;
      for (int i = 0; i < 8; i++) acc += textureLod(tDiffuse, uv + P[i] * uTexel * blur, lod).rgb;
      acc /= 10.0;
      vec3 V = normalize(cameraPosition - vWorld);
      float F = 0.05 + 0.95 * pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
      float fade = 1.0 - smoothstep(uRadius * 0.55, uRadius, length(vWorld.xz));
      float gloss = 1.0 - smoothstep(0.3, 0.95, rough) * 0.75;
      gl_FragColor = vec4(acc * color * mix(0.22, 1.0, F) * uStrength * gloss * fade, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`};function M(t,n,r){let a=new d,o=i(`smooth_concrete_floor`,n,t/4),u=new e({color:1316120,roughnessMap:o.arm,aoMap:o.arm,roughness:1,metalness:0,normalMap:o.normalMap,normalScale:new D(.5,.5),envMapIntensity:.2}),f=new s(t,t),p=new c(f,u);p.rotation.x=-Math.PI/2,p.receiveShadow=!0,a.add(p);let m=null;if(r.enabled){m=new A(new s(t,t),{textureWidth:r.width,textureHeight:r.height,clipBias:.002,shader:j,color:12109008,multisample:0});let e=m.getRenderTarget();e.texture.generateMipmaps=!0,e.texture.minFilter=l;let n=m.material;n.uniforms.uArm.value=o.arm.clone(),n.uniforms.uArm.value.repeat.set(1,1),n.uniforms.uNor.value=o.normalMap,n.uniforms.uRepeat.value=4,n.uniforms.uTexel.value.set(1/r.width,1/r.height),n.transparent=!0,n.blending=2,n.depthWrite=!1,m.rotation.x=-Math.PI/2,m.position.y=.0015,m.renderOrder=1,a.add(m)}return{group:a,floor:p,reflector:m,material:u}}function N(e,t,n){e&&(e.getRenderTarget().setSize(t,n),e.material.uniforms.uTexel.value.set(1/t,1/n))}var P=class extends d{turntable=new d;ringMat;labelMat;topY=.2;constructor(e){super();let r=new E,i=y(1842722,{rough:.5,wear:.1,scratches:.08,dirt:.2}),a=y(3816771,{rough:.3,wear:.05}),o=v(3422012,2.2);r.add(this,i,x(.66,.05,.012,72),[0,.025,0]),r.add(this,a,x(.6,.1,.02,72),[0,.1,0]),r.add(this,i,p([[.62,0],[.63,.005],[.63,.015],[.62,.02]],72),[0,.05,0]);let l=y(9212055,{rough:.3}),d=n(328965),f=[];for(let e=0;e<24;e++){let t=e/24*Math.PI*2;f.push({p:[Math.sin(t)*.64,.051,Math.cos(t)*.64],r:[-Math.PI/2,0,0]})}r.screws(this,l,d,f),this.turntable.position.y=this.topY-.03,this.add(this.turntable);let m=new c(x(.55,.035,.01,72),o);m.position.y=0,m.receiveShadow=!0,m.castShadow=!0,this.turntable.add(m),r.add(this.turntable,a,new b(.552,.008,10,96),[0,0,0],[Math.PI/2,0,0]),this.ringMat=t(4708095,1.6);let g=new c(new b(.605,.006,10,128),this.ringMat);g.rotation.x=Math.PI/2,g.position.y=.145,this.add(g),r.add(this,i,C(.36,.075,.03,.01),[0,.1,.6],[0,0,0]);let _=document.createElement(`canvas`);_.width=512,_.height=128;let w=_.getContext(`2d`);w.fillStyle=`#fff`,w.font=`600 64px "Barlow Condensed", Arial Narrow, sans-serif`,w.textAlign=`center`,w.textBaseline=`middle`,w.fillText(`PROTOTYPE  ${e}`,256,68,480);let D=new T(_);D.colorSpace=S,this.labelMat=new u({map:D,transparent:!0,color:new h(.6,1.6,2.2),depthWrite:!1});let O=new c(new s(.3,.075),this.labelMat);O.position.set(0,.1,.6155),this.add(O),r.build()}setFocus(e,t){let n=1.2+e*(2.2+Math.sin(t*2.5)*.6);this.ringMat.color.setRGB(.28,.84,1).multiplyScalar(n),this.labelMat.color.setRGB(.6,1.6,2.2).multiplyScalar(.6+e*.8)}};function F(){let n=new d,r=new e({color:724241,roughness:.85,metalness:.2}),i=new c(new w(11,11,9,96,1,!0,Math.PI*.62,Math.PI*.76),r);i.material.side=1,i.position.set(0,4.5,2),i.receiveShadow=!0,n.add(i);let a=t(4171992,1.35),o=t(16756848,.9);for(let e=0;e<11;e++){let t=Math.PI*.66+e/10*Math.PI*.68,r=new c(new _(.05,5.5,.05),e%5==2?o:a);r.position.set(Math.sin(t)*10.85,3.2,2+Math.cos(t)*10.85),n.add(r)}let s=new c(new b(10.7,.02,8,160,Math.PI*.76),t(3116992,1.8));return s.rotation.x=Math.PI/2,s.rotation.z=-Math.PI*.88,s.position.set(0,.03,2),n.add(s),n}export{N as i,F as n,M as r,P as t};