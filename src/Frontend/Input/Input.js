import * as THREE from '../../../node_modules/three/build/three.module.js';
import { MouseInput } from './MouseInput.js';
import { OpenXRHandInput } from './OpenXRHandInput.js';

/**
 * This is the input abstraction object for LeapShape.
 * Mice, Touchscreens, Hands, and Controllers all 
 * produce interaction rays.
 */
class InteractionRay {
    /**
     * Construct a new interaction ray from a three.js ray.
     * @param {THREE.Ray} ray The origin and direction of the interaction ray.
     */
    constructor(ray) {
        this.ray = ray;
        this.active = false;
        this.justActivated = false;
        this.ray.justDeactivated = false;
    }
}

/**
 * This is the input abstraction for LeapShape.
 * Mouse, Touchscreen, Hands, and Controllers 
 * are routed through here.
 */
class Input {
    
    constructor(world) {
        // Add your new input abstraction here!
        this.inputs = {
            mouse: new MouseInput(world),
            xrHands: new OpenXRHandInput(world)
        };
        this.activeInput = this.inputs.mouse;
        this.ray = new InteractionRay(new THREE.Ray());
    }

    /**
     * Update the various Input Abstractions and output the active InputRay.
     */
    update() {
        for(let input in this.inputs){
            this.inputs[input].update();
            if (this.inputs[input].isActive()) {
                this.activeInput = this.inputs[input];
                this.ray = this.inputs[input].ray;
            }
        }
        return this.ray;
    }

}

export { Input, InteractionRay };
