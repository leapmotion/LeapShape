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
        this.lastFrameNumber = 0;

        this.hands = {};
        this.baseBoneRotation = (new THREE.Quaternion).setFromEuler(
            new THREE.Euler(Math.PI / 2, 0, 0)
        );
        this.handParent = new THREE.Group();
        // HMD Mode
        //this.handParent.position.z = -100;
        //this.handParent.quaternion.setFromEuler(
        //    new THREE.Euler(Math.PI / 2, 0, Math.PI)
        //);
        // Desktop Mode
        this.handParent.position.y = -300;
        this.handParent.position.z = -400;
        this.handParent.quaternion.setFromEuler(
            new THREE.Euler(0, 0, 0)
        );

        // Create an artificial parent since parenting 
        // directly to the camera doesn't work
        // TODO: Add Temporal Warping to this
        this.handParentParent = new THREE.Group();
        this.handParentParent.add(this.handParent);
        this.world.scene.add(this.handParentParent);

        this.pinchSpheres = {};
        this.pinchSpheres['left'] = new THREE.Mesh(new THREE.SphereBufferGeometry(20, 10, 10), new THREE.MeshPhongMaterial());
        this.pinchSpheres['left'].material.color.setRGB(0.2, 0.5, 0.5);
        this.pinchSpheres['left'].name = "Left Pinch Sphere";
        this.pinchSpheres['left'].visible = false;
        this.pinchSpheres['right'] = new THREE.Mesh(new THREE.SphereBufferGeometry(20, 10, 10), new THREE.MeshPhongMaterial());
        this.pinchSpheres['right'].material.color.setRGB(0.5, 0.2, 0.2);
        this.pinchSpheres['right'].name = "Right Pinch Sphere";
        this.pinchSpheres['right'].visible = false;
        this.world.scene.add(this.pinchSpheres['left']);
        this.world.scene.add(this.pinchSpheres['right']);

        this.indexPos = new THREE.Vector3(); this.thumbPos = new THREE.Vector3();
        this.locomotion = new LeapPinchLocomotion(world, this.pinchSpheres['left'], this.pinchSpheres['right']);
    }

    /** Updates visuals and regenerates the input ray */
    update() {
        // Child the hands to the Camera
        this.world.camera.getWorldPosition(this.handParentParent.position);
        this.world.camera.getWorldQuaternion(this.handParentParent.quaternion);
        this.world.camera.getWorldScale(this.handParentParent.scale);
        
        if (this.controller.lastFrame.id !== this.lastFrameNumber) {
            let handsAreTracking = false;
            for (let h = 0; h < this.controller.lastFrame.hands.length; h++) {
                let hand = this.controller.lastFrame.hands[h];
                if (hand.type in this.hands) {
                    this.updateHand(hand);
                    this.updatePinching(hand);
                    handsAreTracking = true;
                } else {
                    this.createHand(hand);
                }
            }
            this.locomotion.update();
            this.world.camera.getWorldPosition(this.handParentParent.position);
            this.world.camera.getWorldQuaternion(this.handParentParent.quaternion);
            this.world.camera.getWorldScale(this.handParentParent.scale);
            this.world.camera.parent.updateWorldMatrix(true, true);

            this.world.handsAreTracking = handsAreTracking;

            this.lastFrameNumber = this.controller.lastFrame.id;
        }
    }

    /** Does this input want to take control? */
    isActive() { return false; }

    /** Update the pinch state of the hands 
     * @param {Hand} hand */
    updatePinching(hand) {
        //console.log(hand.type);
        this.hands[hand.type].spheres[0][4].getWorldPosition(this.thumbPos);
        this.hands[hand.type].spheres[1][4].getWorldPosition(this.indexPos);

        if (this.hands[hand.type].spheres[0][4].position.distanceToSquared(
            this.hands[hand.type].spheres[1][4].position) < 40 * 40) {
            this.pinchSpheres[hand.type].visible = true;
            this.pinchSpheres[hand.type].position.copy(this.thumbPos).add(this.indexPos).multiplyScalar(0.5);
        } else {
            this.pinchSpheres[hand.type].visible = false;
        }
    }

    /** Create the hand's meshes
     * @param {Hand} hand */
    createHand(hand) {
        let  boneMeshes = [];
        let jointMeshes = [];

        hand.fingers.forEach((finger) => {
            let boneMeshesFinger = [];
            let jointMeshesFinger = [];
            finger.bones.forEach((bone) => {
                let boneMesh = new THREE.Mesh(
                    new THREE.CylinderBufferGeometry(5, 5, bone.length),
                    new THREE.MeshPhongMaterial()
                );
            
                boneMesh.material.color.setHex(0xffffff);
                this.handParent.add(boneMesh);
                boneMeshesFinger.push(boneMesh);
            });
        
            for (var i = 0; i < finger.bones.length + 1; i++) {
                let jointMesh = new THREE.Mesh(
                    new THREE.SphereBufferGeometry(8),
                    new THREE.MeshPhongMaterial()
                );
                jointMesh.material.color.setHex(0x0088ce);
                this.handParent.add(jointMesh);
                jointMeshesFinger.push(jointMesh);
            }

            boneMeshes .push( boneMeshesFinger);
            jointMeshes.push(jointMeshesFinger);

        });
        this.hands[hand.type] = { cylinders: boneMeshes, spheres: jointMeshes };
    }

    /** Update the hand's meshes
     * @param {Hand} hand */
    updateHand(hand) {
        let models = this.hands[hand.type];
        hand.fingers.forEach((finger, index) => {
            models.cylinders[index].forEach((mesh, i) => {
                let bone = finger.bones[i];
                mesh.position.fromArray(bone.center());
                mesh.setRotationFromMatrix(
                    (new THREE.Matrix4).fromArray(bone.matrix())
                );
                mesh.quaternion.multiply(this.baseBoneRotation);
            });

            models.spheres[index].forEach((mesh, i) => {
                let bone = finger.bones[i];
                if (bone) {
                    mesh.position.fromArray(bone.prevJoint);
                } else {
                    bone = finger.bones[i - 1];
                    mesh.position.fromArray(bone.nextJoint);
                }
            });
        });
        this.world.dirty = true;
    }

}

export { LeapHandInput };
