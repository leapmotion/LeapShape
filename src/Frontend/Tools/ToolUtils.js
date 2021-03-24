import * as THREE from '../../../node_modules/three/build/three.module.js';
import { World } from '../World/World.js';

/** Creates a modified material that dithers when occluded.  Useful for CSG Previews.
 * @param {World} world
 * @param {THREE.Material} inputMaterial
 */
export function createDitherDepthMaterial(world, inputMaterial) {
    // Inject some spicy stochastic depth logic into this object's material
    let safari = /(Safari)/g.test(navigator.userAgent) && ! /(Chrome)/g.test(navigator.userAgent);
    let hasFragDepth = (world.renderer.capabilities.isWebGL2 || (world.renderer.extensions.has('EXT_frag_depth'))) && !safari;
    if (!hasFragDepth) { return inputMaterial; }
    let stochasticDepthMaterial = inputMaterial.clone();
    stochasticDepthMaterial.uniforms = {};
    stochasticDepthMaterial.extensions = { fragDepth: hasFragDepth }; // set to use fragment depth values
    stochasticDepthMaterial.onBeforeCompile = (shader) => {
        let bodyStart = shader.fragmentShader.indexOf('void main() {');
        shader.fragmentShader =
            shader.fragmentShader.slice(0, bodyStart) +
            `
                // From https://github.com/Rudranil-Sarkar/Ordered-Dithering-Shader-GLSL/blob/master/Dither8x8.frag#L29
                const int[64] dither_table = int[](
                    0, 48, 12, 60, 3, 51, 15, 63,
                    32, 16, 44, 28, 35, 19, 47, 31,
                    8,  56, 4,  52, 11, 59, 7,  55,
                    40, 24, 36, 20, 43, 27, 39, 23,
                    2,  50, 14, 62, 1,  49, 13, 61,
                    34, 18, 46, 30, 33, 17, 45, 29,
                    10, 58, 6,  54, 9,  57, 5,  53,
                    42, 26, 38, 22, 41, 25, 37, 21
                );
                ` +
            shader.fragmentShader.slice(bodyStart - 1, - 1) +
            (hasFragDepth ? `
            int x = int(mod(gl_FragCoord.x, 8.));
            int y = int(mod(gl_FragCoord.y, 8.));
            float limit = (float(dither_table[x + y * 8]) + 1.) / 64.;
            gl_FragDepthEXT = gl_FragCoord.z - (limit*0.002);
            ` : '\n') + '}';
        stochasticDepthMaterial.uniforms = shader.uniforms;
        stochasticDepthMaterial.userData.shader = shader;
    };
    return stochasticDepthMaterial;
}
