import * as THREE from '../../../../node_modules/three/build/three.module.js';
import { World } from '../../World/World.js';
import oc from  '../../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';

/** Returns whether Fragment Depth Buffers Exist on this hardware
 * @param {World} world */
export function hasFragmentDepth(world) {
    // Inject some spicy stochastic depth logic into this object's material
    let safari = /(Safari)/g.test(navigator.userAgent) && ! /(Chrome)/g.test(navigator.userAgent);
    return (world.renderer.capabilities.isWebGL2 || (world.renderer.extensions.has('EXT_frag_depth'))) && !safari;
}

/** Creates a modified shader that dithers when occluded.  Useful for CSG Previews.
 * @param {World} world
 * @param {boolean} hasFragDepth
 * @param {string} origShader */
export function createDitherDepthFragmentShader(hasFragDepth, origShader) {
    let bodyStart = origShader.indexOf('void main() {');
    return origShader.slice(0, bodyStart) +
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
            origShader.slice(bodyStart - 1, - 1) +
            (hasFragDepth ? `
            int x = int(mod(gl_FragCoord.x, 8.));
            int y = int(mod(gl_FragCoord.y, 8.));
            float limit = (float(dither_table[x + y * 8]) + 1.) / 64.;
            gl_FragDepthEXT = gl_FragCoord.z - (limit*0.0001);
            ` : '\n') + '}';
}

/** Creates a modified material that dithers when occluded.  Useful for CSG Previews.
 * @param {World} world
 * @param {THREE.Material} inputMaterial */
export function createDitherDepthMaterial(world) {
    let hasFragDepth = hasFragmentDepth(world);
    let stochasticDepthMaterial = new THREE.MeshPhongMaterial();
    stochasticDepthMaterial.color.setRGB(0.5, 0.5, 0.5);
    if (!hasFragDepth) { return stochasticDepthMaterial; }

    stochasticDepthMaterial.uniforms = {};
    stochasticDepthMaterial.extensions = { fragDepth: hasFragDepth }; // set to use fragment depth values
    stochasticDepthMaterial.onBeforeCompile = (shader) => {
        shader.fragmentShader = createDitherDepthFragmentShader(hasFragDepth, shader.fragmentShader);
        stochasticDepthMaterial.uniforms = shader.uniforms;
        stochasticDepthMaterial.userData.shader = shader;
    };
    return stochasticDepthMaterial;
}

/** Snaps this Vector3 to the global grid of gridPitch cell size
 * @param {THREE.Vector3} vecToSnap The vector to snap
 * @param {number} gridPitch The grid size to snap to*/
export function snapToGrid(vecToSnap, gridPitch) {
    if (gridPitch > 0) {
        vecToSnap.set(
            (Math.round((vecToSnap.x + Number.EPSILON) / gridPitch) * gridPitch),
            (Math.round((vecToSnap.y + Number.EPSILON) / gridPitch) * gridPitch),
            (Math.round((vecToSnap.z + Number.EPSILON) / gridPitch) * gridPitch));
    }
    return vecToSnap;
}

/** Callbacks info from the CAD engine about the surface.
 * @param {LeapShapeEngine} engine
 * @param {any} raycastHit,
 * @param {Function} callback */
export function querySurface(engine, raycastHit, callback) {
    // Match the triangle index to the face index from the face metadata
    let faceID = -1; let faceMetadata = raycastHit.object.faceMetadata;
    for (let i = 0; i < faceMetadata.length; i++){
        if (raycastHit.faceIndex >= faceMetadata[i].start &&
            raycastHit.faceIndex  < faceMetadata[i].end) {
            faceID = faceMetadata[i].index; break;
        }
    }

    let queryArgs = [raycastHit.object.shapeName, faceID,
                        raycastHit.uv2.x, raycastHit.uv2.y,
                        raycastHit.point.x, raycastHit.point.y, raycastHit.point.z,
                        raycastHit.uvBounds];

    // Query the CAD Engine Thread for Info
    engine.execute("SurfaceQuery", BackendFunctions.querySurfaceBackend, queryArgs, callback);
}

/** *If engine is not busy*, callbacks info from the CAD engine about the surface.
 * Use this version for frequent updates that don't queue up and spiral of death.
 * @param {LeapShapeEngine} engine
 * @param {any} raycastHit,
 * @param {Function} callback */
export function safeQuerySurface(engine, raycastHit, callback) {
    if (!engine.workerWorking) { return querySurface(engine, raycastHit, callback); }
}

