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
import { InteractionRay, Input } from './Input.js';

/** This is the standard mouse (and touchscreen?) input. */
class MouseInput {
    /** Initialize Mouse Capture
     * @param {World} world 
     * @param {Input} inputs  */
     constructor(world, inputs) {
        this.world = world; this.inputs = inputs;
        this.ray = new InteractionRay(new THREE.Ray());
        this.lastTimestep = performance.now();
        this.activeTime = 0;
        
        this.mouse = { x: 0, y: 0, buttons: -1 };
        this.world.container.addEventListener( 'pointermove', this._onContainerMouse.bind(this) );
        this.world.container.addEventListener( 'pointerdown', this._onContainerMouse.bind(this) );
        this.world.container.addEventListener( 'pointerup'  , this._onContainerMouse.bind(this) );
        this.world.container.addEventListener( 'wheel'      , this._onContainerMouse.bind(this) );
        this.prevButton = 0;
        this.up = new THREE.Vector3(0, 1, 0);

        this.mobile = /(Android|iPad|iPhone|iPod|Oculus)/g.test(navigator.userAgent);
    }

    /** Triggered whenever the mouse moves over the application
     * @param {PointerEvent} event */
    _onContainerMouse( event ) {
        event.preventDefault();
        let rect = event.target.getBoundingClientRect();
        this.mouse.x =   ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1;
        this.mouse.y = - ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1;
        this.mouse.buttons = event.buttons;
        this.world.dirty = true;
    }

    update() {
        if (this.isActive()) {
            // Add Extra Fields for the active state
            this.ray.justActivated = false; this.ray.justDeactivated = false;
            this.ray.active = this.mouse.buttons    === 1;
            if ( this.ray.active && this.prevButton === 0) { this.ray.justActivated   = true; this.activeTime = 0; }
            if (!this.ray.active && this.prevButton === 1) { this.ray.justDeactivated = true; }
            this.ray.hovering = false;
            this.prevButton = this.mouse.buttons;
            if (this.ray.active) { this.activeTime += performance.now() - this.lastTimestep; }
            this.ray.activeMS = this.activeTime;
            this.lastTimestep = performance.now();

            // Changes the cursor between the "Hovering" and "Passive" state
            this.world.container.style.cursor = this.ray.lastHovering ? "pointer" : "default";

            // Set Ray Origin and Direction
            this.ray.ray.origin.setFromMatrixPosition(this.world.camera.matrixWorld);

            // Point ray into sky when not touching on mobile
            if (this.mobile && !this.ray.active && !this.ray.justDeactivated) {
                this.ray.ray.direction.copy(this.up);
            } else {
                this.ray.ray.direction.set(this.mouse.x, this.mouse.y, 0.5)
                    .unproject(this.world.camera).sub(this.ray.ray.origin).normalize();
            }
        }
    }

    /** Does this input want to take control? */
    isActive() { return !(this.world.handsAreTracking || this.world.inVR); }

}

export { MouseInput };
