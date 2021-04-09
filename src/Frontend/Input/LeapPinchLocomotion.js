import * as THREE from '../../../node_modules/three/build/three.module.js';
import "../../../node_modules/leapjs/leap-1.1.0.js";
import { World } from '../World/World.js';

/** This is the Leap Hand Tracking-based Camera Controller */
class LeapPinchLocomotion {
    /** Initialize Camera Control
     * @param {World} world 
     * @param {THREE.Object3D} leftPinchSphere
     * @param {THREE.Object3D} rightPinchSphere */
    constructor(world, leftPinchSphere, rightPinchSphere) {
        this.world = world;

        this.momentum           = 0.125;
        this.horizontalRotation = true;
        this.enableScaling      = true;

        this.curA  = new THREE.Vector3(); // The dynamic    world-space pinch points
        this.curB  = new THREE.Vector3();
        this.rootA = new THREE.Vector3(); // The stationary world-space anchors
        this.rootB = new THREE.Vector3();
        this.residualMomentum = new THREE.Vector3();
        this.isLeftPinching  = false;
        this.isRightPinching = false;

        this.leftPinchSphere  =  leftPinchSphere;
        this.rightPinchSphere = rightPinchSphere;
    }

    /** Moves the camera and adds momentum */
    update() {
        let left          = this. leftPinchSphere;
        let right         = this.rightPinchSphere;
        let  leftPinching = left .visible;
        let rightPinching = right.visible;
  
        if (leftPinching && rightPinching) {             // Set Points when Both Pinched
          left .getWorldPosition(this.curA);
          right.getWorldPosition(this.curB);
  
          if (!this.isLeftPinching || !this.isRightPinching) {
            this.rootA.copy(this.curA);
            this.rootB.copy(this.curB);
          }
        //} else if (leftPinching) {                       // Set Points when Left Pinched
        //  left .getWorldPosition(this.curA);
        //  if (!this.isLeftPinching) {
        //    this.rootA.copy(this.curA);
        //  }
        //} else if (rightPinching) {                      // Set Points when Right Pinched
        //  right.getWorldPosition(this.curB);
        //  if (!this.isRightPinching) {
        //    this.rootB.copy(this.curB);
        //  }
        } else if (leftPinching) {                       // Set Points when Left Pinched
          this.oneHandedPinchMove(left, this.isLeftPinching, this.isRightPinching,
                                  this.rootA, this.curA, this.rootB, this.curB);
        } else if (rightPinching) {                      // Set Points when Right Pinched
          this.oneHandedPinchMove(right, this.isRightPinching, this.isLeftPinching,
                                  this.rootB, this.curB, this.rootA, this.curA);
        } else {                                         // Apply Momentum to Dynamic Points when Unpinched
          this.curA.lerp(this.rootA, this.momentum);
          this.curB.lerp(this.rootB, this.momentum);
        }
        this.isLeftPinching  = leftPinching;
        this.isRightPinching = rightPinching;
  
        // Transform the root so the (dynamic) cur points match the (stationary) root points
        
        /** @type {THREE.Vector3} */
        let pivot       = this.rootA.clone().add(this.rootB).multiplyScalar(0.5);
        /** @type {THREE.Vector3} */
        let translation = pivot.clone().sub(this.curA.clone().add(this.curB).multiplyScalar(0.5));
        /** @type {THREE.Quaternion} */
        let rotation = new THREE.Quaternion().setFromUnitVectors(
            this.curB .clone().sub(this.curA) .normalize(),
            this.rootB.clone().sub(this.rootA).normalize());
            //Vector3.Scale(new Vector3(1, horizontalRotation ? 0 : 1.0, 1.0), this.curB  - this. curA),
            //Vector3.Scale(new Vector3(1, horizontalRotation ? 0 : 1.0, 1.0), this.rootB - this.rootA));

        let scale = (this.rootA.clone().sub(this.rootB)).length() / 
                    (this.curA .clone().sub(this. curB)).length();

        // Apply Translation
        this.world.camera.parent.position.add(translation);

        if (this.rootA.x !== this.rootB.x) {
          // Apply Rotation
          this.Pivot(this.world.camera.parent.position,
            this.world.camera.parent.quaternion, pivot, rotation);

          // Apply Scale about Pivot
          if (!isNaN(scale) && this.enableScaling) {
            this.world.camera.parent.position.sub(pivot).multiplyScalar(scale).add(pivot);
            this.world.camera.parent.scale.multiplyScalar(scale);
          }
        }

        this.world.camera.parent.updateWorldMatrix(true, true);
    }

    /** Ambidextrous function for handling one-handed pinch movement with momentum. 
     * @param {THREE.Object3D} thisPinch @param {boolean} thisIsPinching
     * @param {boolean} otherIsPinching @param {THREE.Vector3} thisRoot
     * @param {THREE.Vector3} thisCur @param {THREE.Vector3} otherRoot
     * @param {THREE.Vector3} otherCur */
    oneHandedPinchMove(thisPinch, thisIsPinching, otherIsPinching, thisRoot, thisCur, otherRoot, otherCur) {
      thisPinch.getWorldPosition(thisCur);

      if (!thisIsPinching || otherIsPinching) {
        this.residualMomentum = otherCur.clone().sub(otherRoot);
        thisRoot.copy(thisCur);
      } else {
        otherCur.copy((otherRoot.clone().add(thisCur.clone().sub(thisRoot))).clone().add(this.residualMomentum));
      }
      this.residualMomentum.multiplyScalar(1.0 - this.momentum);
  }
  
  /** Pivots the original position and quaternion about another point + quaternion
   * @param {THREE.Vector3} position @param {THREE.Quaternion} quaternion 
   * @param {THREE.Vector3} pivotPoint @param {THREE.Quaternion} pivotQuaternion */
  Pivot(position, quaternion, pivotPoint, pivotQuaternion) {
    position.sub(pivotPoint).applyQuaternion(pivotQuaternion).add(pivotPoint);
    quaternion.premultiply(pivotQuaternion);
  }

}

export { LeapPinchLocomotion };
