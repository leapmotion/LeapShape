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
        this.needsUpdate = true;
        this.updateCount = 0;

        // The coordinate space for the grid
        this.space = new THREE.Group();
        this.space.layers.set(1);

        // The Visual Grid Mesh
        this.gridCells = 10;
        //this.gridMesh = new THREE.GridHelper( this.gridPitch * this.gridCells, this.gridCells, 0x000000, 0x000000 );
        //this.gridMesh.material.opacity = 0.2;
        //this.gridMesh.material.transparent = true;
        //this.gridMesh.layers.set(1);
        //this.space.add(this.gridMesh);

        this.sphereGeometry = new THREE.SphereBufferGeometry(1, 5, 5);
        this.gridSpheres = new THREE.InstancedMesh(this.sphereGeometry, new THREE.MeshStandardMaterial(), this.gridCells * (this.gridCells + 3));
        this.gridSpheres.castShadow = true;
        this.gridSpheres.layers.set(1);
        this.radius = 2; this.mat = new THREE.Matrix4(); this.gridCenter = new THREE.Vector3(); this.tempVec = new THREE.Vector3();
        this.pos = new THREE.Vector3(); this.rot = new THREE.Quaternion().identity(); this.scale = new THREE.Vector3();
        this.updateGridVisual(this.gridCenter);
        this.space.add(this.gridSpheres);

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

            // Set the dot center
            this.updateGridVisual(this.tempVec.copy(raycastHit.point));

            this.needsUpdate = false;
            this.updateCount += 1;
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

            // Set the dot center
            this.updateGridVisual(this.tempVec.set(this.queryResult.x, this.queryResult.y, this.queryResult.z));

            this.needsUpdate = false;
            this.updateCount += 1;
        }
    }

    updateGridVisual(worldCenter) {
        this.space.updateWorldMatrix(true, true);
        this.gridSpheres.position.copy(this.space.worldToLocal(this.snapToGrid(worldCenter.clone())));
        this.gridSpheres.updateWorldMatrix(true, true);
        let center = new THREE.Vector3().copy(worldCenter);
        this.gridSpheres.worldToLocal(center);

        let i = 0;
        for (let x = -this.gridCells / 2; x <= this.gridCells/2; x++){
            for (let y = -this.gridCells / 2; y <= this.gridCells / 2; y++){
                let newX = ((x ) * this.gridPitch) - center.x;
                let newY = ((y ) * this.gridPitch) - center.z;
                this.radius = Math.min(2, (8 * this.gridPitch * this.gridPitch) /
                                ((newX * newX) + (newY * newY) + 0.0001));

                this.pos.set(x * this.gridPitch, 0, y * this.gridPitch)
                this.mat.makeRotationFromQuaternion(this.rot)
                    .scale(this.scale.set(this.radius, this.radius, this.radius)).setPosition(this.pos);
                this.gridSpheres.setMatrixAt(i, this.mat);
                //this.gridSpheres.setColorAt (i, temp_color.setRGB(color[0], color[1], color[2]));
                i++;
            }
        }

        // Upload the adjusted instance data to the GPU
        this.gridSpheres.count = i;
        if (this.gridSpheres.instanceColor ) { this.gridSpheres.instanceColor .needsUpdate = true; }
        if (this.gridSpheres.instanceMatrix) { this.gridSpheres.instanceMatrix.needsUpdate = true; }
    }

    /** Snap this position to the grid
     * @param {THREE.Vector3} position
     * @param {boolean} volumetric */
    snapToGrid(position, volumetric) {
        this.vec1.copy(position);
        this.space.worldToLocal(this.vec1);
        if (!volumetric) { this.vec1.y = 0; }
        snapToGrid(this.vec1, this.gridPitch);
        this.space.localToWorld(this.vec1);
        position.copy(this.vec1);
        return position;
    }

    /** @param {number} length */
    snapToGrid1D(length, incrementOverride) {
        return (Math.round((length + Number.EPSILON) /
            (incrementOverride || this.gridPitch)) * (incrementOverride || this.gridPitch));
    }

    /** @param {boolean} visible */
    setVisible(visible) {
        this.space.visible = visible;
        if (!visible) {
            this.space.position.set(0, 0, 0);
            this.space.quaternion.identity();
            this.updateCount = 0;
        }
    }
}

export { Grid };
