import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
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
        this.gizmo.addEventListener('dragging-changed', (event) => {
            this.draggingGizmo = event.value;
            if (this.draggingGizmo) {
                // Record Current Matrix
                this.startPos = this.gizmoTransform.position.clone();
            } else {
                // Get the Delta between Recorded and Current Transformations
                this.deltaPos = this.gizmoTransform.position.clone().sub(this.startPos);

                // Convert the Quaternion to Axis-Angle
                let q = this.gizmoTransform.quaternion;
                this.axis = new THREE.Vector3(
                     q.x / Math.sqrt(1 - q.w * q.w),
                    -q.z / Math.sqrt(1 - q.w * q.w),
                     q.y / Math.sqrt(1 - q.w * q.w));
                this.angle = 2.0 * Math.acos(q.w) * 57.2958;

                // Move the object via that matrix
                this.moveShapeGeometry(this.selected[0],
                    [this.selected[0].shapeName,
                        this.deltaPos.x, this.deltaPos.y, this.deltaPos.z,
                        this.axis.x, this.axis.y, this.axis.z, this.angle,
                        this.gizmoTransform.scale.x]);
            }
        });
        this.gizmoTransform = new THREE.Group();
        this.world.scene.add( this.gizmoTransform );
        this.gizmo.attach( this.gizmoTransform );
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
            // Tool is currently in Selection Mode, trigger on release
            if (ray.active) { this.state = 1; }
        } else if (this.state === 1) {
            this.world.dirty = true;
            // Upon release, check if we tapped
            if (!ray.active) {
                if (!this.draggingGizmo && ray.activeMS < 200) {
                    // Toggle an object's selection state
                    if (this.raycastObject(ray)) {
                        this.toggleSelection(this.hitObject);
                    }
                }
                this.state = 0;
            }
        }

        this.updateGizmoVisibility();

        ray.alreadyActivated = this.draggingGizmo || ray.alreadyActivated;
    }

    /** Ask OpenCascade to Move the Shape on this Mesh
     * @param {THREE.Mesh} originalMesh */
    moveShapeGeometry(originalMesh, moveShapeArgs) {
        let shapeName = "Transformed " + originalMesh.shapeName;
        this.engine.execute(shapeName, this.moveShape, moveShapeArgs,
            (geometry) => {
                originalMesh.position  .set(0, 0, 0);
                originalMesh.scale     .set(1, 1, 1);
                originalMesh.quaternion.set(0, 0, 0, 1);

                if (geometry) {
                    let movedMesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial());
                    movedMesh.material.color.setRGB(0.5, 0.5, 0.5);
                    movedMesh.position  .set(0, 0, 0);
                    movedMesh.scale     .set(1, 1, 1);
                    movedMesh.quaternion.set(0, 0, 0, 1);
                    movedMesh.shapeName = shapeName;

                    this.world.history.addToUndo(movedMesh, originalMesh);
                    this.clearSelection(originalMesh);
                    this.toggleSelection(movedMesh);
                }
                this.world.dirty = true;
            });
    }

    /** Create a moved shape in OpenCascade; to be executed on the Worker Thread */
    moveShape(shapeToMove, x, y, z, xDir, yDir, zDir, degrees, scale) {
        let transformation = new this.oc.gp_Trsf();
        transformation.SetTranslation(new this.oc.gp_Vec(x, y, z));
        //transformation.SetRotation(
        //    new this.oc.gp_Ax1(new this.oc.gp_Pnt(0, 0, 0), new this.oc.gp_Dir(
        //        new this.oc.gp_Vec(xDir, yDir, zDir))), degrees * 0.0174533);
        //transformation.SetScaleFactor(scale);
        return new this.oc.TopoDS_Shape(this.shapes[shapeToMove].Moved(
            new this.oc.TopLoc_Location(transformation)));
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

    positionTransformGizmo() {
        this.selectionBoundingBox = new THREE.Box3();
        for (let i = 0; i < this.selected.length; i++){
            if (i == 0) {
                this.selectionBoundingBox.setFromObject(this.selected[i]);
            } else {
                this.selectionBoundingBox.expandByObject(this.selected[i]);
            }
        }
        this.selectionBoundingBox.getCenter(this.gizmoTransform.position);
        this.gizmoTransform.quaternion.set(0.0, 0.0, 0.0, 1.0);
        this.gizmoTransform.scale.set(1.0, 1.0, 1.0);
    }

    raycastObject(ray) {
        this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
        let intersects = this.world.raycaster.intersectObject(this.world.history.shapeObjects, true);//
        if (intersects.length > 0) {
            this.hit = intersects[0];
            // Shoot through the floor if necessary
            for (let i = 0; i < intersects.length; i++) {
                if (intersects[i].object.name.includes("#")) {
                    this.hit = intersects[i]; break;
                }
            }

            // Record the hit object and plane...
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
        this.positionTransformGizmo();
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
        this.positionTransformGizmo();
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
