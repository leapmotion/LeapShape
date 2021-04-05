import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
import { safeQuerySurface, snapToGrid } from '../Tools/ToolUtils.js';

/** This is an in-scene helper for measurements and precision placement. */
class Grid {
    
    /** Initialize the Grid
     * @param {Tools} tools */
    constructor(tools) {
        // Store a reference to the World
        this.tools = tools; this.world = tools.world; this.oc = oc;
        this.engine = this.world.parent.engine;

        this.gridPitch = 10;
        this.vec1 = new THREE.Vector3();
        this.vec2 = new THREE.Vector3();
        this.normal = new THREE.Vector3();

        // The coordinate space for the grid
        this.space = new THREE.Group();
        this.space.layers.set(1);

        // The Visual Grid Mesh
        this.gridCells = 20;
        this.gridMesh = new THREE.GridHelper( this.gridPitch * this.gridCells, this.gridCells, 0x000000, 0x000000 );
        this.gridMesh.material.opacity = 0.2;
        this.gridMesh.material.transparent = true;
        this.gridMesh.layers.set(1);
        this.space.add(this.gridMesh);

        this.world.scene.add(this.space);
        this.setVisible(false);
    }

    updateWithHit(raycastHit) {
        if (raycastHit.object.shapeName) {
            safeQuerySurface(this.world.parent.engine, raycastHit, (queryResult) => {
                this.updateWithQuery(queryResult);
            });
        } else {
            // Set Grid Position
            this.space.position.set(
                raycastHit.object.position.x,
                raycastHit.object.position.y,
                raycastHit.object.position.z);

            // Set Grid Rotation
            this.space.quaternion.identity();
            this.normal.copy(raycastHit.face.normal.clone().transformDirection(raycastHit.object.matrixWorld));
        }
    }

    updateWithQuery(queryResult) {
        this.queryResult = queryResult;

        // Set Grid Position
        if (this.queryResult.hasOwnProperty("nX")) {
            if (this.queryResult.faceType == 0) {
                // If face is a plane, set the origin to the plane origin
                this.space.position.set(this.queryResult.midX, this.queryResult.midY, this.queryResult.midZ);
            } else {
                // If face is curved, set the origin to the current point on the curve
                this.space.position.set(this.queryResult.x, this.queryResult.y, this.queryResult.z);
            }

            // Set Grid Rotation
            this.vec1.set(0, 1, 0); this.normal.set(this.queryResult.nX, this.queryResult.nY, this.queryResult.nZ);
            this.space.quaternion.setFromUnitVectors(this.vec1, this.normal);
        }
    }

    /** @param {THREE.Vector3} position */
    snapToGrid(position) {
        this.vec1.copy(position);
        this.space.worldToLocal(this.vec1);
        this.vec1.y = 0;
        snapToGrid(this.vec1, this.gridPitch);
        this.space.localToWorld(this.vec1);
        position.copy(this.vec1);
        return position;
    }

    /** @param {number} length */
    snapToGrid1D(length) {
        return (Math.round((length + Number.EPSILON) / this.gridPitch) * this.gridPitch);
    }

    /** @param {boolean} visible */
    setVisible(visible) { this.space.visible = visible; }
}

export { Grid };
