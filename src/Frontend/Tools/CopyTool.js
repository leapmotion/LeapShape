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
import { snapToGrid } from './General/ToolUtils.js';

/** This class controls all of the CopyTool behavior */
class CopyTool {

    /** Create the CopyTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;
        this.oc = oc; this.shapes = {};

        this.state = -1; // -1 is Deactivated
        this.numCopies = 0;

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ((typeof ESBUILD !== 'undefined') ? './textures/Copy.png' : '../../../textures/Copy.png' );
        this.descriptor = {
            name: "Copy Tool",
            icon: this.icon
        }
    }

    activate() {
        // Get Selected Objects
        this.selected = this.tools.tools[0].selected;
        this.tools.tools[0].clearSelection();

        // Copy Each Selected Object Individually
        for (let i = 0; i < this.selected.length; i++) {
            this.createCopyGeometry(this.selected[i].shapeName);
            this.numCopies += 1;
        }

        this.deactivate();
    }

    deactivate() {
        this.state = -1;
        this.tools.activeTool = null;
    }

    /** Update the CopyTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) { return; }

    /** @param {THREE.Mesh[]} copyMeshes */
    createCopyGeometry(shapeNameToCopy) {
        let shapeName = "Copy #" + this.numCopies;
        this.engine.execute(shapeName, this.createCopy, [shapeNameToCopy],
            (mesh) => {
                if (mesh) {
                    mesh.name = shapeName;
                    mesh.shapeName = shapeName;
                    this.tools.tools[0].toggleSelection(mesh); // Select the copied object

                    // Creation of this Copy Object
                    this.world.history.addToUndo(mesh, null, "Copy Object");
                }
                this.world.dirty = true;
            });
    }

    /** Create a Copy in OpenCascade; to be executed on the Worker Thread */
    createCopy(copyObjectName) {
        if (copyObjectName in this.shapes) { return this.shapes[copyObjectName]; }
    }

    /** Whether or not to show this tool in the menu */
    shouldShow() { return this.tools.tools[0].selected.length >= 1; }
}

export { CopyTool };
