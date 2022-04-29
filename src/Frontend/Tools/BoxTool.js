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
import * as oc from  '../../../node_modules/opencascade.js/dist/opencascade.full.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';
import { Grid } from './General/Grid.js';
import { Cursor } from './General/Cursor.js';

/** This class controls all of the BoxTool behavior */
class BoxTool {

    /** Create the BoxTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;
        this.oc = oc; this.shapes = {};

        this.state    = -1; // -1 is Deactivated
        this.numBoxs  =  0;
        this.distance =  1;
        this.point = new THREE.Vector3();
        this.snappedPoint = new THREE.Vector3();
        this.tangentAxis = new THREE.Vector3(); 
        this.rayPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000, 1000),
                                       this.world.basicMaterial);
        this.vec = new THREE.Vector3(), this.quat1 = new THREE.Quaternion(), this.quat2 = new THREE.Quaternion();
        this.xQuat = new THREE.Quaternion(), this.yQuat = new THREE.Quaternion();
        this.arrow = new THREE.ArrowHelper(
            new THREE.Vector3(1, 2, 0).normalize(), new THREE.Vector3(0, 0, 0), 0.03, 0x00ffff);

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ((typeof ESBUILD !== 'undefined') ? './textures/Box.png' : '../../../textures/Box.png');
        this.descriptor = {
            name: "Box Tool",
            icon: this.icon
        }
    }

    /** Update the BoxTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) {
        if (ray.hovering || this.state === -1) {
            return; // Tool is currently deactivated
        } else if(this.state === 0) {
            // Wait for the ray to be active and pointing at a drawable surface
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObjects([this.world.mesh, this.world.history.shapeObjects], true);

            if (intersects.length > 0 && !ray.justDeactivated &&
                (intersects[0].object.shapeName || intersects[0].object.isGround)) {

                this.hit = intersects[0];
                // Shoot through the floor if necessary
                for (let i = 0; i < intersects.length; i++){
                    if (intersects[i].object.shapeName) {
                        this.hit = intersects[i]; break;
                    }
                }

                // Update the grid origin
                this.tools.grid.setVisible(true);
                this.tools.grid.updateWithHit(this.hit);
                this.tools.grid.snapToGrid(this.snappedPoint.copy(this.hit.point));
                this.tools.cursor.updateTarget(this.snappedPoint);
                let relativeSnapped = this.tools.grid.space.worldToLocal(this.snappedPoint.clone());
                this.tools.cursor.updateLabelNumbers(Math.abs(relativeSnapped.x), Math.abs(relativeSnapped.z));

                if (ray.active && this.tools.grid.updateCount > 1) { // iPhones need more than one frame
                    // Record the hit object and plane...
                    this.hitObject = this.hit.object;
                    this.point.copy(this.snappedPoint);
                    this.worldNormal = this.tools.grid.normal.clone(); // Analytic CAD Normal
                    this.threeWorldNormal = this.hit.face.normal.clone()
                        .transformDirection(this.hit.object.matrixWorld); // Triangle Normal
                    if (this.worldNormal.dot(this.threeWorldNormal) < 0) {
                        // Sometimes the CAD Normal is the wrong way around; flip if so
                        // TODO: Figure out why!!
                        this.worldNormal.multiplyScalar(-1.0);
                    }

                    // Position an Invisible Plane to Raycast against for resizing operations
                    this.rayPlane.position.copy(this.point);
                    this.rayPlane.lookAt(this.worldNormal.clone().add(this.rayPlane.position));
                    this.rayPlane.updateMatrixWorld(true);

                    // Spawn the Box
                    this.currentBox = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), this.world.noDepthPreviewMaterial);
                    this.currentBox.material.color.setRGB(0.5, 0.5, 0.5);
                    this.currentBox.material.emissive.setRGB(0, 0.25, 0.25);
                    this.currentBox.name = "Box #" + this.numBoxs;
                    this.currentBox.scale.set(0.000001, 0.000001, 0.000001);
                    this.currentBox.position.copy(this.worldNormal.clone()
                        .multiplyScalar(0.5).add(this.point));
                    this.currentBox.frustumCulled = false;
                    this.world.scene.add(this.currentBox);

                    this.state += 1;
                }
                ray.hovering = true;
            }
        } else if(this.state === 1) {
            // While holding, resize the Box
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObject(this.rayPlane);
            if (intersects.length > 0) {
                // Snap to grid and lerp cursor
                this.tools.grid.snapToGrid(this.snappedPoint.copy(intersects[0].point));
                this.tools.cursor.updateTarget(this.snappedPoint);
                if (!ray.active) { this.tools.cursor.cursor.position.copy(this.snappedPoint); } // Force Cursor to Snap upon letting go

                let relative = intersects[0].object.worldToLocal(this.tools.cursor.cursor.position.clone());
                this.width = relative.x; this.length = relative.y;

                let relativeSnapped = intersects[0].object.worldToLocal(this.snappedPoint.clone());
                this.tools.cursor.updateLabelNumbers(Math.abs(relativeSnapped.x), Math.abs(relativeSnapped.y));

                this.height     = 0.001;
                this.widthAxis  = new THREE.Vector3(1, 0, 0).transformDirection(this.rayPlane.matrixWorld).multiplyScalar(Math.sign(this. width));
                this.lengthAxis = new THREE.Vector3(0, 1, 0).transformDirection(this.rayPlane.matrixWorld).multiplyScalar(Math.sign(this.length));
                this.heightAxis = new THREE.Vector3(0, 0, 1).transformDirection(this.rayPlane.matrixWorld).multiplyScalar(Math.sign(this.height));

                this.alignXandYUnitVectors(this.currentBox.quaternion, this.widthAxis, this.lengthAxis);
                this.currentBox.scale.x = Math.abs(this.width );
                this.currentBox.scale.y = Math.abs(this.height);
                this.currentBox.scale.z = Math.abs(this.length);

                this.currentBox.position.copy(this.point);
                this.currentBox.position.add (this.widthAxis .clone().multiplyScalar(Math.abs(this.width ) / 2.0));
                this.currentBox.position.add (this.heightAxis.clone().multiplyScalar(Math.abs(this.height) / 2.0));
                this.currentBox.position.add (this.lengthAxis.clone().multiplyScalar(Math.abs(this.length) / 2.0));
            }
            ray.hovering = true;

            // When let go, advance to waiting for the next drag
            if (!ray.active) {
                this.state += 1;

                // Add Arrow Preview
                this.tools.grid.setVisible(false);
                this.arrow.position.copy(this.currentBox.position);
                this.arrow.setDirection(this.worldNormal);
                this.arrow.setLength( 0.02, 0.013, 0.01 );
                this.world.scene.add(this.arrow);
            }
        } else if (this.state === 2) {
            // When dragging begins again, advance to the next state
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObjects([this.currentBox, this.arrow], true);
            if (intersects.length > 0) {
                if (ray.justActivated) {
                    this.world.scene.remove(this.arrow);
                    this.currentBox.material = this.world.previewMaterial;
                    this.state += 1;
                }
                ray.hovering = true;
            }
        } else if(this.state === 3) {
            // Resize the Height while dragging
            let upperSegment = this.worldNormal.clone().multiplyScalar( 1000.0).add(this.point);
            let lowerSegment = this.worldNormal.clone().multiplyScalar(-1000.0).add(this.point);
            ray.ray.distanceSqToSegment(lowerSegment, upperSegment, null, this.vec);
            this.snappedHeight = this.vec.sub(this.point).dot(this.worldNormal);
            this.snappedHeight = this.tools.grid.snapToGrid1D(this.snappedHeight);
            this.tools.cursor.updateLabelNumbers(this.snappedHeight);
            this.height = (!ray.active) ? this.snappedHeight : (this.height * 0.75) + (this.snappedHeight * 0.25);

            this.tools.cursor.updateTarget(this.worldNormal.clone().multiplyScalar(this.height).add(this.point));

            this.heightAxis = new THREE.Vector3(0, 0, 1)
                .transformDirection(this.rayPlane.matrixWorld).multiplyScalar(Math.sign(this.height));

            this.currentBox.scale.x = Math.abs(this.width );
            this.currentBox.scale.y = Math.abs(this.height);
            this.currentBox.scale.z = Math.abs(this.length);

            this.currentBox.position.copy(this.point);
            this.currentBox.position.add (this.widthAxis .clone().multiplyScalar(Math.abs(this.width ) / 2.0));
            this.currentBox.position.add (this.heightAxis.clone().multiplyScalar(Math.abs(this.height) / 2.0));
            this.currentBox.position.add (this.lengthAxis.clone().multiplyScalar(Math.abs(this.length) / 2.0));

            this.currentBox.material.emissive.setRGB(
                this.height > 0 ? 0.0  : 0.25,
                this.height > 0 ? 0.25 : 0.0, 0.0);

            ray.hovering = true;

            // When let go, deactivate and add to Undo!
            if (!ray.active) {
                // This fangles the coordinate space so the box is always drawn in the (+,+,+) Octant
                let sameSign = Math.sign(this.width) != Math.sign(this.length);
                this.flip = this.height > 0 ? !sameSign : sameSign;
                this.tangentAxis.copy(this.flip ? this.widthAxis : this.lengthAxis);

                this.createBoxGeometry(this.currentBox,
                    [this.point.x, this.point.y, this.point.z,
                        this.heightAxis.x, this.heightAxis.y, this.heightAxis.z,
                        this.tangentAxis.x, this.tangentAxis.y, this.tangentAxis.z,
                        this.flip?this.length:this.width, this.height, this.flip?this.width:this.length, this.hitObject.shapeName]);

                this.numBoxs += 1;
                this.currentBox = null;
                this.deactivate();
            }
        }
    }

    /** @param {THREE.Mesh} boxMesh */
    createBoxGeometry(boxMesh, createBoxArgs) {
        // Early Exit if the Box is Trivially Invalid
        if (createBoxArgs[9] * createBoxArgs[10] * createBoxArgs[11] === 0.0) {
            this.tools.alerts.displayError("Zero Volume Box is Invalid!");
            boxMesh.parent.remove(boxMesh);
            this.world.dirty = true;
            return;
        }

        let shapeName = "Box #" + this.numBoxs;
        this.engine.execute(shapeName, this.createBox, createBoxArgs,
            (mesh) => {
                if (mesh) {
                    mesh.name = boxMesh.name;
                    mesh.shapeName = shapeName;
                    if (this.hitObject.shapeName) {
                        this.world.history.addToUndo(mesh, this.hitObject, "Box Extrusion");
                        this.hitObject = null;
                    } else {
                        this.world.history.addToUndo(mesh, null, "Box");
                    }
                }

                boxMesh.parent.remove(boxMesh);
                this.world.dirty = true;
            });
    }