class BackendFunctions {

    /** This function is called in the backend and returns information about the surface.
     * @param {string} shapeName @param {number} faceIndex @param {number} u @param {number} v */
    static querySurfaceBackend(shapeName, faceIndex, u, v, x, y, z, uvBounds) {
        if (false) { this.oc = oc; } // This fools the intellisense into working

        let toReturn = { isMetadata: true };
        let shape = this.shapes[shapeName];
        let faceName = shapeName + " Face #" + faceIndex;

        // Get the BRepAdaptor_Surface associated with this face
        if (!this.surfaces) { this.surfaces = {}; }
        if (!(faceName in this.surfaces)) {
            let face = null; let face_index = 0;
            let anExplorer = new this.oc.TopExp_Explorer(shape, this.oc.TopAbs_FACE);
            for (anExplorer.Init(shape, this.oc.TopAbs_FACE); anExplorer.More(); anExplorer.Next()) {
                if (face_index === faceIndex) {
                    face = this.oc.TopoDS.prototype.Face(anExplorer.Current());
                    break;
                } else {
                    face_index += 1;
                }
            }

            // Cache the Adapter Surface in surfaces
            this.surfaces[faceName] = new this.oc.BRepAdaptor_Surface(face, false);
        }
        /** @type {oc.BRepAdaptor_Surface} */
        let adapter = this.surfaces[faceName];

        // Get the true implicit point
        let truePnt = adapter.Value(u, v);
        toReturn.x = truePnt.X(); toReturn.y = truePnt.Y(); toReturn.z = truePnt.Z();
        this.oc._free(truePnt);

        // Get the type of face
        toReturn.faceType = adapter.GetType(); // https://dev.opencascade.org/doc/occt-7.4.0/refman/html/_geom_abs___surface_type_8hxx.html

        // Get the point in the middle of the face if it's flat
        let UMin = 0.0, UMax = 0.0;
        let VMin = 0.0, VMax = 0.0;
        if (uvBounds) {
            UMin = uvBounds[0]; UMax = uvBounds[1];
            VMin = uvBounds[2]; VMax = uvBounds[3];
        }
        let UMid = (UMax + UMin) * 0.5, VMid = (VMax + VMin) * 0.5;
        let UMinMidMax = [UMin, UMid, UMax];
        let VMinMidMax = [VMin, VMid, VMax];
        let grid = [], uvs = [];
        for (let u = 0; u < 3; u++){
            for (let v = 0; v < 3; v++){
                uvs.push([UMinMidMax[u], VMinMidMax[v]]);
                let pnt = adapter.Value(UMinMidMax[u], VMinMidMax[v]);
                grid.push([pnt.X(), pnt.Y(), pnt.Z()]);
                this.oc._free(pnt);
            }
        }

        // Add the UV origin at the end for good measure
        let pnt = adapter.Value(0, 0);
        grid.push([pnt.X(), pnt.Y(), pnt.Z()]);
        this.oc._free(pnt);

        toReturn.grid = grid;
        toReturn.uvs = uvs;

        // Get Surface Normal, Tangent, and Curvature Info
        let surfaceHandle = this.oc.BRep_Tool.prototype.Surface(this.surfaces[faceName].Face());
        if (!this.props) {
            this.props = new this.oc.GeomLProp_SLProps(surfaceHandle, u, v, 1, 1);

        }
        this.props.SetSurface(surfaceHandle); this.props.SetParameters(u, v);

        // Capture Normal Direction
        if (this.props.IsNormalDefined()) {
            let normal = this.props.Normal()
            toReturn.nX = normal.X(); toReturn.nY = normal.Y(); toReturn.nZ = normal.Z();
            this.oc._free(normal);
        }

        // Capture Tangent Directions
        let tempDir = new this.oc.gp_Dir();
        if (this.props.IsTangentUDefined()) {
            this.props.TangentU(tempDir);
            toReturn.tU = [0, 0, 0];
            toReturn.tU[0] = tempDir.X(); toReturn.tU[1] = tempDir.Y(); toReturn.tU[2] = tempDir.Z();
        }
        if (this.props.IsTangentVDefined()) {
            this.props.TangentV(tempDir);
            toReturn.tV = [0, 0, 0];
            toReturn.tV[0] = tempDir.X(); toReturn.tV[1] = tempDir.Y(); toReturn.tV[2] = tempDir.Z();
        }
        this.oc._free(tempDir);

        return toReturn;
    }
}
