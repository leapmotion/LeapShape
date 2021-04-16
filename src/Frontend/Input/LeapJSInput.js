import * as THREE from '../../../node_modules/three/build/three.module.js';
import "../../../node_modules/leapjs/leap-1.1.0.js";
import { World } from '../World/World.js';
import { InteractionRay } from './Input.js';
import { LeapFrameInterpolator } from './LeapFrameInterpolator.js';
import { createDitherDepthMaterial } from '../Tools/General/ToolUtils.js';

/** This is the Leap Hand Tracking-based Input */
class LeapJSInput {
    /** Initialize Leap.js Input
     * @param {World} world */
    constructor(world) {
        this.world = world;
        this.controller = new window.Leap.Controller({ optimizeHMD: false }).connect();

        this.hands = {};
        this.lastFrameTimestamp = 0;
        this.palmDirection = new THREE.Vector3();
        this.palmNormal = new THREE.Vector3();
        this.cameraWorldPosition = new THREE.Vector3();
        this.cameraWorldQuaternion = new THREE.Quaternion();
        this.cameraWorldScale = new THREE.Quaternion();
        this.vec = new THREE.Vector3(); this.vec2 = new THREE.Vector3(); this.vec3 = new THREE.Vector3(); this.vec4 = new THREE.Vector3();
        this.quat = new THREE.Quaternion(); this.quat2 = new THREE.Quaternion(); this.eul = new THREE.Euler();
        this.mat1 = new THREE.Matrix4(); this.mat2 = new THREE.Matrix4();
        this.baseBoneRotation = (new THREE.Quaternion).setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));

        this.handParent = new THREE.Group();
        this.handParent.scale.set(0.001, 0.001, 0.001);
        this.world.camera.add(this.handParent);
        this.hmdEuler = new THREE.Euler(Math.PI / 2, 0, Math.PI);

        // Set up Pinch Related Data
        this.pinchSpheres = {};
        this.pinchSpheres['left'] = new THREE.Mesh(new THREE.SphereBufferGeometry(20, 10, 10), new THREE.MeshPhongMaterial());
        this.pinchSpheres['left'].material.color.setRGB(0.2, 0.5, 0.5);
        this.pinchSpheres['left'].name = "Left Pinch Sphere";
        this.pinchSpheres['left'].visible = false;
        this.pinchSpheres['left'].layers.set(1);
        this.pinchSpheres['right'] = new THREE.Mesh(new THREE.SphereBufferGeometry(20, 10, 10), new THREE.MeshPhongMaterial());
        this.pinchSpheres['right'].material.color.setRGB(0.5, 0.2, 0.2);
        this.pinchSpheres['right'].name = "Right Pinch Sphere";
        this.pinchSpheres['right'].visible = false;
        this.pinchSpheres['right'].layers.set(1);
        this.world.leftPinch  = this.pinchSpheres['left' ];
        this.world.rightPinch = this.pinchSpheres['right'];
        this.world.scene.add(this.pinchSpheres['left']);
        this.world.scene.add(this.pinchSpheres['right']);

        this.ray = new InteractionRay(new THREE.Ray());
        this.lastTimestep = performance.now();
        this.activeTime = 0; this.prevActive = false;
        this.mainHand = null;
        this.hoverColor = new THREE.Color(0, 1, 1);
        this.idleColor = new THREE.Color(0.5, 0.5, 0.5);

        this.curInVR = false;

        this.interpolator = new LeapFrameInterpolator(world, this.controller);
    }

    /** Updates visuals and regenerates the input ray */
    update() {
        // Rebase performance.now() and the leap timestamps together
        this.interpolatedFrame = this.interpolator.update();

        if (this.world.inVR != this.curInVR) {
            this.controller.setOptimizeHMD(this.world.inVR);
            if (this.world.inVR) {
                // HMD Mode
                this.handParent.position.y = 0;
                this.handParent.position.z = -0.100;
                this.handParent.quaternion.setFromEuler(this.hmdEuler);
            } else {
                // Desktop Mode
                this.handParent.position.y = -0.300;
                this.handParent.position.z = -0.400;
                this.handParent.quaternion.identity();
            }
            this.curInVR = this.world.inVR;
        }

        let handsAreTracking = false;
        for (let type in this.hands) {
            this.hands[type].markForHiding = true;
        }
        for (let h = 0; h < this.interpolatedFrame.hands.length; h++) {
            let hand = this.interpolatedFrame.hands[h];
            if (!hand.valid) { continue; }
            if (hand.type in this.hands) {
                handsAreTracking = true;
                this.updateHand(hand);
                this.updatePinching(hand);

                // First Hand that shows up becomes "the main hand"
                if (!this.mainHand) { this.mainHand = hand.type; }
            } else {
                this.createHand(hand);
            }
        }
        for (let type in this.hands) {
            if (this.hands[type].markForHiding) {
                this.hands[type].visible = false;
            }
        }

        // Set the Menu Buttons to appear beside the users' secondary hand
        this.world.camera.getWorldPosition  (this.cameraWorldPosition);
        this.world.camera.getWorldQuaternion(this.cameraWorldQuaternion);
        this.world.camera.getWorldScale     (this.cameraWorldScale);
        if (this.mainHand && this.world.parent.tools.menu) {
            let secondaryHandType = this.mainHand === "left" ? "right" : "left";
            /** @type {THREE.Object3D} */
            let secondaryHand = this.hands[secondaryHandType];
            let slots = this.world.parent.tools.menu.slots;
            if (secondaryHand && secondaryHand.visible && slots) {
                // Calculate whether the secondary hand's palm is facing the camera
                this.vec .set(0, -1, 0).applyQuaternion(secondaryHand.getWorldQuaternion(this.quat));
                this.vec2.set(0, 0, -1).applyQuaternion(this.cameraWorldQuaternion);
                let facing = this.vec.dot(this.vec2);
                if (facing < 0.0) {
                    // Array the Menu Items next to the user's secondary hand
                    secondaryHand.getWorldPosition(this.vec3);

                    for (let s = 0; s < slots.length; s++){
                        let oldParent = slots[s].parent;
                        this.world.scene.add(slots[s]);

                        let chirality = (secondaryHandType === 'left' ? 1 : -1);
                        this.vec2.set(((Math.floor(s / 3) * 0.05) + 0.07) * chirality,
                                          0.05 - ((s % 3) * 0.05), 0.00).applyQuaternion(this.cameraWorldQuaternion);
                        this.vec.set(0.03 * chirality, 0, 0).applyQuaternion(this.quat).add(this.vec2)
                            .multiplyScalar(this.cameraWorldScale.x).add(this.vec3);
                        
                        slots[s].position.copy(this.vec);
                        oldParent.attach(slots[s]);
                    }
                }
            }
        }

        if (this.isActive()) {
            // Set Ray Origin and Direction
            let curSphere = this.pinchSpheres[this.mainHand];
            if (curSphere) {

                // Approximate shoulder position with magic values
                this.vec2.set(0, 0, -1).applyQuaternion(this.cameraWorldQuaternion).y = 0;

                // Get Shoulder Rotation Quaternion
                this.quat.setFromUnitVectors(this.vec3.set(0, 0, 1), this.vec2.normalize());
                // Place Projection origin points roughly where the shoulders are
                this.vec2.set((this.mainHand === "left") ? 0.15 : -0.15, 0.05, -0.05)
                    .multiplyScalar(this.cameraWorldScale.x).applyQuaternion(this.quat);
                this.ray.ray.origin.copy(this.cameraWorldPosition.add(this.vec2));

                this.ray.ray.direction.copy(curSphere.position).sub(this.ray.ray.origin).normalize();
            }

            // Add Extra Fields for the active state
            this.ray.justActivated = false; this.ray.justDeactivated = false;
            this.ray.active = curSphere.visible;
            if ( this.ray.active && !this.prevActive) { this.ray.justActivated   = true; this.activeTime = 0; }
            if (!this.ray.active &&  this.prevActive) { this.ray.justDeactivated = true; }
            this.ray.alreadyActivated = false;
            this.prevActive = this.ray.active;
            if (this.ray.active) { this.activeTime += performance.now() - this.lastTimestep; }
            this.ray.activeMS = this.activeTime;
            this.lastTimestep = performance.now();
        }

        // HACK: Reset the world's camera parenting scheme so orbit controls still work
        if (!handsAreTracking && this.world.handsAreTracking && !this.world.inVR) {
            this.world.scene.attach(this.world.camera);
            this.world.cameraParent.position  .set(0, 0, 0);
            this.world.cameraParent.quaternion.identity();
            this.world.cameraParent.scale     .set(1, 1, 1);
            this.world.cameraParent.attach(this.world.camera);
            this.world.controls.target.copy(this.world.camera.localToWorld(new THREE.Vector3( 0, 0, -0.3)));
        }
        this.world.handsAreTracking = handsAreTracking;
        if (!handsAreTracking || !this.hands[this.mainHand].visible) { this.mainHand = null; }
    }

    /** Does this input want to take control? */
    isActive() { return this.world.handsAreTracking && this.mainHand && !this.world.mobile; }

    /** Update the pinch state of the hands 
     * @param {Hand} hand */
    updatePinching(hand) {
        let pinchSphere = this.pinchSpheres[hand.type];
        let handGroup   = this.hands       [hand.type];

        // Read the Index and Thumb Tip positions into vec and vec2
        handGroup.joints.getMatrixAt(4, this.mat1); this.mat1.decompose(this.vec , this.quat, this.vec3);
        handGroup.joints.getMatrixAt(9, this.mat1); this.mat1.decompose(this.vec2, this.quat, this.vec3);

        // Check pinching with local fingertip positions
        if (handGroup.visible &&
            this.vec.distanceTo(this.vec2) <
                ((pinchSphere.visible || pinchSphere.invalidPinch) ? 40 : 20)) { // Use hysteresis to mitigate spurious pinches

            // If the hand is too young and it starts pinching... that's no good.
            if (pinchSphere.invalidPinch || (!(pinchSphere.visible) && handGroup.ageMs < 300)) {
                pinchSphere.invalidPinch = true; return;
            }
            
            // This hand is pinching in a valid way, push it through
            pinchSphere.visible = true;
            //

        } else {
            pinchSphere.visible = false;
            pinchSphere.invalidPinch = false;
        }

        let worldScale = handGroup.getWorldScale(this.vec).x;
        // Unfiltered Palm-Relative Pinching position
        handGroup.localToWorld(this.vec.copy(handGroup.localPinchPos));
        // Keep the pinch point within a 10mm sphere in Unscaled World Space
        pinchSphere.position.sub(this.vec).clampLength(0, 10 * worldScale).add(this.vec);
        //pinchSphere.position.lerp(this.vec, 0.01);
        handGroup.getWorldQuaternion(pinchSphere.quaternion);
        pinchSphere.updateWorldMatrix(true, true);
    }

    /** Create the hand's meshes
     * @param {Hand} hand */
    createHand(hand) {
        let handGroup      = new THREE.Group();
        handGroup.name     = hand.type + " Hand";
        handGroup.handType = hand.type; 
        handGroup.visible  = true;
        handGroup.startMs  = performance.now();
        handGroup.age      = 0;
        handGroup.frustumCulled = false;

        this. boneMat = new THREE.MeshPhongMaterial();//createDitherDepthMaterial(this.world);
        this.jointMat = new THREE.MeshPhongMaterial();//createDitherDepthMaterial(this.world);

        handGroup.bones = new THREE.InstancedMesh(
            new THREE.CylinderBufferGeometry(5, 5, 1),
            this.boneMat, 32);
        //handGroup.bones.castShadow = true;
        handGroup.bones.layers.set(1);
        handGroup.add(handGroup.bones);

        this.jointMat.color = new THREE.Color(0, 0.53, 0.808);
        handGroup.joints = new THREE.InstancedMesh(
            new THREE.SphereBufferGeometry(1, 10, 10),
            this.jointMat, 32);
        //handGroup.joints.castShadow = true;
        handGroup.joints.layers.set(1);
        handGroup.add(handGroup.joints);

        // At Pinch Point
        //handGroup.localPinchPos = new THREE.Vector3(32 * (hand.type==='left'?-1:1), -50, 20);
        // Outside of Pinch Point
        handGroup.localPinchPos = new THREE.Vector3(50 * (hand.type==='left'?-1:1), -50, 40);
        handGroup.arrow = new THREE.ArrowHelper(this.vec.set(0, -1, 0), handGroup.localPinchPos, 100, 0x00ffff, 10, 10);
        //handGroup.arrow.visible = false;
        handGroup.arrow.layers.set(1);
        handGroup.arrow.cone.layers.set(1);
        handGroup.arrow.line.layers.set(1);
        handGroup.arrow.frustumCulled = false;
        handGroup.add(handGroup.arrow);

        this.handParent.add(handGroup);
        this.hands[hand.type] = handGroup;
    }

    /** Update the hand's meshes
     * @param {Hand} hand */
    updateHand(hand) {
        let handGroup = this.hands[hand.type];
        if (!(handGroup.visible)) {
            handGroup.startMs = performance.now();
            handGroup.ageMs = 0;
        } else {
            handGroup.ageMs = performance.now() - handGroup.startMs;
        }
        handGroup.visible = true;

        // Set Hand Palm Position
        handGroup.position.fromArray(hand.palmPosition);

        // Set Hand Palm Rotation
        this.palmDirection.fromArray(hand.direction );
        this.palmNormal   .fromArray(hand.palmNormal);
        this.vec.set(0, 0, 1);
        handGroup.quaternion.setFromUnitVectors(this.vec, this.palmDirection);
        this.vec.set(0, -1, 0).applyQuaternion(handGroup.quaternion);
        this.quat.setFromUnitVectors(this.vec, this.palmNormal);
        handGroup.quaternion.premultiply(this.quat);
        handGroup.updateMatrix();

        // Update the Hand Ray Arrow Helper...
        handGroup.arrow.visible = handGroup.handType === this.mainHand;
        handGroup.arrow.setDirection(this.vec.copy(this.ray.ray.direction).
            applyQuaternion(handGroup.getWorldQuaternion(this.quat2).invert()));
        handGroup.arrow.setColor(this.ray.lastAlreadyActivated ? this.hoverColor : this.idleColor);

        // Create a to-local-space transformation matrix
        let toLocal = handGroup.matrix.clone().invert();

        let boneIdx = 0, jointIdx = 0;
        hand.fingers.forEach((finger, index) => {
            finger.bones.forEach((bone, i) => {
                // Sets up this bone's instance matrix
                this.mat1.fromArray(bone.matrix());
                this.mat1.decompose(this.vec, this.quat, this.vec2);
                this.vec2.set(1, bone.length, 1);
                this.quat.multiply (this.baseBoneRotation);
                this.mat1.compose  (this.vec.fromArray(bone.center()), this.quat, this.vec2);

                // Transforms into the local-space of the hand
                this.mat1.premultiply(toLocal);

                handGroup.bones.setMatrixAt(boneIdx, this.mat1);
                boneIdx++;
            });

            for (let i = 0; i < finger.bones.length + 1; i++) {
                let bone = finger.bones[i];
                if (bone) {
                    this.vec.fromArray(bone.prevJoint);
                } else {
                    bone = finger.bones[i - 1];
                    this.vec.fromArray(bone.nextJoint);
                }
                this.quat.identity();
                this.vec2.set(8, 8, 8);

                // Transforms into the local-space of the hand group
                this.mat1.compose(this.vec, this.quat, this.vec2).premultiply(toLocal);

                handGroup.joints.setMatrixAt(jointIdx, this.mat1);
                jointIdx++;
            }

        });

        handGroup.bones .count = boneIdx;
        handGroup.joints.count = jointIdx;
        handGroup.bones .instanceMatrix.needsUpdate = true;
        handGroup.joints.instanceMatrix.needsUpdate = true;

        handGroup.markForHiding = false;
        this.world.dirty = true;
    }

}

export { LeapJSInput };
