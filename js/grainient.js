// Vanilla WebGL2 port of React Bits' <Grainient /> component (no 'ogl'
// dependency, since this project has no build step / bundler). Same shader
// as the original, driven directly with raw WebGL2 calls.
const Grainient = (() => {
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [1, 1, 1];
    return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
  }

  const vertexSrc = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  const fragmentSrc = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
  float t=iTime*uTimeSpeed;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);
  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;
  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);
  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));
  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);}
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;
  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);
  o=vec4(col,1.0);
}
void main(){
  vec4 o=vec4(0.0);
  mainImage(o,gl_FragCoord.xy);
  fragColor=o;
}
`;

  function compile(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Grainient shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function init(container, opts = {}) {
    if (!container) return null;
    const {
      color1 = '#000000',
      color2 = '#3d4249',
      color3 = '#94a3b8',
      timeSpeed = 0.25,
      colorBalance = 0.0,
      warpStrength = 1.0,
      warpFrequency = 5.0,
      warpSpeed = 2.0,
      warpAmplitude = 50.0,
      blendAngle = 0.0,
      blendSoftness = 0.05,
      rotationAmount = 500.0,
      noiseScale = 2.0,
      grainAmount = 0.1,
      grainScale = 2.0,
      grainAnimated = false,
      contrast = 1.5,
      gamma = 1.0,
      saturation = 1.0,
      centerX = 0.0,
      centerY = 0.0,
      zoom = 0.9
    } = opts;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
    if (!gl) return null; // CSS gradient fallback on the container handles this case.

    const vs = compile(gl, gl.VERTEX_SHADER, vertexSrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSrc);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Grainient link error:', gl.getProgramInfoLog(program));
      return null;
    }
    gl.useProgram(program);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    // Single oversized triangle covering the full clip space — avoids needing an index buffer.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    [
      'iResolution', 'iTime', 'uTimeSpeed', 'uColorBalance', 'uWarpStrength', 'uWarpFrequency',
      'uWarpSpeed', 'uWarpAmplitude', 'uBlendAngle', 'uBlendSoftness', 'uRotationAmount',
      'uNoiseScale', 'uGrainAmount', 'uGrainScale', 'uGrainAnimated', 'uContrast', 'uGamma',
      'uSaturation', 'uCenterOffset', 'uZoom', 'uColor1', 'uColor2', 'uColor3'
    ].forEach(name => { u[name] = gl.getUniformLocation(program, name); });

    gl.uniform1f(u.uTimeSpeed, timeSpeed);
    gl.uniform1f(u.uColorBalance, colorBalance);
    gl.uniform1f(u.uWarpStrength, warpStrength);
    gl.uniform1f(u.uWarpFrequency, warpFrequency);
    gl.uniform1f(u.uWarpSpeed, warpSpeed);
    gl.uniform1f(u.uWarpAmplitude, warpAmplitude);
    gl.uniform1f(u.uBlendAngle, blendAngle);
    gl.uniform1f(u.uBlendSoftness, blendSoftness);
    gl.uniform1f(u.uRotationAmount, rotationAmount);
    gl.uniform1f(u.uNoiseScale, noiseScale);
    gl.uniform1f(u.uGrainAmount, grainAmount);
    gl.uniform1f(u.uGrainScale, grainScale);
    gl.uniform1f(u.uGrainAnimated, grainAnimated ? 1.0 : 0.0);
    gl.uniform1f(u.uContrast, contrast);
    gl.uniform1f(u.uGamma, gamma);
    gl.uniform1f(u.uSaturation, saturation);
    gl.uniform2f(u.uCenterOffset, centerX, centerY);
    gl.uniform1f(u.uZoom, zoom);
    const c1 = hexToRgb(color1), c2 = hexToRgb(color2), c3 = hexToRgb(color3);
    gl.uniform3f(u.uColor1, c1[0], c1[1], c1[2]);
    gl.uniform3f(u.uColor2, c2[0], c2[1], c2[2]);
    gl.uniform3f(u.uColor3, c3[0], c3[1], c3[2]);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(u.iResolution, w, h);
      }
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    let raf = 0;
    let running = true;
    const t0 = performance.now();
    function frame(t) {
      gl.uniform1f(u.iTime, (t - t0) * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && running) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      running ? start() : stop();
    });
    start();

    return { start, stop };
  }

  return { init };
})();
