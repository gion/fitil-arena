import Phaser from 'phaser';

const frag = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uAmt;
uniform float uRows;
uniform float uShift;
varying vec2 outTexCoord;

vec3 hue(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

void main() {
  vec2 uv = outTexCoord;
  float y = uv.y * uRows;
  float off = (sin(y * 1.3 + uTime * 4.0) + 0.6 * sin(y * 0.4 - uTime * 2.3)) * uShift;
  vec4 c = texture2D(uMainSampler, vec2(uv.x + off, uv.y));
  c.rgb = hue(c.rgb, uAmt * sin(uTime * 1.7) * 0.7);
  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  c.rgb = mix(vec3(l), c.rgb, 1.0 + uAmt * 0.4);
  gl_FragColor = c;
}
`;

/**
 * „Amețit” în 2D: harta se ondulează în fâșii orizontale (sinusoidal) și culorile pulsează.
 * Post-procesare pe camera arenei (doar WebGL).
 */
export class DizzyFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  amt = 0;
  t = 0;
  rows = 11;
  shift = 0;

  constructor(game: Phaser.Game) {
    super({ game, name: 'DizzyFX', fragShader: frag });
  }

  override onPreRender(): void {
    this.set1f('uTime', this.t);
    this.set1f('uAmt', this.amt);
    this.set1f('uRows', this.rows);
    this.set1f('uShift', this.shift);
  }
}
