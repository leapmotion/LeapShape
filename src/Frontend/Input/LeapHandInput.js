import * as THREE from '../../../node_modules/three/build/three.module.js';
import "../../../node_modules/leapjs/leap-1.1.0.js";
import { World } from '../World/World.js';
import { LeapPinchLocomotion } from './LeapPinchLocomotion.js';

/**
 * This is the Leap Hand Tracking-based Input
 */
class LeapHandInput {
    /** Initialize Mouse Capture
     * @param {World} world */
    constructor(world) {
        this.world = world;
        this.ray = null;
        this.controller = new window.Leap.Controller({ optimizeHMD: false }).connect();

        this.hands = {};
        this.lastFrameNumber = 0;
        this.palmDirection = new THREE.Vector3();
        this.palmNormal = new THREE.Vector3();
        this.vec = new THREE.Vector3(); this.vec2 = new THREE.Vector3(); this.vec3 = new THREE.Vector3();
        this.quat = new THREE.Quaternion(); this.quat2 = new THREE.Quaternion();
        this.mat1 = new THREE.Matrix4(); this.mat2 = new THREE.Matrix4();
        this.baseBoneRotation = (new THREE.Quaternion).setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));

        this.handParent = new THREE.Group();
        // HMD Mode
        //this.handParent.position.z = -100;
        //this.handParent.quaternion.setFromEuler(
        //    new THREE.Euler(Math.PI / 2, 0, Math.PI)
        //);
        // Desktop Mode
        this.handParent.position.y = -300;
        this.handParent.position.z = -400;
        this.handParent.quaternion.setFromEuler(new THREE.Euler(0, 0, 0));
        this.world.camera.add(this.handParent);

        // Set up Pinch Related Data
        this.pinchSpheres = {};
        this.pinchSpheres['left'] = new THREE.Mesh(new THREE.SphereBufferGeometry(20, 10, 10), new THREE.MeshPhongMaterial());
        this.pinchSpheres['left'].material.color.setRGB(0.2, 0.5, 0.5);
        this.pinchSpheres['left'].name = "Left Pinch Sphere";
        this.pinchSpheres['left'].visible = false;
        this.pinchSpheres['left'].localPinchPos = new THREE.Vector3(-32, -50, 20);
        this.pinchSpheres['left'].layers.set(1);
        this.pinchSpheres['right'] = new THREE.Mesh(new THREE.SphereBufferGeometry(20, 10, 10), new THREE.MeshPhongMaterial());
        this.pinchSpheres['right'].material.color.setRGB(0.5, 0.2, 0.2);
        this.pinchSpheres['right'].name = "Right Pinch Sphere";
        this.pinchSpheres['right'].visible = false;
        this.pinchSpheres['right'].localPinchPos = new THREE.Vector3(32, -50, 20);
        this.pinchSpheres['right'].layers.set(1);
        this.world.scene.add(this.pinchSpheres['left']);
        this.world.scene.add(this.pinchSpheres['right']);
        this.locomotion = new LeapPinchLocomotion(world, this.pinchSpheres['left'], this.pinchSpheres['right']);
    }

    /** Updates visuals and regenerates the input ray */
    update() {
        if (this.controller.lastFrame.id !== this.lastFrameNumber) {
            let handsAreTracking = false;

            for (let type in this.hands) {
                this.hands[type].markForHiding = true;
            }
            for (let h = 0; h < this.controller.lastFrame.hands.length; h++) {
                let hand = this.controller.lastFrame.hands[h];
                if (hand.type in this.hands) {
                    handsAreTracking = true;
                    this.updateHand(hand);
                    this.updatePinching(hand);
                } else {
                    this.createHand(hand);
                }
            }
            for (let type in this.hands) {
                if (this.hands[type].markForHiding) {
                    this.hands[type].visible = false;
                }
            }

            // Update the Pinch Locomotion
            this.locomotion.update();

            // HACK: Reset the world's camera parenting scheme so orbit controls still work
            if (!handsAreTracking && this.world.handsAreTracking) {
                this.world.scene.attach(this.world.camera);
                this.world.cameraParent.position  .set(0, 0, 0);
                this.world.cameraParent.quaternion.identity();
                this.world.cameraParent.scale     .set(1, 1, 1);
                this.world.cameraParent.attach(this.world.camera);
                this.world.controls.target.copy(this.world.camera.localToWorld(new THREE.Vector3( 0, 0, -300)));
            }
            this.world.handsAreTracking = handsAreTracking;
            this.lastFrameNumber = this.controller.lastFrame.id;
        }
    }

    /** Does this input want to take control? */
    isActive() { return false; }

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
            pinchSphere.updateWorldMatrix(true, true);
            let worldScale = handGroup.getWorldScale(this.vec).x;

            // Unfiltered Palm-Relative Pinching position
            handGroup.localToWorld(this.vec.copy(pinchSphere.localPinchPos));

            // Keep the pinch point within a 10mm sphere in Unscaled World Space
            pinchSphere.position.sub(this.vec).clampLength(0, 10 * worldScale).add(this.vec);
            //pinchSphere.position.lerp(this.vec, 0.01);
            handGroup.getWorldQuaternion(pinchSphere.quaternion);
        } else {
            pinchSphere.visible = false;
            pinchSphere.invalidPinch = false;
        }
    }

    /** Create the hand's meshes
     * @param {Hand} hand */
    createHand(hand) {
        let handGroup     = new THREE.Group();
        handGroup.name    = hand.type + " Hand";
        handGroup.visible = true;
        handGroup.startMs = performance.now();
        handGroup.age     = 0;

        handGroup.bones = new THREE.InstancedMesh(
            new THREE.CylinderBufferGeometry(5, 5, 1),
            new THREE.MeshPhongMaterial(), 32);
        //handGroup.bones.castShadow = true;
        handGroup.bones.layers.set(1);
        handGroup.add(handGroup.bones);

        let jointMat = new THREE.MeshPhongMaterial();
        jointMat.color = new THREE.Color(0, 0.53, 0.808);
        handGroup.joints = new THREE.InstancedMesh(
            new THREE.SphereBufferGeometry(1, 8, 8),
            jointMat, 32);
        //handGroup.joints.castShadow = true;
        handGroup.joints.layers.set(1);
        handGroup.add(handGroup.joints);

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

export { LeapHandInput };
