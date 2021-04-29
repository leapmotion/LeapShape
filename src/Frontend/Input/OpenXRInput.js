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
import { World } from '../World/World.js';
import { InteractionRay } from './Input.js';
import { XRControllerModelFactory } from '../../../node_modules/three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from '../../../node_modules/three/examples/jsm/webxr/XRHandModelFactory.js';

/** This manages all OpenXR-based input */
class OpenXRInput {
    /** Initialize OpenXR Controller and Hand Tracking
     * @param {World} world */
    constructor(world) {
        this.world = world;

        this.vec  = new THREE.Vector3();    this.vec2  = new THREE.Vector3();   this.vec3 = new THREE.Vector3();
        this.quat = new THREE.Quaternion(); this.quat2 = new THREE.Quaternion();
        this.mat1 = new THREE.Matrix4(); this.mat2 = new THREE.Matrix4();
        this.upTilt   = (new THREE.Quaternion).setFromEuler(new THREE.Euler( Math.PI / 3.5, 0, 0));
        this.downTilt = (new THREE.Quaternion).setFromEuler(new THREE.Euler(-Math.PI / 3.5, 0, 0));

        this.ray = new InteractionRay(new THREE.Ray());
        this.lastTimestep = performance.now();
        this.activeTime = 0; this.prevActive = false;
        this.mainHand = null; this.initialized = false;
        this.lastMainHand = null;
        this.cameraWorldPosition = new THREE.Vector3();
        this.cameraWorldQuaternion = new THREE.Quaternion();
        this.cameraWorldScale = new THREE.Quaternion();
        this.identity = new THREE.Quaternion().identity();

        //if (this.isActive()) { this.initialize(); }
    }

