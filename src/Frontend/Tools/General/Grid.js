import * as THREE from '../../../../node_modules/three/build/three.module.js';
import oc from '../../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
import { safeQuerySurface, snapToGrid } from './ToolUtils.js';

/** This is an in-scene helper for measurements and precision placement. */
class Grid {
    
    /** Initialize the Grid
     * @param {Tools} tools */
    constructor(tools) {
        // Store a reference to the World
        this.tools = tools; this.world = tools.world; this.oc = oc;
        this.engine = this.world.parent.engine;

        this.gridPitch = 0.01;
        this.vec1 = new THREE.Vector3();
        this.vec2 = new THREE.Vector3();
        this.normal = new THREE.Vector3();
        this.color = new THREE.Color();
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

        this.sphereGeometry = new THREE.SphereBufferGeometry(0.001, 5, 5);
        this.gridSpheres = new THREE.InstancedMesh(this.sphereGeometry, new THREE.MeshBasicMaterial(), this.gridCells * (this.gridCells + 3) + 10);
        this.gridSpheres.castShadow = true;
        this.gridSpheres.layers.set(1);
        this.gridSpheres.frustumCulled = false;
        this.radius = 2; this.mat = new THREE.Matrix4(); this.gridCenter = new THREE.Vector3(); this.tempVec = new THREE.Vector3();
        this.pos = new THREE.Vector3(); this.rot = new THREE.Quaternion().identity(); this.scale = new THREE.Vector3();
        this.updateGridVisual(this.gridCenter);
        this.space.add(this.gridSpheres);

        this.world.scene.add(this.space);
        this.setVisible(false);
    }

    updateWithHit(raycastHit) {
        this.worldScale = this.world.camera.getWorldScale(this.vec1).x;
        this.gridPitch = 0.00125;
        while (this.gridPitch < (this.worldScale * 0.01)-Number.EPSILON) { this.gridPitch *= 2;}

        if (raycastHit.object.shapeName) {
            // Append the UV Bounds to the query since they're impossible to get in the query
            let index = raycastHit.faceIndex;
            for (let i = 0; i < raycastHit.object.faceMetadata.length; i++){
                let curFace = raycastHit.object.faceMetadata[i];
                if (curFace.start <= index && index < curFace.end) {
                    raycastHit.uvBounds = curFace.uvBounds; break;
                }
            }

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
                let origin = this.queryResult.grid[this.queryResult.grid.length - 1];
                this.space.position.set(origin[0], origin[1], origin[2]);
            } else {
                // If face is curved, set the origin to the current point on the curve
                this.space.position.set(this.queryResult.x, this.queryResult.y, this.queryResult.z);
            }

            // Set Grid Rotation
            this.vec1.set(0, 1, 0); this.normal.set(this.queryResult.nX, this.queryResult.nY, this.queryResult.nZ);
            this.space.quaternion.setFromUnitVectors(this.vec1, this.normal);

            // Set the dot center
            this.updateGridVisual(this.tempVec.set(this.queryResult.x, this.queryResult.y, this.queryResult.z), this.queryResult.grid);

            this.needsUpdate = false;
            this.updateCount += 1;
        }
    }

    updateGridVisual(worldCenter, grid) {
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
                                ((newX * newX) + (newY * newY) + 0.0001)) * this.worldScale;

                this.pos.set(x * this.gridPitch, 0, y * this.gridPitch)
                this.mat.makeRotationFromQuaternion(this.rot)
                    .scale(this.scale.set(this.radius, this.radius, this.radius)).setPosition(this.pos);
                this.gridSpheres.setMatrixAt(i, this.mat);
                this.gridSpheres.setColorAt (i, this.color.setRGB(0.7, 0.7, 0.7));
                i++;
            }
        }

        if (grid) {
            for (let g = 0; g < grid.length; g++) {
                this.pos.set(grid[g][0], grid[g][1], grid[g][2]);
                this.gridSpheres.worldToLocal(this.pos);
                this.mat.makeRotationFromQuaternion(this.rot)
                    .scale(this.scale.set(
                        2.5 * this.worldScale,
                        2.5 * this.worldScale,
                        2.5 * this.worldScale)).setPosition(this.pos);
                this.gridSpheres.setMatrixAt(i, this.mat);
                this.gridSpheres.setColorAt (i, this.color.setRGB(0.0, 1.0, 1.0));
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