    /** Create a Box in OpenCascade; to be executed on the Worker Thread */
    createBox(x, y, z, nx, ny, nz, vx, vy, vz, width, height, length, hitObjectName) {
        if (width != 0 && height != 0 && length != 0) {
            let hitAnObject = hitObjectName in this.shapes;

            // Construct the Box Shape
            let boxPlane = new this.oc.gp_Ax2_2(new this.oc.gp_Pnt_3(x, y, z), new this.oc.gp_Dir_4(nx, ny, nz), new this.oc.gp_Dir_4(vx, vy, vz));
            let shape = new this.oc.BRepPrimAPI_MakeBox_5(boxPlane, Math.abs(length), Math.abs(width), Math.abs(height)).Shape();

            if (!shape || !shape.IsNull || shape.IsNull()) { console.error("BRepPrimAPI_MakeBox did not like its arguments!"); }

            // If we hit an object, let's CSG this Box to it
            if (hitAnObject && height > 0) {
                // The Height is Positive, let's Union
                let hitObject = this.shapes[hitObjectName];
                let unionOp = new this.oc.BRepAlgoAPI_Fuse_3(hitObject, shape);
                unionOp.SetFuzzyValue(0.0000001);
                unionOp.Build();
                return unionOp.Shape();
            } else if (hitAnObject && height < 0) {
                // The Height is Negative, let's Subtract
                let hitObject = this.shapes[hitObjectName];
                let differenceOp = new this.oc.BRepAlgoAPI_Cut_3(hitObject, shape);
                differenceOp.SetFuzzyValue(0.0000001);
                differenceOp.Build();
                return differenceOp.Shape();
            }

            return shape;
        } else {
            console.error("createBox got a Zero Dimension!");
        }
    }

    /** Sets a quaternion to align to two directions
     * @param {THREE.Quaternion} quat
     * @param {THREE.Vector3} xDir
     * @param {THREE.Vector3} yDir */
    alignXandYUnitVectors(quat, xDir, yDir) {
        this.vec.set(1, 0, 0);
        quat.setFromUnitVectors(this.vec, xDir);
        this.vec.set(0, 0, 1).applyQuaternion(quat);
        this.quat1.setFromUnitVectors(this.vec, yDir);
        return quat.premultiply(this.quat1);
    }

    activate() {
        if (this.tools.activeTool) {
            this.tools.activeTool.deactivate();
        }
        this.state = 0;
        this.tools.activeTool = this;
        this.tools.grid.updateCount = 0;
    }

    deactivate() {
        this.state = -1;
        this.tools.activeTool = null;
        this.world.scene.remove(this.arrow);
        this.tools.grid.setVisible(false);
        if (this.currentBox && this.currentBox.parent) {
            this.currentBox.parent.remove(this.currentBox);
        }
        this.tools.grid.updateCount = 0;
    }

    /** Whether or not to show this tool in the menu 
     * Only Show when no objects are selected */
    shouldShow() { return this.tools.tools[0].selected.length == 0; }
}

export { BoxTool };
