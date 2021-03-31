import * as THREE from '../../node_modules/three/build/three.module.js';

/** This function converts the output of the OpenCascade 
 * Mesh Data Callback to three.js BufferGeometry */
export default function ConvertGeometry(meshData) {
    if (!meshData) { console.error("Mesher returned false..."); return null; }
    // Accumulate data across faces into a single array
    let vertices = [], triangles = [], normals = [], colors = [], uvs = [], vInd = 0, globalFaceIndex = 0;
    let faceMetaData = [];
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
        vInd += face.vertex_coord.length / 3;

        let faceMeta = {};
        faceMeta.index = globalFaceIndex++;
        faceMeta.is_planar = face.is_planar;
        faceMeta.average = face.average;
        faceMeta.normal = [face.normal_coord[0], face.normal_coord[1], face.normal_coord[2]];
        faceMetaData.push(faceMeta);
    });

    // Compile the connected vertices and faces into a geometry object
    let geometry = new THREE.BufferGeometry();
    geometry.setIndex(triangles);
    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
    geometry.setAttribute( 'color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    // Add Edges to Object
    // This wild complexity is what allows all of the lines to be drawn in a single draw call
    // AND highlighted on a per-edge basis by the mouse hover.  On the docket for refactoring.
    let lineVertices = []; let globalEdgeIndices = [];
    let curGlobalEdgeIndex = 0; let edgeVertices = 0;
    let globalEdgeMetadata = {}; globalEdgeMetadata[-1] = { start: -1, end: -1 };
    meshData[1].forEach((edge) => {
      let edgeMetadata = {};
      edgeMetadata.localEdgeIndex = edge.edge_index;
      edgeMetadata.start = globalEdgeIndices.length;
      for (let i = 0; i < edge.vertex_coord.length-3; i += 3) {
        lineVertices.push(new THREE.Vector3(edge.vertex_coord[i    ],
                                            edge.vertex_coord[i + 1],
                                            edge.vertex_coord[i + 2]));
                  
        lineVertices.push(new THREE.Vector3(edge.vertex_coord[i     + 3],
                                            edge.vertex_coord[i + 1 + 3],
                                            edge.vertex_coord[i + 2 + 3]));
        globalEdgeIndices.push(curGlobalEdgeIndex); globalEdgeIndices.push(curGlobalEdgeIndex);
        edgeVertices++;
      }
      edgeMetadata.end = globalEdgeIndices.length-1;
      globalEdgeMetadata[curGlobalEdgeIndex] = edgeMetadata;
      curGlobalEdgeIndex++;
    });

    let lineGeometry = new THREE.BufferGeometry().setFromPoints(lineVertices);
    let lineColors = []; for ( let i = 0; i < lineVertices.length; i++ ) { lineColors.push( 0, 0, 0 ); }
    lineGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( lineColors, 3 ) );

    let line = new THREE.LineSegments(lineGeometry, window.world.lineMaterial);
    line.globalEdgeIndices = globalEdgeIndices;
    line.name = "Model Edges";
    line.lineColors = lineColors;
    line.globalEdgeMetadata = globalEdgeMetadata;
    line.layers.set(1);
    // End Adding Edges

    // A minor bit of dependency inversion, but for the greater good
    let mesh = new THREE.Mesh(geometry, window.world.shapeMaterial);
    mesh.material.color.setRGB(0.5, 0.5, 0.5);
    mesh.faceMetadata = faceMetaData;
    mesh.add(line);
    return mesh;
}
