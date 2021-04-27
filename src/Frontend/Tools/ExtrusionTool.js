/**
 * Copyright 2021 Ultraleap, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';

/** This class controls all of the ExtrusionTool behavior */
class ExtrusionTool {

    /** Create the ExtrusionTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;
        this.oc = oc; this.shapes = {};

        this.state = -1; // -1 is Deactivated
        this.numExtrusions = 0;
        this.distance = 0.001;
        this.height = 0.001;
        this.point = new THREE.Vector3();
        this.worldCameraScale = new THREE.Vector3();
        this.rayPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000, 1000),
                                       this.world.basicMaterial);
        this.extrusionMesh = null;

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ((typeof ESBUILD !== 'undefined') ? './textures/Extrusion.png' : '../../../textures/Extrusion.png');
        this.descriptor = {
            name: "Extrusion Tool",
            icon: this.icon
        }

        // All Extrusion handles are children of this
        this.handleParent = new THREE.Group();
        this.world.scene.add(this.handleParent);

        // Create a pool of extrusion handles which can be assigned to faces in the scene
        this.handles = [];
    }

    /** Spawn Extrusion Handles on each flat face */
    activate() {
        if (this.tools.activeTool) { this.tools.activeTool.deactivate(); }
        this.state = 0;
        this.tools.activeTool = this;

        // Place Extrusion Handles
        this.world.camera.getWorldScale(this.worldCameraScale);
        let curArrow = 0;
        for (let i = 0; i < this.world.history.shapeObjects.children.length; i++) {
            for (let j = 0; j < this.world.history.shapeObjects.children[i].faceMetadata.length; j++) {
                let faceData = this.world.history.shapeObjects.children[i].faceMetadata[j];

                if (curArrow >= this.handles.length) {
                    let dir = new THREE.Vector3( 1, 2, 0 ).normalize();
                    let origin = new THREE.Vector3( 0, 0, 0 );
                    this.handles.push(new THREE.ArrowHelper( dir, origin, 0.030, 0x00ffff ));
                }

                if (faceData.is_planar && curArrow < this.handles.length) {
                    this.handles[curArrow].position.set(faceData.average[0], faceData.average[1], faceData.average[2]);
                    let normal = new THREE.Vector3(faceData.normal[0], faceData.normal[1], faceData.normal[2]);
                    this.handles[curArrow].setDirection(normal);
                    this.handles[curArrow].setLength(
                        0.03 * this.worldCameraScale.x,
                        0.01 * this.worldCameraScale.x,
                        0.01 * this.worldCameraScale.x);
                    this.handles[curArrow].faceIndex = faceData.index;
                    this.handles[curArrow].parentObject = this.world.history.shapeObjects.children[i];
                    this.handles[curArrow].extrusionDirection = normal;

                    this.handleParent.add(this.handles[curArrow++]);
                }
            }
        }
    }

    deactivate() {
        this.state = -1;
        this.tools.activeTool = null;
        if (this.currentExtrusion && this.currentExtrusion.parent) {
            this.currentExtrusion.parent.remove(this.currentExtrusion);
        }
        for (let i = 0; i < this.handles.length; i++) {
            this.handleParent.remove(this.handles[i]);
        }
    }

    /** Update the ExtrusionTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) {
        if (ray.alreadyActivated || this.state === -1) {
            return; // Tool is currently deactivated
        } else if(this.state === 0) {
            // Wait for the ray to be active and pointing at a drawable surface
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObject(this.handleParent, true);

            if (intersects.length > 0) {
                if (ray.justActivated && ray.active) {
                    // TODO: Check if this face is in the metadata for Extrusion
                    // if(intersects[0].object.shapeName){}

                    this.hit = intersects[0].object.parent;
                    this.point.copy(this.hit.position);
                    this.state += 1;
                }
                ray.alreadyActivated = true;
            }
        } else if(this.state === 1) {
            // Resize the Height while dragging
            let upperSegment = this.hit.extrusionDirection.clone().multiplyScalar( 1000.0).add(this.point);
            let lowerSegment = this.hit.extrusionDirection.clone().multiplyScalar(-1000.0).add(this.point);
            let pointOnRay = new THREE.Vector3(), pointOnSegment = new THREE.Vector3();
            let sqrDistToSeg = ray.ray.distanceSqToSegment(lowerSegment, upperSegment, pointOnRay, pointOnSegment);
            //this.height = pointOnSegment.sub(this.hit.position).dot(this.hit.extrusionDirection);
            this.snappedHeight = pointOnSegment.sub(this.point).dot(this.hit.extrusionDirection);
            this.snappedHeight = this.tools.grid.snapToGrid1D(this.snappedHeight);
            this.tools.cursor.updateLabelNumbers(this.snappedHeight);
            this.height = (!ray.active) ? this.snappedHeight : (this.height * 0.75) + (this.snappedHeight * 0.25);

            this.tools.cursor.updateTarget(this.hit.extrusionDirection.clone().multiplyScalar(this.height).add(this.point));

            if (!this.currentExtrusion) {
                this.createPreviewExtrusionGeometry(this.point,
                    [this.hit.extrusionDirection.x, this.hit.extrusionDirection.y, this.hit.extrusionDirection.z,
                        1, this.hit.faceIndex, this.hit.parentObject.shapeName, false]);
            } else if (this.currentExtrusion !== "Waiting...") {
                this.currentExtrusion.scale.y = this.height;
                this.currentExtrusion.children[0].material.emissive.setRGB(
                    this.height > 0 ? 0.0  : 0.25,
                    this.height > 0 ? 0.25 : 0.0 , 0.0);
            }
            ray.alreadyActivated = true;

            // When let go, deactivate and add to Undo!
            if (!ray.active) {
                this.createExtrusionGeometry(this.currentExtrusion,
                    [this.hit.extrusionDirection.x, this.hit.extrusionDirection.y, this.hit.extrusionDirection.z,
                        this.height, this.hit.faceIndex, this.hit.parentObject.shapeName, true]);

                this.numExtrusions += 1;
                this.currentExtrusion = null;
                this.deactivate();
            }
        }
    }

    /** @param {THREE.Mesh} extrusionMesh */
    createExtrusionGeometry(extrusionMesh, createExtrusionArgs) {
        let shapeName = "Extrusion #" + this.numExtrusions;
        this.engine.execute(shapeName, this.createExtrusion, createExtrusionArgs,
            (mesh) => {
                if (mesh) {
                    mesh.name = extrusionMesh.name;
                    mesh.shapeName = shapeName;
                    if (this.hit.parentObject.shapeName) {
                        this.world.history.addToUndo(mesh, this.hit.parentObject, "Extrusion");
                        this.hitObject = null;
                    } else {
                        this.world.history.addToUndo(mesh, null, "Extrusion");
                    }
                }

                extrusionMesh.parent.remove(extrusionMesh);
                this.world.dirty = true;
            });
    }

