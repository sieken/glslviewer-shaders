#ifdef GL_ES
precision mediump float;
#endif

uniform vec2    u_resolution;
uniform vec2    u_mouse;
uniform float   u_time;

uniform sampler2D u_scene;

varying vec2    v_texcoord;

const float bayer_r = 3.;
const float NUM_INPUT_COLORS = 4.;

#define MAX_STEPS 600
#define MAX_DIST 100.
#define SURF_DIST .001
#define TAU 6.283185
#define PI 3.141592
#define S smoothstep
#define T iTime

const mat4 Bayer4 = mat4(
    vec4(  -.5,   .25, -.3125,  .4375),
    vec4(    0,  -.25,  .1875, -.0625),
    vec4(-.375,  .375, -.4375,  .0625),
    vec4( .125, -.125,  .0625,  .1875)
);

const mat4 Bayer8_00 = mat4(
    vec4(0, 32,  8, 40),
    vec4(48, 16, 56, 24),
    vec4(12, 44,  4, 36), 
    vec4(60, 28, 52, 20)
);
const mat4 Bayer8_10 = mat4(
    vec4(2, 34, 10, 42),
    vec4(50, 18, 58, 26),
    vec4(14, 46,  6, 38),
    vec4(62, 30, 54, 22)
);
const mat4 Bayer8_01 = mat4(
    vec4( 3, 35, 11, 43),
    vec4(51, 19, 59, 27),
    vec4(15, 47,  7, 39),
    vec4(63, 31, 55, 23)
);
const mat4 Bayer8_11 = mat4(
    vec4(1, 33,  9, 41),
    vec4(49, 17, 57, 25),
    vec4(13, 45,  5, 37),
    vec4(61, 29, 53, 21)
);

float GetBayer8(float x, float y) {
    if (y < 4.) {
        if (x < 4.) return Bayer8_00[int(y)][int(x)];
        return Bayer8_01[int(y)][int(mod(x, 4.))];
    }
    if (x < 4.) return Bayer8_10[int(mod(y, 4.))][int(x)];
    return Bayer8_11[int(mod(y, 4.))][int(mod(x, 4.))];
}

vec3 NRGB(int r, int g, int b) {
    return vec3(r, g, b) / 256.;
}

mat2 Rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float sdBox(vec3 p, vec3 s) {
  p = abs(p) - s;
  return length(max(p, 0.)) + min(max(p.x, max(p.y, p.z)), 0.);
}

float smin(float a, float b, float k) {
  a = pow(a, k);
  b = pow(b, k);
  return pow((a * b) / (a + b), 1.0 / k);
}

float GetDist(vec3 p) {
  vec3 P = p;
  P.xz = fract(P.xz) - .8;
  vec3 tile = p;
  tile.xz = floor(p.xz) - .5;
  P.y += .4 * sin(
    2. * u_time
    - length(tile.xz - vec2(2.))
    + smoothstep(2., .02, length(P.xz)));
  float d = sdBox(P, vec3(.35));
  float floor = p.y - .2;

  vec3 s = vec3(0, 4.8, 20.);
  vec3 s2 = vec3(-3., 2.8, 10.);
  float sd = length(p - s) - 1.3;
  float s2d = length(p - s2) - 0.8;

  return min(min(sd, s2d), smin(d,floor, .22));
}

float RayMarch(vec3 ro, vec3 rd) {
  float dO = 0.;

  for(int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * dO;
    float dS = GetDist(p);
    dO += dS;
    if(dO > MAX_DIST || abs(dS) < SURF_DIST)
      break;
  }

  return dO;
}

vec3 GetNormal(vec3 p) {
  vec2 e = vec2(.001, 0);
  vec3 n = GetDist(p) -
    vec3(GetDist(p - e.xyy), GetDist(p - e.yxy), GetDist(p - e.yyx));

  return normalize(n);
}

vec3 GetRayDir(vec2 uv, vec3 p, vec3 l, float z) {
  vec3 f = normalize(l - p), r = normalize(cross(vec3(0, 1, 0), f)), u = cross(f, r), c = f * z, i = c + uv.x * r + uv.y * u;
  return normalize(i);
}

void main(void) {
    vec3 BACKCOLOR = NRGB(20, 163, 161);
    vec3 FRONTCOLOR = NRGB(255, 214, 224);

    vec4 color = vec4(vec3(0.0), 1.0);
    vec3 col = vec3(0.);
    vec2 st = (gl_FragCoord.xy - .5 * u_resolution.xy) / u_resolution.y;

    vec3 ro = vec3(10.4, 1.8 + .5 * sin(.4 * u_time), -3.4);
    ro.yz *= Rot(-.4 * PI + 1.3);
    ro.xz *= Rot(5.2 + .93 * TAU * .05 * cos(.2 * u_time));

    vec3 rd = GetRayDir(st, ro, vec3(0, -1., 0), 1.);
    float d = RayMarch(ro, rd);

    if (d < MAX_DIST) {
        vec3 p = ro + rd * d;
        vec3 n = GetNormal(p);
        vec3 r = reflect(rd, n);

        float dif = dot(n, normalize(vec3(1, 2, 3))) * .5 + .5;

        col = vec3(dif);
    }

    // col = pow(col, vec3(.4545));	// gamma correction


    #define BayerN 4

    #if BayerN == 4
    float bayer_y = mod(gl_FragCoord.y, 4.);
    float bayer_x = mod(gl_FragCoord.x, 4.);
    float bayerVal = Bayer4[int(bayer_y)][int(bayer_x)];
    #elif BayerN == 8
    float bayer_y = mod(gl_FragCoord.y, 8.) * .015625;
    float bayer_x = mod(gl_FragCoord.x, 8.) * .015625;
    float bayerVal = GetBayer8(bayer_x, bayer_y);
    #endif

    vec3 output_col = 2. * col + (bayer_r * bayerVal);

    if (length(output_col) < (NUM_INPUT_COLORS / 2.)) col.rgb = BACKCOLOR;
    else col.rgb = FRONTCOLOR;


    gl_FragColor = vec4(col, 1.);
}
