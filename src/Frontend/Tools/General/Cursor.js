/**
 * Copyright 2021 Ultraleap, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as THREE from '../../../../node_modules/three/build/three.module.js';
import { TextMesh } from '../../World/TextMesh.js';

/** This is an in-scene helper for measurements and precision placement. */
class Cursor {
    
    /** Initialize the Cursor
     * @param {Tools} tools */
    constructor(tools) {
        // Store a reference to the World
        this.tools = tools;
        this.world = tools.world;
        this.engine = this.world.parent.engine;

        this.sphereGeo = new THREE.SphereGeometry(0.003, 5, 5);
        this.cursor = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial( {depthTest: false}));
        this.cursor.material.color.set(0x00ffff);
        this.cursor.name = "Cursor";
        this.cursor.receiveShadow = false;
        this.cursor.castShadow = false;
        this.cursor.layers.set(1); // Ignore Raycasts
        this.cursor.frustumCulled = false;
        this.targetPosition = new THREE.Vector3();
        this.lastTimeTargetUpdated = performance.now();
        this.position = this.cursor.position;
        this.hitObject = null;

        // Create a Text Updating Label for the Coordinate Data
        this.label = new TextMesh('');
        this.label.frustumCulled = false;
        this.label.layers.set(1); // Ignore Raycasts
        this.cursor.add(this.label);

        this.vec1 = new THREE.Vector3(); this.vec2 = new THREE.Vector3();
        this.quat = new THREE.Quaternion();

        this.world.scene.add(this.cursor);
    }

    update() {
        if (performance.now() - this.lastTimeTargetUpdated < 100) {
            let alpha = this.cursor.visible ? 0.25 : 1.0;

            this.cursor.visible = true;

            // Lerp the Cursor to the Target Position
            this.cursor.position.lerp(this.targetPosition, alpha);

            // Make the Cursor Contents Face the Camera
            this.cursor.quaternion.slerp(this.world.camera.getWorldQuaternion(this.quat), alpha);

            this.cursor.scale.copy(this.world.camera.getWorldScale(this.vec1));
        } else {
            this.cursor.visible = false;
        }
    }

    updateTarget(position, raycastHit) {
        this.targetPosition.copy(position);
        this.hit = raycastHit;
        this.lastTimeTargetUpdated = performance.now();
    }

    updateLabel(text, r = 0, g = 0, b = 0) {
        if (this.label.text !== text) {
            this.label.update(text, r, g, b);
        }
    }

    updateLabelNumbers(...numbers) {
        // Compute New Label String
        let str = "(";
        numbers.forEach((num) => { str += Number(num.toFixed(2)) + ", "; });
        str = str.substr(0, str.length - 2);
        str += ")";

        this.updateLabel(str, 0, 0, 0);
    }
}

export { Cursor };
