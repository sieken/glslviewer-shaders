
#ifdef GL_ES
precision mediump float;
#endif

#define round(val) (floor(val + .5))

uniform vec2    u_resolution;
uniform float   u_time;

uniform sampler2D u_buffer0;
uniform sampler2D u_buffer1;


#include "./lygia/filter/edge.glsl"
#include "./lygia/filter/radialBlur.glsl"
#include "./lygia/generative/snoise.glsl"
#include "./lygia/generative/srandom.glsl"
#include "./lygia/math/rotate2d.glsl"

float octaveSNoise(vec3 a, int o) {
    float noise = 0.;
    for (float i = 0.; i < float(o); ++i) {
        noise += (1. / pow(2., i)) * snoise(a * pow(2., i));
    }
    return noise;
}

float blob(vec2 u, float time) {
    vec3 randNoiseCoord =
        vec3(u.x, u.y, 0.)
        - vec3(.0, .1, .2) * time;
    return octaveSNoise(randNoiseCoord, 2);
}

vec2 edge2(in sampler2D tex, in vec2 st, in vec2 offset) {
    float tleft = texture2D(tex, st + vec2(-offset.x, offset.y)).r;
    float left = texture2D(tex, st + vec2(-offset.x, 0.)).r;
    float bleft = texture2D(tex, st + vec2(-offset.x, -offset.y)).r;
    float top = texture2D(tex, st + vec2(0., offset.y)).r;
    float bottom = texture2D(tex, st + vec2(0., -offset.y)).r;
    float tright = texture2D(tex, st + offset).r;
    float right = texture2D(tex, st + vec2(offset.x, 0.)).r;
    float bright = texture2D(tex, st + vec2(offset.x, -offset.y)).r;
    float x = tleft + 2. * left + bleft - tright - 2. * right - bright;
    float y = -tleft - 2. * top - tright + bleft + 2. * bottom + bright;
    return vec2(x, y);
}

void main(void) {
    vec4 color = vec4(vec3(0.), 1.0);
    vec2 pixel = 1.0/u_resolution.xy;
    vec2 st = gl_FragCoord.xy * pixel;
    vec2 uv = st;
    st *= 3.;

    vec3 Palette[5];
    Palette[0] = vec3(1.000, 0.761, 0.871);
    Palette[1] = vec3(0.988, 0.965, 0.741);
    Palette[2] = vec3(0.816, 0.957, 0.871);
    Palette[3] = vec3(0.663, 0.871, 0.976);
    Palette[4] = vec3(0.894, 0.757, 0.976);

    float time = u_time * .5;
    float t1 = .2;
    float t2 = .5;
    float timestep = mix(0., 1., smoothstep(t1, t2, time - floor(time))) + floor(time);


#if defined(BUFFER_0) // Heightmap

    float randNoise = blob(st, timestep);
    float terraceThresh = 4.;
    float terrace = round(randNoise * terraceThresh) / terraceThresh;
    color.rgb = vec3(terrace);

#elif defined(BUFFER_1) // Image
    vec2 lightPos = vec2(-5., .1);
    vec2 e = edge2(u_buffer0, uv, pixel);
    float th = atan(e.y, e.x);
    vec2 norm = vec2(0., 1.) * rotate2d(th);

    vec2 l = normalize(lightPos - st);
    vec2 n = normalize(norm);

    float light = clamp(dot(n, l), -1., 1.);
    float shadow = -clamp(dot(-n, l), -1., 1.);

    int paletteIndex1 = int(mod(timestep, 5.));
    int paletteIndex2 = int(mod(timestep + 1., 5.));
    vec3 col1 = Palette[paletteIndex1];
    vec3 col2 = Palette[paletteIndex2];
    color.rgb += .9 * mix(col1, col2, smoothstep(0., .8, fract(timestep)));
    color.rgb += .2 * texture2D(u_buffer0, uv).rgb;

    color.rgb += .2 * light;
    color.rgb += .2 * shadow;

#elif defined(POSTPROCESSING)

    // Add vignette
    color.rgb = texture2D(u_buffer1, uv).rgb;
    color.rgb *= vec3(smoothstep(1., 0., pow(length(uv - .5 * u_resolution * pixel), 1.9)));

#endif
 
    gl_FragColor = color;
}
