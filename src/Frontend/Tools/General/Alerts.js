import * as THREE from '../../../../node_modules/three/build/three.module.js';
import { HTMLMesh } from '../../World/three.html.js';

/** This is an in-scene helper for measurements and precision placement. */
class Alerts {
    
    /** Initialize the Alerts
     * @param {Tools} tools */
    constructor(tools) {
        // Store a reference to the World
        this.tools = tools;
        this.world = tools.world;
        this.engine = this.world.parent.engine;
        this.cursor = this.tools.cursor;

        this.alerts = new THREE.Group();
        this.alerts.name = "Alerts";
        this.alerts.layers.set(1); // Ignore Raycasts

        this.targetPosition = new THREE.Vector3();
        this.lastTimeTargetUpdated = performance.now();
        this.position = this.alerts.position;
        this.hitObject = null;
        this.vec1 = new THREE.Vector3(); this.vec2 = new THREE.Vector3();
        this.quat = new THREE.Quaternion();
        this.fadeTime = 1000;

        // Create a Text Updating Label for the General Alert Data
        this.labels = [];
        for (let i = 0; i < 5; i++) {
            this.label = new HTMLMesh(this.cursor.labelElem);
            this.label.layers.set(1); // Ignore Raycasts
            this.alerts.add (this.label);
            this.labels.push(this.label);
        }

        this.world.scene.add(this.alerts);
    }

    update() {
        if (performance.now() - this.lastTimeTargetUpdated < 100) {
            let alpha = this.alerts.visible ? 0.25 : 1.0;

            this.alerts.visible = true;

            // Lerp the Alerts to the Target Position
            this.alerts.position.lerp(this.cursor.targetPosition, alpha);

            // Make the Alerts Contents Face the Camera
            this.alerts.quaternion.slerp(this.world.camera.getWorldQuaternion(this.quat), alpha);

            // Lerp the Alerts to Stack on top of each other
            for (let i = 0; i < this.labels.length; i++){
                this.labels[i].position.y =
                    (this.labels[i].position.y   * 1 - alpha) +
                    (this.labels[i].targetHeight *     alpha);
                
                let age = performance.now() - this.labels[0].lastUpdated;
                if (age < this.fadeTime) {
                    this.labels[i].visible = true;
                    this.labels[i].material.opacity = (this.fadeTime - age)/this.fadeTime;
                } else {
                    this.labels[i].visible = false;
                }
            }

        } else {
            this.alerts.visible = false;
        }
    }

    displayInfo(text) {
        if (this.cursor.labelElem.innerText !== text) {
            // Display HTML Element
            this.cursor.labelElem.style.display = "block";
            // Set HTML Element's Text
            this.cursor.labelElem.innerText = text;
            // Move end label to the beginning
            this.labels.splice(0, 0, this.labels.splice(this.labels.length - 1, 1)[0]); 
            // Render HTML Element's Text to the Mesh
            this.labels[0].update(world);
            this.labels[0].lastUpdated = performance.now();
            // Hide HTML Element
            this.cursor.labelElem.style.display = "none";
        }

        // Update the target height to stack the labels on top of eachother
        let curTargetHeight = 0;
        for (let i = 0; i < this.labels.length; i++){
            this.labels[i].targetHeight = curTargetHeight;
            curTargetHeight += this.labels[i].scale.y;
        }

        this.lastTimeTargetUpdated = performance.now();
    }
}

export { Alerts };