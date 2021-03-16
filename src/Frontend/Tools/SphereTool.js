import * as THREE from '../../../node_modules/three/build/three.module.js';
import { Menu } from './Menu.js';
import { Tools } from './Tools.js';

/** This class controls all of the Tool and Menu State Machines */
class SphereTool {

    /** Create the SphereTool
     * @param {Tools} tools */
    constructor(tools) {
        this.world = tools.world;
        this.state = -1; // -1 is Deactivated

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ('../../../build/textures/noun_Sphere.png' );
        this.descriptor = {
            name: "Sphere Tool",
            icon: this.icon
        }
    }

    /** Update the SphereTool's State Machine
     * @param {THREE.Ray} ray The Current Input Ray */
    update(ray) {
        if (ray.alreadyActivated) { return;}

        if (this.state === -1) {
            // Tool is currently deactivated
            return;
        } else if(this.state === 0) {
            // Wait for the mouse click to let go.

            if (!ray.active) {
                console.log("Ready to create Sphere!");
                this.state += 1;
            }
        } else if(this.state === 1) {
            // Wait for the ray to be active
            // And pointing at a drawable surface
            if (ray.active) {
                // Spawn the Sphere
                console.log("Sphere Dragging!");
                this.state += 1;
            }
        } else if(this.state === 2) {
            // While holding, resize the Sphere

            // When let go, deactivate
            // And Add to Undo!
            if (!ray.active) {
                console.log("Sphere Created!");
                this.state = -1;
            }
        }

        ray.alreadyActivated = true;
    }

}

export { SphereTool };
