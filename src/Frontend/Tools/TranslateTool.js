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

/** This class controls all of the TranslateTool behavior */
class TranslateTool {

    /** Create the TranslateTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;
        this.oc = oc; this.shapes = {};

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ((typeof ESBUILD !== 'undefined') ? './textures/Translate.png' : '../../../textures/Translate.png' );
        this.descriptor = {
            name: "Translate Tool",
            icon: this.icon
        }
    }

    activate() {
        // Set the Transform Gizmo to Translation Mode
        this.tools.tools[0].gizmo.setMode( "translate" );

        this.deactivate();
    }

    deactivate() {
        this.tools.activeTool = null;
    }

    /** Update the TranslateTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) { return; }

    /** Whether or not to show this tool in the menu */
    shouldShow() { return this.tools.tools[0].selected.length >= 1; }
}

export { TranslateTool };
