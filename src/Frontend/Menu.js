import * as THREE from '../../node_modules/three/build/three.module.js';
import { World } from './World.js';

/** The menu system for selecting tools and configuring behavior. */
class Menu {

    /** Create the menu scaffolding
     * @param {World} world */
    constructor(world) {
        this.world = world;

        this.normalColor      = new THREE.Color(0.4, 0.4, 0.4);
        this.highlightedColor = new THREE.Color(0.7, 0.8, 0.7);
        this.tempV3           = new THREE.Vector3();

        // Menu Container
        this.menu = new THREE.Group(); this.menuItems = [];
        for (let i = 0; i < 10; i++) {
            let menuItem = new THREE.Mesh(new THREE.SphereBufferGeometry(20, 20),
                                          new THREE.MeshPhongMaterial({ color: 0x999999, transparent: true, opacity: 0.5 }));
            menuItem.name = "Menu Item #"+i;
            menuItem.rotation.y = - Math.PI / 4;
            menuItem.position.x = i * 50;
            menuItem.receiveShadow = false;
            menuItem.castShadow = false;
            this.menuItems.push(menuItem);
            this.menu.add(menuItem);
        }
        this.world.scene.add(this.menu);

        // Define a series of slot objects for the menu items to lerp towards...
        this.slots = [];
        for (let i = 0; i < 10; i++) {
            let slot = new THREE.Group();
            slot.name = "Slot #"+i;
            slot.position.x = (i * 50) - 225;
            slot.position.y = -100;
            slot.position.z = -300;
            this.slots.push(slot);
            this.world.camera.add(slot);
        }
    }

    /** Update the menu motion and interactive state 
     * @param {THREE.Ray} ray The Current Input Ray */
    update(ray) {
        // Check to see if the interaction ray intersects one of these items
        this.world.raycaster.set(ray.origin, ray.direction);
        let intersects = this.world.raycaster.intersectObject(this.menu, true);

        for (let i = 0; i < this.menuItems.length; i++){
            // Hover highlight the menu spheres
            if (intersects.length > 0 && intersects[0].object === this.menuItems[i]) {
                this.menuItems[i].material.color.lerp(this.highlightedColor, 0.1);
            } else {
                this.menuItems[i].material.color.lerp(this.normalColor, 0.1);
            }

            // Lerp the Spheres to their Target Slot's position
            this.menuItems[i].position.lerp(this.slots[i].getWorldPosition(this.tempV3), 0.05);
        }

        ray.alreadyActivated = ray.alreadyActivated || (intersects.length > 0);
    }

}

export { Menu };
