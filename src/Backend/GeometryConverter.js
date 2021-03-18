import * as THREE from '../../node_modules/three/build/three.module.js';

/** This function converts the output of the OpenCascade 
 * Mesh Data Callback to three.js BufferGeometry */
export default function ConvertGeometry(meshData) {
    // Accumulate data across faces into a single array
    let vertices = [], triangles = [], normals = [], colors = [], uvs = [], vInd = 0, globalFaceIndex = 0;
    meshData[0].forEach((face) => {
        // Copy Vertices into three.js Vector3 List
        vertices.push(...face.vertex_coord);
        normals .push(...face.normal_coord);
        uvs     .push(...face.    uv_coord);
        // Sort Triangles into a three.js Face List
        for (let i = 0; i < face.tri_indexes.length; i += 3) {
            triangles.push(
                face.tri_indexes[i + 0] + vInd,
                face.tri_indexes[i + 1] + vInd,
                face.tri_indexes[i + 2] + vInd);
        }
        globalFaceIndex++;
        vInd += face.vertex_coord.length / 3;
    });

    function disposeArray() { this.array = null; }

    // Compile the connected vertices and faces into a geometry object
    let geometry = new THREE.BufferGeometry();
    geometry.setIndex(triangles);
    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ).onUpload( disposeArray ) );
    geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ).onUpload( disposeArray ) );
    geometry.setAttribute( 'color', new THREE.Float32BufferAttribute(colors, 3).onUpload(disposeArray));
    geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ).onUpload( disposeArray ) );
    geometry.computeBoundingSphere();
    return geometry;
}
