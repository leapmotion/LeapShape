import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';
import { createDitherDepthMaterial } from './ToolUtils.js';
import { TransformControls } from '../../../node_modules/three/examples/jsm/controls/TransformControls.js';

/** This class controls all of the DefaultTool behavior */
class DefaultTool {

    /** Create the DefaultTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;
        this.oc = oc; this.shapes = {};

        this.state = -1; // -1 is Deactivated
        this.selected = [];

        this.hitObject = null;
        this.point = new THREE.Vector3();
        this.tangentAxis = new THREE.Vector3(); 
        this.rayPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000, 1000),
                                       new THREE.MeshBasicMaterial());
        this.vec = new THREE.Vector3(), this.quat1 = new THREE.Quaternion(), this.quat2 = new THREE.Quaternion();
        this.xQuat = new THREE.Quaternion(), this.yQuat = new THREE.Quaternion();

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ('../../../textures/Cursor.png' );
        this.descriptor = {
            name: "Default Tool",
            icon: this.icon
        }

        this.gizmo = new TransformControls(this.world.camera, this.world.container);
        this.gizmo.addEventListener('dragging-changed', (event) => { this.draggingGizmo = event.value; });
        this.gizmoTransform = new THREE.Group();
        this.world.scene.add( this.gizmoTransform );
        this.gizmo.attach( this.gizmoTransform );
        //this.world.scene.add(this.gizmo);
        this.draggingGizmo = false;
        this.gizmo.visible = false;
        this.gizmo.enabled = this.gizmo.visible;
    }

    /** Update the DefaultTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) {
        if (ray.alreadyActivated || this.state === -1) {
            return; // Tool is currently deactivated
        } else if (this.state === 0) {
            // Tool is currently in Selection Mode
            if (ray.active) {
                if (!this.draggingGizmo) {
                    if (this.raycastObject(ray)) {
                        // Hit an Object, toggle its selection state
                        this.toggleSelection(this.hitObject);
                    } else {
                        // Hit Nothing, clear the selection
                        this.clearSelection();
                        this.hitObject = null;
                    }
                }
                this.state = 1;
            }
        } else if(this.state === 1) {
            // Wait for the ray to be active and pointing at a drawable surface
            if (!ray.active) {
                this.state = 0;
                this.hitObject = null;
            }
        }

        this.updateGizmoVisibility();

        ray.alreadyActivated = this.hitObject !== null || this.draggingGizmo || ray.alreadyActivated;
    }

    updateGizmoVisibility() {
        // Both need to be set to make it inactive
        let gizmoActive = this.selected.length > 0;
        if (gizmoActive && !this.gizmo.visible) {
            this.world.scene.add(this.gizmo);
        } else if (!gizmoActive && this.gizmo.visible) {
            this.world.scene.remove(this.gizmo);
        }
        this.gizmo.visible = gizmoActive;
        this.gizmo.enabled = this.gizmo.visible;
    }

    raycastObject(ray) {
        this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
        let intersects = this.world.raycaster.intersectObject(this.world.history.shapeObjects, true);//
        if (ray.active && intersects.length > 0) {
            this.hit = intersects[0];
            // Shoot through the floor if necessary
            for (let i = 0; i < intersects.length; i++) {
                if (intersects[i].object.name.includes("#")) {
                    this.hit = intersects[i]; break;
                }
            }

            // Record the hit object and plane...
            console.log(this.hit.object);
            if (this.hit.object.name.includes("#")) {
                this.hitObject = this.hit.object;
                this.point.copy(this.hit.point);
                this.worldNormal = this.hit.face.normal.clone()
                    .transformDirection(this.hit.object.matrixWorld);
            } else {
                this.hitObject = null;
            }
        } else {
            this.hitObject = null;
        }
        return this.hitObject;
    }

    toggleSelection(obj) {
        if (obj && this.selected.includes(obj)) {
            this.clearSelection(obj);
        } else {
            obj.material.emissive.setRGB(0.0, 0.25, 0.25);
            this.selected.push(obj);
        }
    }

    clearSelection(obj) {
        if (obj && this.selected.includes(obj)) {
            // Clear this object from the selection
            obj.material.emissive.setRGB(0.0, 0.0, 0.0);
            this.selected.splice(this.selected.indexOf(obj), 1);
        } else {
            // If no obj passed in, clear all
            for (let i = 0; i < this.selected.length; i++) {
                this.selected[i].material.emissive.setRGB(0.0, 0.0, 0.0);
            }
            this.selected = [];

            // Both need to be set to make it inactive
            this.updateGizmoVisibility();
        }
    }

    activate() {
        if (this.tools.activeTool) {
            this.tools.activeTool.deactivate();
        }
        this.state = 0;
        this.tools.activeTool = this;
    }

    deactivate() {
        this.state = -1;
        this.tools.activeTool = null;
        this.clearSelection();
        //if (this.currentObject) {
        //    this.currentObject.parent.remove(this.currentObject);
        //}
    }

}

export { DefaultTool };
