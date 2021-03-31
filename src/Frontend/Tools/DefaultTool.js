import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';
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
                                       this.world.basicMaterial);
        this.vec = new THREE.Vector3(), this.quat1 = new THREE.Quaternion(), this.quat2 = new THREE.Quaternion();
        this.xQuat = new THREE.Quaternion(), this.yQuat = new THREE.Quaternion();
        this.startPos = new THREE.Vector3();

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ('../../../textures/Cursor.png' );
        this.descriptor = {
            name: "Default Tool",
            icon: this.icon
        }

        // Initialize Transform Gizmo (which allows for the movement of objects around the scene)
        this.gizmo = new TransformControls(this.world.camera, this.world.container);
        this.gizmo.addEventListener('dragging-changed', (event) => {
            this.draggingGizmo = event.value;
            if (this.draggingGizmo) {
                // Record Current Matrix
                this.startPos.copy(this.gizmoTransform.position);
            } else {
                // Convert the Quaternion to Axis-Angle
                let q = this.gizmoTransform.quaternion;
                this.axis = new THREE.Vector3(
                     q.x / Math.sqrt(1 - q.w * q.w),
                     q.y / Math.sqrt(1 - q.w * q.w),
                     q.z / Math.sqrt(1 - q.w * q.w));
                this.angle = 2.0 * Math.acos(q.w) * 57.2958;

                // Compensate position for rotation
                let rotDis = this.startPos.clone().applyQuaternion(q).sub(this.startPos);

                // Get the Delta between Recorded and Current Transformations
                this.deltaPos = this.gizmoTransform.position.clone().sub(this.startPos).sub(rotDis);

                // Move the object via that matrix
                for (let i = 0; i < this.selected.length; i++) {
                    this.moveShapeGeometry(this.selected[i],
                        [this.selected[i].shapeName,
                            this.deltaPos.x, this.deltaPos.y, this.deltaPos.z,
                            this.axis.x, this.axis.y, this.axis.z, this.angle,
                            this.gizmoTransform.scale.x]);
                }
            }
        });
        this.gizmoTransform = new THREE.Group();
        this.world.scene.add( this.gizmoTransform );
        this.gizmo.attach( this.gizmoTransform );
        this.draggingGizmo = false;
        this.gizmo.visible = false;
        this.gizmo.enabled = this.gizmo.visible;

        // Add Keyboard shortcuts for switching between modes
        window.addEventListener( 'keydown', ( event ) => {
            switch ( event.key ) {
                case "w": this.gizmo.setMode( "translate" ); break;
                case "e": this.gizmo.setMode( "rotate"    ); break;
                case "r": this.gizmo.setMode( "scale"     ); break;
            }
        } );
    }

    /** Update the DefaultTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) {
        if (ray.alreadyActivated || this.state === -1) {
            return; // Tool is currently deactivated
        } else if (this.state === 0) {
            // Tool is currently in Selection Mode
            if (ray.active) {
                this.state = 1;
            }
        } else if (this.state === 1) {
            this.world.dirty = true;
            if (this.draggingGizmo) {
                for (let i = 0; i < this.selected.length; i++) {
                    let rotDis = this.startPos.clone().applyQuaternion(this.gizmoTransform.quaternion).sub(this.startPos);
                    this.selected[i].position.copy(this.gizmoTransform.position.clone().sub(this.startPos).sub(rotDis));
                    this.selected[i].quaternion.copy(this.gizmoTransform.quaternion);
                    this.selected[i].scale.copy(this.gizmoTransform.scale);
                }
            }

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
            (mesh) => {
                originalMesh.position  .set(0, 0, 0);
                originalMesh.scale     .set(1, 1, 1);
                originalMesh.quaternion.set(0, 0, 0, 1);

                if (mesh) {
                    mesh.shapeName = shapeName;
                    mesh.name = originalMesh.name;
                    this.world.history.addToUndo(mesh, originalMesh);
                    this.clearSelection(originalMesh);
                    this.toggleSelection(mesh);
                }
                this.world.dirty = true;
            });
    }

    /** Create a moved shape in OpenCascade; to be executed on the Worker Thread */
    moveShape(shapeToMove, x, y, z, xDir, yDir, zDir, degrees, scale) {
        // Use three transforms until SetValues comes in...
        let translation = new this.oc.gp_Trsf(),
            rotation = new this.oc.gp_Trsf(),
            scaling = new this.oc.gp_Trsf();
        
        // Set Transformations
        translation.SetTranslation(new this.oc.gp_Vec(x, y, z));

        if (degrees !== 0) {
             rotation.SetRotation(
                new this.oc.gp_Ax1(new this.oc.gp_Pnt(0, 0, 0), new this.oc.gp_Dir(
                    new this.oc.gp_Vec(xDir, yDir, zDir))), degrees * 0.0174533);
        }
        if (scale !== 1) { scaling.SetScaleFactor(scale); }

        // Multiply together
        scaling.Multiply(rotation); translation.Multiply(scaling);

        return new this.oc.TopoDS_Shape(this.shapes[shapeToMove].Moved(
            new this.oc.TopLoc_Location(translation)));
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
            obj.material = this.world.selectedMaterial;
            this.selected.push(obj);
        }
        this.positionTransformGizmo();
    }

    clearSelection(obj) {
        if (obj && this.selected.includes(obj)) {
            // Clear this object from the selection
            obj.material = this.world.shapeMaterial;
            this.selected.splice(this.selected.indexOf(obj), 1);
        } else {
            // If no obj passed in, clear all
            for (let i = 0; i < this.selected.length; i++) {
                this.selected[i].material = this.world.shapeMaterial;
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
