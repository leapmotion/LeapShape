import * as THREE from '../../../node_modules/three/build/three.module.js';
import { HTMLMesh } from '../World/three.html.js';

/** This is an in-scene helper for measurements and precision placement. */
class Cursor {
    
    /** Initialize the Cursor
     * @param {Tools} tools */
    constructor(tools) {
        // Store a reference to the World
        this.tools = tools;
        this.world = tools.world;
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

        // Create a Text Updating Label for the Coordinate Data
        this.labelElem = document.createElement("a");
        this.labelElem.innerText = "Abs: (0,0,0)";
        this.labelElem.style.backgroundColor = 'transparent';
        this.labelElem.style.fontSize = '40px';
        this.labelElem.style.display = "none";
        document.getElementById("topnav").appendChild(this.labelElem);
        this.label = new HTMLMesh(this.labelElem);
        this.label.layers.set(1); // Ignore Raycasts
        this.cursor.add(this.label);

        this.vec1 = new THREE.Vector3(); this.vec2 = new THREE.Vector3();

        this.world.scene.add(this.cursor);
    }

    update() {
        if (performance.now() - this.lastTimeTargetUpdated < 100) {
            this.cursor.visible = true;

            // Lerp the Cursor to the Target Position
            this.cursor.position.lerp(this.targetPosition, 0.25);

            // Make the Cursor Contents Face the Camera
            this.cursor.quaternion.slerp(this.world.camera.quaternion, 0.25);
        } else {
            this.cursor.visible = false;
        }
    }

    updateTarget(position, raycastHit) {
        this.targetPosition.copy(position);
        this.hit = raycastHit;
        this.lastTimeTargetUpdated = performance.now();
    }

    updateLabel(text) {
        this.labelElem.style.display = "block";
        this.labelElem.innerText = text;
        this.label.update();
        this.labelElem.style.display = "none";
    }

    updateLabelNumbers(...numbers) {
        this.labelElem.style.display = "block";
        this.labelElem.innerText = "(";
        numbers.forEach((num) => { this.labelElem.innerText += Number(num.toFixed(2)) + ", "; });
        this.labelElem.innerText = this.labelElem.innerText.substr(0, this.labelElem.innerText.length - 1);
        this.labelElem.innerText += ")";
        this.label.update();
        this.labelElem.style.display = "none";
    }

}

export { Cursor };
