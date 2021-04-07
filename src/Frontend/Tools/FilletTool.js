import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';

/** This class controls all of the FilletTool behavior */
class FilletTool {

    /** Create the FilletTool
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
        this.vec = new THREE.Vector3(), this.quat1 = new THREE.Quaternion(), this.quat2 = new THREE.Quaternion();
        this.xQuat = new THREE.Quaternion(), this.yQuat = new THREE.Quaternion();
        this.startPos = new THREE.Vector3();
        this.dragging = false;
        this.cameraRelativeMovement = new THREE.Vector3();
        this.rayPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000, 1000),
                                       new THREE.MeshBasicMaterial());

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ((typeof ESBUILD !== 'undefined') ? './textures/Fillet.png' : '../../../textures/Fillet.png');
        this.descriptor = {
            name: "Fillet Tool",
            icon: this.icon
        }
    }

    /** Update the FilletTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) {
        if (ray.alreadyActivated || this.state === -1) {
            return; // Tool is currently deactivated
        } else if (this.state === 0) {
            // Tool is currently in Selection Mode
            if (ray.justActivated) {
                // Check to see if we began dragging on an already selected edge
                if (this.raycastObject(ray, true)) {
                    // Create a plane at the origin to look at us
                    this.rayPlane.position.copy(this.point);
                    this.rayPlane.lookAt(this.world.camera.position);
                    this.rayPlane.updateMatrixWorld(true);

                    this.dragging = true;
                    ray.alreadyActivated = true;
                } else {
                    this.dragging = false;
                }

                this.state = 1;
            }
        } else if (this.state === 1) {
            this.world.dirty = true;

            // While dragging, adjust the fillet radius
            if (this.dragging) {
                this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
                let intersects = this.world.raycaster.intersectObject(this.rayPlane);
                if (intersects.length > 0) {
                    // Get camera-space position to determine fillet or chamfer radius
                    this.cameraRelativeMovement.copy(intersects[0].point.clone().sub(this.point));
                    this.cameraRelativeMovement.transformDirection(this.world.camera.matrixWorld.invert());

                    // Calculate the radius...
                    this.distance = intersects[0].point.clone().sub(this.point).length();
                    this.distance = this.tools.grid.snapToGrid1D(this.distance);
                    this.distance *= Math.sign(this.cameraRelativeMovement.x);
                    this.tools.cursor.updateTarget(this.point);
                    this.tools.cursor.updateLabelNumbers(this.distance);
                }

                ray.alreadyActivated = true;
            }

            // Upon release
            if (!ray.active) {
                if (this.dragging && ray.activeMS > 200) {
                    // Commit the new fillet radius
                    console.log("COMMIT: ", this.selected, this.distance);
                    this.clearSelection();
                // Else, check if we tapped to toggle an edge selection
                }else if (ray.activeMS < 200
                    && !this.tools.engine.workerWorking) { // This last one prevents selecting parts in progress
                    // Toggle an object's selection state
                    if (this.raycastObject(ray, false)) {
                        this.toggleEdgeSelection(this.hitVertexIndex, this.hitEdges, this.hitObject);
                    }
                }
                this.state = 0;
                this.dragging = false;
            }
        }
    }

    /*// Ask OpenCascade to Move the Shape on this Mesh
    //@param {THREE.Mesh} originalMesh 
    filletShapeGeometry(originalMesh, filletShapeArgs) {
        let shapeName = "Filleted " + originalMesh.shapeName;
        this.engine.execute(shapeName, this.filletShape, filletShapeArgs,
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

    // Create a moved shape in OpenCascade; to be executed on the Worker Thread 
    filletShape(shapeToMove, x, y, z, xDir, yDir, zDir, degrees, scale) {
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
    }*/

    raycastObject(ray, checkSelected) {
        this.world.raycaster.layers.set(2); // 2 is reserved for edges
        this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
        let intersects = this.world.raycaster.intersectObject(this.world.history.shapeObjects, true);//
        this.world.raycaster.layers.set(0); // 0 is for shapes and menus

        if (intersects.length > 0) {
            this.hit = intersects[0];

            // Record the hit object and plane...
            if (this.hit.object.parent != this.hitObject) { this.clearSelection(); }
            this.hitObject = this.hit.object.parent;
            this.hitEdges = this.hit.object;

            this.point.copy(this.hit.point);
            this.hitVertexIndex = this.hit.index;

            let edgeIndex = this.hitEdges.globalEdgeIndices[this.hitVertexIndex];
            let range = this.hitEdges.globalEdgeMetadata[edgeIndex];
            let alreadySelected = this.selected.includes(range)
            return !checkSelected || alreadySelected;
        }
        return false;
    }

    /** @param {THREE.LineSegments} edges */
    toggleEdgeSelection(vertexIndex, edges, obj) {
        let edgeIndex = edges.globalEdgeIndices[vertexIndex];
        let range = edges.globalEdgeMetadata[edgeIndex];

        let colorArray = edges.geometry.getAttribute("color");
        if (obj && this.selected.includes(range)) {
            for (let i = range.start; i <= range.end; i++){
                colorArray.setXYZ(i, 0, 0, 0);
            }
            this.selected.splice(this.selected.indexOf(range), 1);
        } else {
            for (let i = range.start; i <= range.end; i++){
                colorArray.setXYZ(i, 0, 1, 1);
            }
            this.selected.push(range);
        }
        colorArray.needsUpdate = true;
    }

    clearSelection() {
        if (!this.hitEdges) { return; }
        let colorArray = this.hitEdges.geometry.getAttribute("color");
        for (let i = 0; i < this.selected.length; i++) {
            for (let j = this.selected[i].start; j <= this.selected[i].end; j++){
                colorArray.setXYZ(j, 0, 0, 0);
            }
        }
        this.selected = [];
        colorArray.needsUpdate = true;
    }

    activate() {
        if (this.tools.activeTool) {
            this.tools.activeTool.deactivate();
        }
        this.state = 0;
        this.tools.activeTool = this;
        this.clearSelection();
    }

    deactivate() {
        this.state = -1;
        this.tools.activeTool = null;
        this.clearSelection();
    }

}

export { FilletTool };
