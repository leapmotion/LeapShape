import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
import { querySurface } from '../Tools/ToolUtils.js';

/** This is an in-scene helper for measurements and precision placement. */
class Cursor {
    
    /** Initialize the Cursor
     * @param {World} world */
    constructor(world) {
        // Store a reference to the World
        this.world = world;
        this.oc = oc;
        this.engine = this.world.parent.engine;

        this.sphereGeo = new THREE.SphereBufferGeometry(1, 5, 5);
        this.cursor = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial());
        this.cursor.material.color.set(0x00ffff);
        this.cursor.name = "Cursor";
        this.cursor.receiveShadow = false;
        this.cursor.castShadow = false;
        this.cursor.layers.set(1); // Ignore Raycasts
        this.targetPosition = new THREE.Vector3();
        this.lastTimeTargetUpdated = performance.now();
        this.position = this.cursor.position;
        this.hitObject = null;

        this.middle = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial());
        this.middle.material.color.set(0xff0000);
        //this.middle.scale.set(new THREE.Vector3(10, 10, 10));
        this.middle.name = "Middle Marker";
        this.middle.receiveShadow = false;
        this.middle.castShadow = false;
        this.middle.layers.set(1); // Ignore Raycasts

        //this.world.cursor = this.cursor;
        this.world.scene.add(this.cursor);
        this.world.scene.add(this.middle);
    }

    update() {
        if (performance.now() - this.lastTimeTargetUpdated < 100) {
            this.cursor.visible = true;

            // Lerp the Cursor to the Target Position
            if (this.metadata) {
                this.cursor.position.set(this.metadata.x, this.metadata.y, this.metadata.z);
                this.middle.position.set(this.metadata.midX, this.metadata.midY, this.metadata.midZ);
            } else {
                this.cursor.position.lerp(this.targetPosition, 0.15);
            }

            // Make the Cursor Contents Face the Camera
            this.cursor.quaternion.slerp(this.world.camera.quaternion, 0.15);

            if (this.hit && this.hit.object.shapeName && !this.engine.workerWorking) {
                querySurface(this.world.parent.engine, this.hit, (metadata) => { this.metadata = metadata; console.log(metadata); });
            }

        } else {
            this.cursor.visible = false;
        }
    }

    updateMetadata(position, raycastHit) {
        this.targetPosition.copy(position);
        this.hit = raycastHit;
        this.lastTimeTargetUpdated = performance.now();
    }

}

export { Cursor };
