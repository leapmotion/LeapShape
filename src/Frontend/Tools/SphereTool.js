import * as THREE from '../../../node_modules/three/build/three.module.js';
import { Menu } from './Menu.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';

/** This class controls all of the Tool and Menu State Machines */
class SphereTool {

    /** Create the SphereTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools = tools;
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
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) {
        if (ray.alreadyActivated || this.state === -1) {
            return; // Tool is currently deactivated
        } else if(this.state === 0) {
            // Wait for the ray to be active and pointing at a drawable surface
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObject(this.world.scene, true);

            if (ray.active && intersects.length > 0) {
                // Record the hit object and plane...
                this.hitObject = intersects[0].object;

                // Spawn the Sphere
                this.currentSphere = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 10, 10),
                                                    new THREE.MeshPhongMaterial());
                this.currentSphere.position.copy(intersects[0].point);
                this.world.scene.add(this.currentSphere);

                this.state += 1;
            }
        } else if(this.state === 1) {
            // While holding, resize the Sphere
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObject(this.hitObject);
            if (intersects.length > 0) {
                let distance = intersects[0].point.sub(this.currentSphere.position).length();
                this.currentSphere.scale.x = distance;
                this.currentSphere.scale.y = distance;
                this.currentSphere.scale.z = distance;
            }

            // When let go, deactivate and Add to Undo!
            if (!ray.active) {
                this.currentSphere = null;
                this.deactivate();
            }
        }

        ray.alreadyActivated = true;
    }

    activate() {
        this.state = 0;
        if (this.tools.activeTool) {
            this.tools.activeTool.deactivate();
        }
        this.tools.activeTool = this;
    }

    deactivate() {
        this.state = -1;
        this.tools.activeTool = null;
        if (this.currentSphere) {
            this.currentSphere.parent.remove(this.currentSphere);
        }
    }

}

export { SphereTool };
