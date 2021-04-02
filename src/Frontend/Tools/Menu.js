import * as THREE from '../../../node_modules/three/build/three.module.js';
import { Tools } from './Tools.js';
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
        this.menuHeld         = false;

        this.menuSphereGeo = new THREE.SphereBufferGeometry(20, 20);
        this.menuPlaneGeo  = new THREE.PlaneBufferGeometry (25, 25);

        // Menu Container
        this.menu = new THREE.Group(); this.menuItems = [];
        for (let i = 0; i < tools.tools.length; i++) {
            let menuItem = new THREE.Mesh(this.menuSphereGeo,
                new THREE.MeshToonMaterial({ color: 0x999999, transparent: true, opacity: 0.5, depthTest: false }));
            menuItem.name = "Menu Item - "+i;
            menuItem.receiveShadow = false;
            menuItem.castShadow = false;

            let menuItemIcon = new THREE.Mesh(this.menuPlaneGeo,
                new THREE.MeshBasicMaterial(
                    { color: 0x999999, alphaTest: 0.5, map: tools.tools[i].descriptor.icon, depthTest:false }));
            menuItemIcon.name = "Menu Item Icon - "+i;
            menuItemIcon.receiveShadow = false;
            menuItemIcon.castShadow = false;
            menuItem.icon = menuItemIcon;
            menuItem.add(menuItemIcon);

            menuItem.tool = tools.tools[i];

            this.menuItems.push(menuItem);
            this.menu.add(menuItem);
        }
        this.world.scene.add(this.menu);

        // Define a series of slot objects for the menu items to lerp towards...
        this.slots = [];
        for (let i = 0; i < 10; i++) {
            let slot = new THREE.Group();
            slot.name = "Slot #" + i;
            slot.canonicalPosition = new THREE.Vector3((i * 50) - 100, -100, -300);
            slot.position.copy(slot.canonicalPosition);
            this.slots.push(slot);
            this.world.camera.add(slot);
        }
    }

    /** Update the menu motion and interactive state 
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) {
        // Update the slot positions based on the camera's aspect
        let minAspect = Math.min(this.world.camera.aspect, 1.0);
        for (let i = 0; i < 10; i++) {
            this.slots[i].position.y = this.slots[i].canonicalPosition.y / minAspect;
            this.slots[i].position.z = this.slots[i].canonicalPosition.z / minAspect;
        }

        // Check to see if the interaction ray intersects one of these items
        this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
        let intersects = this.world.raycaster.intersectObject(this.menu, true);

        let activeMenuIndex = 0;
        for (let i = 0; i < this.menuItems.length; i++){
            // Hide/Show Contextual Menu Items
            if (!this.menuItems[i].tool.shouldShow || this.menuItems[i].tool.shouldShow()) {
                if (!this.menu.children.includes(this.menuItems[i])) { this.menu.add(this.menuItems[i]); }
            } else {
                if (this.menu.children.includes(this.menuItems[i])) { this.menu.remove(this.menuItems[i]); }
                continue;
            }

            // Hover highlight the menu spheres
            if (intersects.length > 0 && intersects[0].object === this.menuItems[i]) {
                if (ray.justDeactivated && this.menuHeld) {
                    // Activate the tool associated with this ID
                    this.tools.tools[i].activate();
                    this.menuItems[i].material.color.copy(this.pressedColor);
                    this.menuHeld = false;
                } else if (ray.justActivated || this.menuHeld) {
                    this.menuHeld = true;
                    this.menuItems[i].material.color.lerp(this.heldColor, 0.15);
                } else {
                    this.menuHeld = false;
                    this.menuItems[i].material.color.lerp(this.highlightedColor, 0.15);
                }
            } else {
                this.menuItems[i].material.color.lerp(this.normalColor, 0.15);
            }

            // Lerp the Spheres to their Target Slot's position
            this.menuItems[i].position.lerp(this.slots[activeMenuIndex].getWorldPosition(this.tempV3), 0.1);

            // Make the Icon Face the Camera
            this.menuItems[i].icon.quaternion.slerp(this.world.camera.quaternion, 0.1);

            activeMenuIndex += 1;
        }

        if (!ray.active) { this.menuHeld = false; }

        ray.alreadyActivated = ray.alreadyActivated || this.menuHeld;
    }

}

export { Menu };
