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
        this.vec = new THREE.Vector3();
        this.quat = new THREE.Quaternion();
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
            for (let h = 0; h < this.controller.lastFrame.hands.length; h++) {
                let hand = this.controller.lastFrame.hands[h];
                if (hand.type in this.hands) {
                    handsAreTracking = true;
                    this.updateHand(hand);
                    this.updatePinching(hand);
                } else {
                    this.createHand(hand);
                    console.log("Created hand!");
                }
            }

            // Update the Pinch Locomotion
            this.locomotion.update();

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

        // Check pinching with local fingertip positions
        if (handGroup.joints[0][4].position.distanceTo(
            handGroup.joints[1][4].position) < 40) {

            pinchSphere.visible = true;
            pinchSphere.updateWorldMatrix(true, true);
            let worldScale = handGroup.getWorldScale(this.vec).x;

            // Unfiltered Palm-Relative Pinching position
            handGroup.localToWorld(this.vec.copy(pinchSphere.localPinchPos));

            // Keep the pinch point within a 10mm sphere in Unscaled World Space
            pinchSphere.position.sub(this.vec).clampLength(0, 10 * worldScale).add(this.vec);
        } else {
            pinchSphere.visible = false;
        }
    }

    /** Create the hand's meshes
     * @param {Hand} hand */
    createHand(hand) {
        let handGroup = new THREE.Group();
        handGroup.name = hand.type + " Hand";
        handGroup.bones  = [];
        handGroup.joints = [];
        handGroup.visible = true;

        hand.fingers.forEach((finger) => {
            let boneMeshesFinger  = [];
            let jointMeshesFinger = [];
            finger.bones.forEach((bone) => {
                let boneMesh = new THREE.Mesh(
                    new THREE.CylinderBufferGeometry(5, 5, bone.length),
                    new THREE.MeshPhongMaterial()
                );
            
                boneMesh.material.color.setHex(0xffffff);
                boneMesh.layers.set(1);
                handGroup.add(boneMesh);
                boneMeshesFinger.push(boneMesh);
            });
        
            for (var i = 0; i < finger.bones.length + 1; i++) {
                let jointMesh = new THREE.Mesh(
                    new THREE.SphereBufferGeometry(8),
                    new THREE.MeshPhongMaterial()
                );
                jointMesh.material.color.setHex(0x0088ce);
                jointMesh.layers.set(1);
                handGroup.add(jointMesh);
                jointMeshesFinger.push(jointMesh);
            }

            handGroup.bones .push( boneMeshesFinger);
            handGroup.joints.push(jointMeshesFinger);
        });

        this.handParent.add(handGroup);
        this.hands[hand.type] = handGroup;
    }

    /** Update the hand's meshes
     * @param {Hand} hand */
    updateHand(hand) {
        let handGroup = this.hands[hand.type];

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

        hand.fingers.forEach((finger, index) => {
            handGroup.bones[index].forEach((mesh, i) => {
                let bone = finger.bones[i];
                mesh.position.fromArray(bone.center());
                
                mesh.setRotationFromMatrix((new THREE.Matrix4).fromArray(bone.matrix()));
                mesh.quaternion.multiply(this.baseBoneRotation);

                // Transforms into the local-space of the hand group
                mesh.applyMatrix4(toLocal);
            });

            handGroup.joints[index].forEach((mesh, i) => {
                let bone = finger.bones[i];
                if (bone) {
                    mesh.position.fromArray(bone.prevJoint);
                } else {
                    bone = finger.bones[i - 1];
                    mesh.position.fromArray(bone.nextJoint);
                }
                mesh.quaternion.identity();

                // Transforms into the local-space of the hand group
                mesh.applyMatrix4(toLocal);
            });
        });

        this.world.dirty = true;
    }

}

export { LeapHandInput };
