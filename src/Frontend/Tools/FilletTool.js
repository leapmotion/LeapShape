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
        this.didHitEdge = false;
        this.tapThreshold = 300; // Touches below this threshold (in ms) are considered taps

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
            this.didHitEdge = false;
            // Tool is currently in Selection Mode
            if (ray.justActivated) {
                let alreadySelected = this.raycastObject(ray, true);

                if (this.raycastObject(ray)) {
                    // Create a plane at the origin for dragging
                    this.rayPlane.position.copy(this.point);
                    this.rayPlane.lookAt(this.world.camera.getWorldPosition(this.vec));
                    this.rayPlane.updateMatrixWorld(true);

                    // Check to see if we began dragging on an already selected edge
                    if (alreadySelected) {
                        this.dragging = true;
                        ray.alreadyActivated = true;
                    } else {
                        this.didHitEdge = true;
                    }
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
                    this.cameraRelativeMovement.applyQuaternion(this.world.camera.getWorldQuaternion(this.quat1).invert());

                    this.distance = this.cameraRelativeMovement.x;
                    this.distance = this.tools.grid.snapToGrid1D(this.distance, this.tools.grid.gridPitch/10);
                    this.tools.cursor.updateTarget(this.point);
                    this.tools.cursor.updateLabel(this.distance === 0 ? "Left-Chamfer\nRight-Fillet" :
                        (this.distance > 0 ?
                        Number(this.distance.toFixed(2)) + " - Fillet" :
                        Number(Math.abs(this.distance).toFixed(2)) + " - Chamfer"));
                }

                ray.alreadyActivated = true;
            } else if (ray.active && this.didHitEdge && ray.activeMS > this.tapThreshold) {
                // If we're dragging for a while, and we hit an edge... select the edge we hit and adjust it
                this.toggleEdgeSelection(this.hitVertexIndex, this.hitEdges, this.hitObject);
                this.dragging = true;
                ray.alreadyActivated = true;
            } else if (ray.active && this.didHitEdge && ray.activeMS < this.tapThreshold) {
                ray.alreadyActivated = true;
            }

            // Upon release
            if (!ray.active) {
                if (this.dragging && ray.activeMS > this.tapThreshold) {
                    // Commit the new fillet radius
                    this.filletShapeGeometry(this.hitObject,
                        [this.hitObject.shapeName, this.distance,
                            this.selected.map((range) => range.localEdgeIndex)]);
                    this.deactivate();
                // Else, check if we tapped to toggle an edge selection
                } else if (ray.activeMS < this.tapThreshold) { 
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

    /** Ask OpenCascade to Fillet Edges on this shape
     * @param {THREE.Mesh} originalMesh */
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
                }
                this.world.dirty = true;
            });
    }

    /** Create fillets on edges in a shape in OpenCascade; 
     * to be executed on the Worker Thread */
    filletShape(shapeToFillet, radius, edges) {
        if (radius === 0) { console.error("Invalid Fillet Radius!");  return null; }
        let shape = this.shapes[shapeToFillet];
        let mkFillet = radius > 0 ? new this.oc.BRepFilletAPI_MakeFillet(shape) : new this.oc.BRepFilletAPI_MakeChamfer(shape);

        // Iterate through the edges of the shape and add them to the Fillet as they come
        let foundEdges = 0, edge_index = 0, edgeHashes = {};
        if (!this.edgeExplorer) { this.edgeExplorer = new this.oc.TopExp_Explorer(shape, this.oc.TopAbs_EDGE); }
        for (this.edgeExplorer.Init(shape, this.oc.TopAbs_EDGE); this.edgeExplorer.More(); this.edgeExplorer.Next()) {
            let edge = this.oc.TopoDS.prototype.Edge(this.edgeExplorer.Current());

            // Edge explorer visits every edge twice; 
            // hash them to ensure visiting only once
            // This matches the indexing of the function
            // in OpenCascadeMesher
            let edgeHash = edge.HashCode(100000000);
            if(!edgeHashes.hasOwnProperty(edgeHash)){
              edgeHashes[edgeHash] = edge_index;
              if (edges.includes(edge_index)) {
                  mkFillet.Add(Math.abs(radius),edge);
                  foundEdges++;
                }
                edge_index++;
            }
        }
        if (foundEdges == 0) { console.error("Fillet Edges Not Found!");  return null; }
        return new this.oc.TopoDS_Solid(mkFillet.Shape());
    }

    raycastObject(ray, checkSelected) {
        // This last one prevents selecting parts in progress
        if (this.tools.engine.workerWorking) { return false; }

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
