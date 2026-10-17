// Kleine WebGL2-Hilfen: Programme, Vollbild-Dreieck, Float-Texturen, Framebuffer.

export function createGL(canvas: HTMLCanvasElement, opts: WebGLContextAttributes = {}): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false, ...opts });
  if (!gl) throw new Error('WebGL2 wird nicht unterstützt.|WebGL2 is not supported.');
  return gl;
}

export const FULLSCREEN_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error('Shader-Fehler: ' + log);
    }
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link-Fehler: ' + gl.getProgramInfoLog(p));
  return p;
}

export class Prog {
  readonly p: WebGLProgram;
  private loc = new Map<string, WebGLUniformLocation | null>();
  constructor(readonly gl: WebGL2RenderingContext, fs: string, vs = FULLSCREEN_VS) { this.p = program(gl, vs, fs); }
  use() { this.gl.useProgram(this.p); return this; }
  u(name: string) {
    if (!this.loc.has(name)) this.loc.set(name, this.gl.getUniformLocation(this.p, name));
    return this.loc.get(name)!;
  }
  f(name: string, ...v: number[]) {
    const g = this.gl, l = this.u(name);
    if (v.length === 1) g.uniform1f(l, v[0]); else if (v.length === 2) g.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) g.uniform3f(l, v[0], v[1], v[2]); else g.uniform4f(l, v[0], v[1], v[2], v[3]);
    return this;
  }
  i(name: string, v: number) { this.gl.uniform1i(this.u(name), v); return this; }
  tex(name: string, unit: number, t: WebGLTexture, target: number = WebGL2RenderingContext.TEXTURE_2D) {
    const g = this.gl;
    g.activeTexture(g.TEXTURE0 + unit);
    g.bindTexture(target, t);
    g.uniform1i(this.u(name), unit);
    return this;
  }
  dispose() { this.gl.deleteProgram(this.p); }
}

export function hasFloatRT(gl: WebGL2RenderingContext): boolean {
  return !!gl.getExtension('EXT_color_buffer_float');
}

export function texture(gl: WebGL2RenderingContext, w: number, h: number, internal: number, format: number, type: number,
  data: ArrayBufferView | null = null, filter: number = gl.NEAREST, wrap: number = gl.CLAMP_TO_EDGE): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return t;
}

export function framebuffer(gl: WebGL2RenderingContext, ...tex: WebGLTexture[]): WebGLFramebuffer {
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  tex.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
  if (tex.length > 1) gl.drawBuffers(tex.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Framebuffer unvollständig (' + st + ')');
  return fb;
}

/** Vollbild-Dreieck zeichnen (kein Vertexpuffer nötig). */
export function drawFullscreen(gl: WebGL2RenderingContext) { gl.drawArrays(gl.TRIANGLES, 0, 3); }

/** Wartet, bis die GPU alles erledigt hat (1 Pixel zurücklesen). */
export function gpuSync(gl: WebGL2RenderingContext) {
  const px = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
}

export function gpuName(gl: WebGL2RenderingContext): string {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  let n = String(r || 'GPU');
  // „ANGLE (Intel, Intel(R) Arc(TM) B580 Graphics (0x0000E20B) Direct3D11 vs_5_0 ps_5_0, D3D11)“ → „Intel(R) Arc(TM) B580 Graphics“
  const m = /^ANGLE \((.*)\)$/.exec(n);
  if (m) { const parts = m[1].split(', '); n = parts.length >= 2 ? parts[1] : parts[0]; }
  return n.replace(/\s*\(0x[0-9A-Fa-f]+\)/, '').replace(/\s+(Direct3D|OpenGL|Vulkan|Metal).*$/i, '').trim() || 'GPU';
}

/** 128³ Wertrauschen (R8) als 3D-Textur, wiederholend. */
export function noise3D(gl: WebGL2RenderingContext, size = 64): WebGLTexture {
  const data = new Uint8Array(size * size * size);
  let s = 1234567;
  for (let i = 0; i < data.length; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; data[i] = s >>> 24; }
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_3D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, size, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.REPEAT);
  return t;
}
