#ifdef GL_ES
precision mediump float;
#endif

uniform vec3        u_light;

uniform sampler2D   u_scene;

uniform vec2        u_resolution;
uniform float       u_time;

varying vec4        v_position;
varying vec3        v_normal;

float sdDot(vec2 p, float r) {
    const float eps = .01;
    float dist = distance(p, vec2(0.5));
    float dot = smoothstep(r, r - eps, dist);
    return dot;
}

void main(void) {
    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
    vec2 pixel = vec2(1.0)/u_resolution.xy;
    vec2 st = gl_FragCoord.xy * pixel;
    vec3 bgcolor = vec3(.7, .8, .9);
    vec3 dotcolor = vec3(0.92, 0.75, 0.8);

#if defined(BACKGROUND)
    float scale = 10.;
    float time = u_time * .5;
    float s1 = smoothstep(0., .2, fract(time));
    float s2 = smoothstep(.5, .7, fract(time));
    float timestep1 = mix(0., 1., s1) * (1. / scale);
    float timestep2 = mix(0., 1., s2) * (1. / scale);

    vec2 ust = st * u_resolution.xy / u_resolution.y;
    float row1 = mod(floor(ust.y * scale), 2.);
    float row2 = mod(floor(ust.y * scale + 1.), 2.);
    float col1 = mod(floor(ust.x * scale), 2.);
    float col2 = mod(floor(ust.x * scale + 1.), 2.);

    vec2 movingSt = ust
        + vec2(timestep1, 0.) * row1
        + vec2(0., timestep2) * col1
        + vec2(-timestep1, 0.) * row2
        + vec2(0., -timestep2) * col2;

    float dot = sdDot(fract(movingSt * scale), .3 + 1.3 * sin(timestep2 - timestep1));

    color.rgb = bgcolor - dot + (dot * dotcolor);

    color.rgb -= .7 * length(st - .5);
#elif defined(POSTPROCESSING)
    color.rgb += texture2D(u_scene, st).rgb;

    vec2 offset = 5. * pixel * -length(st + .5) + .002 * sin(u_time * 4.);
    color.r = texture2D(u_scene, st + offset).r;
    color.b = texture2D(u_scene, st - offset).b;
#else
    // Diffuse shading from directional light
    vec3 lcolor = vec3(.6, .2, .4);
    color.rgb = v_normal.xyz * .2 + .5;
    vec3 n = normalize(v_normal);
    vec3 l = normalize(u_light - v_position.xyz);
    color.rgb += lcolor * (dot(n, l) * .8 + .2) * v_normal.xyz;
#endif

    gl_FragColor = color;
}