    /** @param {THREE.Vector3} extrusionPivot */
    createPreviewExtrusionGeometry(extrusionPivot, createExtrusionArgs) {
        let shapeName = "Extrusion #" + this.numExtrusions;
        this.currentExtrusion = "Waiting...";
        this.engine.execute(shapeName, this.createExtrusion, createExtrusionArgs,
            (mesh) => {
                if (this.currentExtrusion && this.currentExtrusion.parent) {
                    this.currentExtrusion.parent.remove(this.currentExtrusion);
                }

                if (mesh) {
                    mesh.shapeName = shapeName;
                    mesh.material = this.world.previewMaterial;

                    this.currentExtrusion = new THREE.Group();
                    this.currentExtrusion.position.copy(extrusionPivot);
                    this.currentExtrusion.quaternion.copy(new THREE.Quaternion()
                        .setFromUnitVectors(new THREE.Vector3(0, 1, 0),
                            new THREE.Vector3(createExtrusionArgs[0], createExtrusionArgs[1], createExtrusionArgs[2])));
                    //this.currentExtrusion.scale.y = 0.00001;
                    this.currentExtrusion.attach(mesh);
                    this.world.scene.add(this.currentExtrusion);
                }
                this.world.dirty = true;
            });
    }

    /** Create a Extrusion in OpenCascade; to be executed on the Worker Thread */
    createExtrusion(nx, ny, nz, height, faceIndex, hitObjectName, csg) {
        if (height != 0) {
            let hitObject = this.shapes[hitObjectName];

            // Change the Extrusion Extension direction based on the height
            nx *= height; ny *= height; nz *= height;

            // Get a reference to the face to extrude
            let face = null; let face_index = 0;
            let anExplorer = new this.oc.TopExp_Explorer(hitObject, this.oc.TopAbs_FACE);
            for (anExplorer.Init(hitObject, this.oc.TopAbs_FACE); anExplorer.More(); anExplorer.Next()) {
                if (face_index === faceIndex) {
                    face = this.oc.TopoDS.prototype.Face(anExplorer.Current());
                    break;
                } else {
                    face_index += 1;
                }
            }

            if (face) {
                // Construct the Extrusion Shape
                let shape = new this.oc.BRepPrimAPI_MakePrism(face,
                    new this.oc.gp_Vec(nx, ny, nz), true, true).Shape();
                
                if (!csg) { return shape; } // Return the Raw Shape

                // Let's CSG this Extrusion onto/into the object it came from
                if (height > 0) {
                    // The Height is Positive, let's Union
                    let unionOp = new this.oc.BRepAlgoAPI_Fuse(hitObject, shape);
                    unionOp.SetFuzzyValue(0.00001);
                    unionOp.Build();
                    return unionOp.Shape();
                    //let unionOp = new this.oc.BRepBuilderAPI_Sewing(0.00001);
                    //unionOp.Add(hitObject);
                    //unionOp.Add(shape);
                    //unionOp.Perform();
                    //return unionOp.SewedShape();
                } else if (height < 0) {
                    // The Height is Negative, let's Subtract
                    let differenceOp = new this.oc.BRepAlgoAPI_Cut(hitObject, shape);
                    differenceOp.SetFuzzyValue(0.00001);
                    differenceOp.Build();
                    return differenceOp.Shape();
                }
            }
        }
    }

    /** Whether or not to show this tool in the menu 
     * Only Show when no objects are selected */
    shouldShow() { return this.tools.tools[0].selected.length == 0; }
}

export { ExtrusionTool };
