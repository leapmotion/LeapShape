import * as THREE from '../../../node_modules/three/build/three.module.js';
import { World } from '../World/World.js';
import { InteractionRay } from '../Input/Input.js';

/** The menu system for selecting tools and configuring behavior. */
class Menu {

    /** Create the menu scaffolding
     * @param {Tools} tools */
    constructor(tools) {
        this.tools = tools;
        this.world = tools.world;

        this.normalColor      = new THREE.Color(0.4, 0.4, 0.4);
        this.highlightedColor = new THREE.Color(0.5, 0.6, 0.5);
        this.pressedColor     = new THREE.Color(1.0, 0.6, 0.5);
        this.heldColor        = new THREE.Color(1.0, 0.3, 0.3);
        this.tempV3           = new THREE.Vector3();

        // Menu Container
        this.menu = new THREE.Group(); this.menuItems = [];
        for (let i = 0; i < tools.tools.length; i++) {
            let menuItem = new THREE.Mesh(new THREE.SphereBufferGeometry(20, 20),
                                          new THREE.MeshToonMaterial({ color: 0x999999, transparent: true, opacity: 0.5, depthTest:false }));
            menuItem.name = "Menu Item - "+i;
            menuItem.receiveShadow = false;
            menuItem.castShadow = false;

            let menuItemIcon = new THREE.Mesh(new THREE.PlaneBufferGeometry(25, 25),
                new THREE.MeshBasicMaterial(
                    { color: 0x999999, alphaTest: 0.5, map: tools.tools[i].descriptor.icon, depthTest:false }));
            menuItemIcon.name = "Menu Item Icon - "+i;
            menuItemIcon.receiveShadow = false;
            menuItemIcon.castShadow = false;
            menuItem.icon = menuItemIcon;
            menuItem.add(menuItemIcon);

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
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) {
        // Check to see if the interaction ray intersects one of these items
        this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
        let intersects = this.world.raycaster.intersectObject(this.menu, true);

        for (let i = 0; i < this.menuItems.length; i++){
            // Hover highlight the menu spheres
            if (intersects.length > 0 && intersects[0].object === this.menuItems[i]) {
                if (ray.justDeactivated) {
                    // Activate the tool associated with this ID
                    this.tools.tools[i].activate();
                    this.menuItems[i].material.color.copy(this.pressedColor);
                } else if (ray.active) {
                    this.menuItems[i].material.color.lerp(this.heldColor, 0.15);
                } else {
                    this.menuItems[i].material.color.lerp(this.highlightedColor, 0.15);
                }
            } else {
                this.menuItems[i].material.color.lerp(this.normalColor, 0.15);
            }

            // Lerp the Spheres to their Target Slot's position
            this.menuItems[i].position.lerp(this.slots[i].getWorldPosition(this.tempV3), 0.1);

            // Make the Icon Face the Camera
            this.menuItems[i].icon.lookAt(this.world.camera.getWorldPosition(this.tempV3))
        }

        ray.alreadyActivated = ray.alreadyActivated || (intersects.length > 0);
    }

}

export { Menu };
