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
import "../../../node_modules/leapjs/leap-1.1.1.js";
import { World } from '../World/World.js';

/** This resamples HMD Transforms to the moment the tracking frame was captured.  
 * This eliminates swim when the user shakes their head but holds their hands still. */
class LeapTemporalWarping {
    /** This resamples HMD Transforms to the moment the tracking frame was captured.  
     * This eliminates swim when the user shakes their head but holds their hands still.
     * @param {World} world */
    constructor(world, interpolator) {
        this.world = world;
        this.interpolator = interpolator;

        this.nowToLeapOffsetUS = 0;
        this.historyLength = 20;
        this.history = new window.Leap.CircularBuffer(20);

        this.interpolatedFrame = {
            timestamp : 0,
            position  : this.world.camera.position  .clone(),
            quaternion: this.world.camera.quaternion.clone() 
        };

        // Temporary Swap Variables
        this.vec = new THREE.Vector3(); this.vec2 = new THREE.Vector3(); this.vec3 = new THREE.Vector3();
        this.quat = new THREE.Quaternion(); this.quat2 = new THREE.Quaternion();
        this.mat1 = new THREE.Matrix4(); this.mat2 = new THREE.Matrix4();
    }

    /** Adds new element to the history and resamples the current time matrix. */
    update() {
        this.currentTimestamp = (this.world.now * 1000) + this.interpolator.nowToLeapOffsetUS;

        // Add a new Head Transform to the history
        this.addFrameToHistory(this.currentTimestamp);
        // Sample a head transform from this time, 40ms ago
        return this.getInterpolatedFrame(this.interpolatedFrame, this.history, this.currentTimestamp - 40000);
    }

    /** Accumulate the current head transform into the history
     * @param {number} currentTimestamp */
    addFrameToHistory(currentTimestamp) {
        if (this.history.get(this.historyLength - 1)) {
            let sample = this.history.get(this.historyLength - 1);
            sample.timestamp = currentTimestamp;
            sample.position  .copy(this.world.camera.position  );
            sample.quaternion.copy(this.world.camera.quaternion);
            this.history.push(sample);
        } else {
            this.history.push({
                timestamp : currentTimestamp,
                position  : this.world.camera.position  .clone(),
                quaternion: this.world.camera.quaternion.clone()
            });
        }
    }

    /** Interpolates a frame to the given timestamp 
     * @param {number} timestamp */
    getInterpolatedFrame(frame, history, timestamp) {
        // Step through time until we have the two frames we'd like to interpolate between.
        let back = 0, doubleBack = 1;
        let aFrame = history.get(back+doubleBack) || this.interpolatedFrame;
        let bFrame = history.get(back);
        while (aFrame && aFrame.timestamp === bFrame.timestamp && doubleBack < 10) {
            doubleBack += 1; aFrame = history.get(back + doubleBack);
        }
        while (aFrame && bFrame &&
              (!(bFrame.timestamp < timestamp ||
                (aFrame.timestamp < timestamp && bFrame.timestamp > timestamp) ||
                back == 198))) { // Only 200 entries in the history buffer
            back++;
            doubleBack = 1;
            aFrame = history.get(back+doubleBack);
            bFrame = history.get(back           );
            while (aFrame && aFrame.timestamp === bFrame.timestamp && doubleBack < 10) {
                doubleBack += 1; aFrame = history.get(back + doubleBack);
            }
        }

        if (aFrame && bFrame) {
            let aTimestamp = aFrame.timestamp, bTimestamp = bFrame.timestamp;
            let alpha = (timestamp - aTimestamp) / (bTimestamp - aTimestamp);

            // Debug visualize the temporal offset
            //this.world.parent.tools.cursor.updateTarget(this.vec.set(0,0,0)); 
            //this.world.parent.tools.cursor.updateLabel(timestamp - aTimestamp);//this.nowToLeapOffsetUS);

            frame.timestamp = this.lerp(aTimestamp, bTimestamp, alpha);
            frame.position.lerpVectors(aFrame.position, bFrame.position, alpha);
            frame.quaternion.slerpQuaternions(aFrame.quaternion, bFrame.quaternion, alpha);
        }
        return frame;
    }

    /** Linearly Interpolate `a` to `b` by `alpha`
     * @param {number} a @param {number} b @param {number} alpha @returns {number} */
    lerp(a, b, alpha) { return (a * (1 - alpha)) + (b * alpha); }

}

export { LeapTemporalWarping };