    initialize() {
        // Initialize Model Factories
        this.controllerModelFactory = new XRControllerModelFactory();
        let modelPath = (typeof ESBUILD !== 'undefined') ? './models/' : "../../../models/";
        this.handModelFactory = new XRHandModelFactory().setPath(modelPath);
        
        // Controllers
        this.controller1 = this.world.renderer.xr.getController(0);
        this.controller2 = this.world.renderer.xr.getController(1);
        this.controller1.inputState = { pinching: false }; this.controller1.visible = false;
        this.controller2.inputState = { pinching: false }; this.controller2.visible = false;
        this.controller1.traverse((element) => { if(element.layers){ element.layers.set(1); }});
        this.controller2.traverse((element) => { if(element.layers){ element.layers.set(1); }});
        this.world.cameraParent.add(this.controller1); this.world.cameraParent.add(this.controller2);
        this.controllerGrip1 = this.world.renderer.xr.getControllerGrip(0);
        this.controllerGrip2 = this.world.renderer.xr.getControllerGrip(1);
        this.controllerGrip1.add(this.controllerModelFactory.createControllerModel(this.controllerGrip1));
        this.controllerGrip2.add(this.controllerModelFactory.createControllerModel(this.controllerGrip2));
        this.controllerGrip1.traverse((element) => { if(element.layers){ element.layers.set(1); }});
        this.controllerGrip2.traverse((element) => { if(element.layers){ element.layers.set(1); }});
        this.world.cameraParent.add(this.controllerGrip1); this.world.cameraParent.add(this.controllerGrip2);
    
        // Controller Interaction
        this.controller1.addEventListener('selectstart', (e) => { this.controller1.inputState.pinching = true ; });
        this.controller1.addEventListener('selectend'  , (e) => { this.controller1.inputState.pinching = false; });
        this.controller2.addEventListener('selectstart', (e) => { this.controller2.inputState.pinching = true ; });
        this.controller2.addEventListener('selectend'  , (e) => { this.controller2.inputState.pinching = false; });
    
        // Hands
        this.hand1 = this.world.renderer.xr.getHand(0);
        this.hand2 = this.world.renderer.xr.getHand(1);
        this.hand1.inputState = { pinching: false };
        this.hand2.inputState = { pinching: false };
        this.handModel1 = this.handModelFactory.createHandModel(this.hand1, 'capsules');
        this.handModel2 = this.handModelFactory.createHandModel(this.hand2, 'capsules');
        this.hand1.add (this.handModel1);  this.hand2.add (this.handModel2);
        this.world.cameraParent.add(this.hand1);  this.world.cameraParent.add(this.hand2);
        this.hand1.layers.set(1); this.handModel1.layers.set(1); this.handModel1.frustumCulled = false;
        this.hand2.layers.set(1); this.handModel2.layers.set(1); this.handModel2.frustumCulled = false;
        this.hand1.traverse((element) => { if(element.layers){ element.layers.set(1); }});
        this.hand2.traverse((element) => { if(element.layers){ element.layers.set(1); }});
    
        // Controller Interaction
        this.hand1.addEventListener('pinchstart', (e) => { this.hand1.inputState.pinching = true ; });
        this.hand1.addEventListener('pinchend'  , (e) => { this.hand1.inputState.pinching = false; });
        this.hand2.addEventListener('pinchstart', (e) => { this.hand2.inputState.pinching = true ; });
        this.hand2.addEventListener('pinchend'  , (e) => { this.hand2.inputState.pinching = false; });

        // Pointer
        let lineGeometry = new THREE.BufferGeometry().setFromPoints(
            [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -0.03)]);
        let line = new THREE.Line(lineGeometry);
        line.material.color.setRGB(0, 0, 0);
        line.name = 'line';
        line.scale.z = 5;
        line.layers.set(1);
        line.frustumCulled = false;
        this.line1 = line.clone(); this.line1.quaternion.copy(this.downTilt); this.controller1.add(this.line1);
        this.line2 = line.clone(); this.line2.quaternion.copy(this.  upTilt); this.controller2.add(this.line2);
        this.hoverColor = new THREE.Color(0, 1, 1);
        this.idleColor  = new THREE.Color(0.5, 0.5, 0.5);
        this.initialized = true;
    }

    /** Updates visuals and regenerates the input ray */
    update() {
        if (this.isActive()) {
            if (!this.initialized) { this.initialize(); }

            this.controller1.children[0].visible = false;
            this.controller2.children[0].visible = false;

            // Set Ray Origin and Input Direction
            if (this.mainHand && !this.mainHand.visible) { this.mainHand = null; this.secondaryHand = null; }
            if (!this.mainHand && this.controller2.visible) { this.mainHand = this.controller2; this.secondaryHand = this.controller1;}
            if (!this.mainHand && this.controller1.visible) { this.mainHand = this.controller1; this.secondaryHand = this.controller2;}
            if (this.mainHand) {
                this.mainHand.children[0].visible = true;
                this.mainHand.children[0].material.color.copy(this.ray.lastHovering ? this.hoverColor : this.idleColor);

                let isHand = (this.handModel1.children.length > 0 && this.handModel1.children[0].count > 0) ||
                             (this.handModel2.children.length > 0 && this.handModel2.children[0].count > 0);
                this.line1.quaternion.copy(isHand ? this.downTilt : this.identity);
                this.line2.quaternion.copy(isHand ? this.  upTilt : this.identity);

                this.ray.ray.direction.copy(this.vec.set(0, 0, -1).applyQuaternion(this.mainHand.children[0].getWorldQuaternion(this.quat)));
                this.ray.ray.origin.copy(this.ray.ray.direction).multiplyScalar(isHand?0.0:0.05).add(this.mainHand.getWorldPosition(this.vec));

                if (this.world.leftPinch && this.world.rightPinch){
                    this.world.leftPinch.position.copy(this.controller1.getWorldPosition(this.vec));
                    this.world.leftPinch. visible = this.controller1.inputState.pinching;
                    this.world.rightPinch.position.copy(this.controller2.getWorldPosition(this.vec));
                    this.world.rightPinch.visible = this.controller2.inputState.pinching;
                }

                // Set the Menu Buttons to appear beside the users' secondary hand
                this.world.camera.getWorldQuaternion(this.cameraWorldQuaternion);
                this.world.camera.getWorldScale     (this.cameraWorldScale);
                if (this.secondaryHand && this.world.parent.tools.menu) {
                    let slots = this.world.parent.tools.menu.slots;
                    if (slots) {
                        this.secondaryHandTransform = (this.secondaryHand == this.controller1 ?
                            this.hand1 : this.hand2).joints['middle-finger-phalanx-proximal'];

                        // Calculate whether the secondary hand's palm is facing the camera
                        this.vec.set(0, -1, 0).applyQuaternion(this.secondaryHandTransform.getWorldQuaternion(this.quat));
                        this.vec2.set(0, 0, -1).applyQuaternion(this.cameraWorldQuaternion);
                        let facing = this.vec.dot(this.vec2);
                        if (facing < 0.0) {
                            // Array the Menu Items next to the user's secondary hand
                            this.secondaryHandTransform.getWorldPosition(this.vec3);

                            for (let s = 0; s < slots.length; s++) {
                                let oldParent = slots[s].parent;
                                this.world.scene.add(slots[s]);

                                let chirality = (this.secondaryHand == this.controller1 ? -1 : 1);
                                this.vec2.set((((s % 3) * 0.045) + 0.07) * chirality,
                                    0.05 - (Math.floor(s / 3) * 0.055), 0.00).applyQuaternion(this.cameraWorldQuaternion);
                                this.vec.set(-0.02 * chirality, 0, 0).applyQuaternion(this.quat).add(this.vec2)
                                    .multiplyScalar(this.cameraWorldScale.x).add(this.vec3);
                                
                                slots[s].position.copy(this.vec);
                                oldParent.attach(slots[s]);
                            }
                        }
                    }
                }

            }
            this.world.handsAreTracking = this.mainHand !== null;
            this.lastMainHand = this.mainHand;

            // Add Extra Fields for the active state
            this.ray.justActivated = false; this.ray.justDeactivated = false;
            this.ray.active = this.mainHand !== null && this.mainHand.inputState.pinching;
            if ( this.ray.active && !this.prevActive) { this.ray.justActivated   = true; this.activeTime = 0; }
            if (!this.ray.active &&  this.prevActive) { this.ray.justDeactivated = true; }
            this.ray.hovering = false;
            this.prevActive = this.ray.active;
            if (this.ray.active) { this.activeTime += performance.now() - this.lastTimestep; }
            this.ray.activeMS = this.activeTime;
            this.lastTimestep = performance.now();
        }
    }

    /** Does this input want to take control? */
    isActive() { return (this.world.inVR && this.world.mobile) || /(Oculus)/g.test(navigator.userAgent); }

}

export { OpenXRInput };
