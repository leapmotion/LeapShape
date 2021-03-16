import * as THREE from '../../../node_modules/three/build/three.module.js';
import "../../../node_modules/leapjs/leap-1.1.0.js";

/**
 * This is the Leap Hand Tracking-based Input
 */
class LeapHandInput {
    /** Initialize Mouse Capture
     * @param {World} world */
    constructor(world) {
        this.world = world;
        this.ray = null;
        this.controller = new window.Leap.Controller({ optimizeHMD: true }).connect();

        this.hands = {};
        this.baseBoneRotation = (new THREE.Quaternion).setFromEuler(
            new THREE.Euler(Math.PI / 2, 0, 0)
        );
    }

    /** Updates visuals and regenerates the input ray */
    update() {
        for (let h = 0; h < this.controller.lastFrame.hands.length; h++) {
            let hand = this.controller.lastFrame.hands[h];
            if (hand.type in this.hands) {
                this.updateHand(hand);
            } else {
                this.createHand(hand);
            }
        }
    }

    /** Does this input want to take control? */
    isActive() { return false; }

    createHand(hand) {
        let  boneMeshes = [];
        let jointMeshes = [];
        console.log(hand);
        hand.fingers.forEach((finger) => {
            let boneMeshesFinger = [];
            let jointMeshesFinger = [];
            finger.bones.forEach((bone) => {
                let boneMesh = new THREE.Mesh(
                    new THREE.CylinderBufferGeometry(5, 5, bone.length),
                    new THREE.MeshPhongMaterial()
                );
            
                boneMesh.material.color.setHex(0xffffff);
                this.world.scene.add(boneMesh);
                boneMeshesFinger.push(boneMesh);
            });
        
            for (var i = 0; i < finger.bones.length + 1; i++) {
                let jointMesh = new THREE.Mesh(
                    new THREE.SphereBufferGeometry(8),
                    new THREE.MeshPhongMaterial()
                );
                jointMesh.material.color.setHex(0x0088ce);
                this.world.scene.add(jointMesh);
                jointMeshesFinger.push(jointMesh);
            }

            boneMeshes .push( boneMeshesFinger);
            jointMeshes.push(jointMeshesFinger);

        });
        this.hands[hand.type] = { cylinders: boneMeshes, spheres: jointMeshes };
    }

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
    }

}

export { LeapHandInput };
