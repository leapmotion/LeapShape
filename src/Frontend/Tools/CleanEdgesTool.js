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

/** This class controls all of the CleanEdgesTool behavior */
class CleanEdgesTool {

    /** Create the CleanEdgesTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;
        this.oc = oc; this.shapes = {};

        this.state = -1; // -1 is Deactivated
        this.numEdgeCleanings = 0;

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ((typeof ESBUILD !== 'undefined') ? './textures/CleanEdges.png' : '../../../textures/CleanEdges.png' );
        this.descriptor = {
            name: "Clean Edges Tool",
            icon: this.icon
        }
    }

    activate() {
        // Get Selected Objects
        this.selected = this.tools.tools[0].selected;
        this.tools.tools[0].clearSelection();

        // Clean the Edges of Each Selected Object Individually
        for (let i = 0; i < this.selected.length; i++) {
            this.createCleanEdgesGeometry(this.selected[i]);
            this.numEdgeCleanings += 1;
        }

        this.deactivate();
    }

    deactivate() {
        this.state = -1;
        this.tools.activeTool = null;
    }

    /** Update the CleanEdgesTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) { return; }

    /** @param {THREE.Mesh} shapeToCleanEdges */
    createCleanEdgesGeometry(shapeToCleanEdges) {
        let shapeName = "CleanEdges #" + this.numEdgeCleanings;
        this.engine.execute(shapeName, this.createCleanEdges, [shapeToCleanEdges.shapeName],
            (mesh) => {
                if (mesh) {
                    mesh.name = shapeName;
                    mesh.shapeName = shapeName;
                    this.tools.tools[0].toggleSelection(mesh); // Select the cleaned object

                    // Creation of this Cleaned Edges Object
                    this.world.history.addToUndo(mesh, shapeToCleanEdges, "Clean Edges");
                }
                this.world.dirty = true;
            });
    }

    /** Clean the Edges of this Shape in OpenCascade; to be executed on the Worker Thread */
    createCleanEdges(shapeName) {
        if (shapeName in this.shapes) {
            let fusor = new this.oc.ShapeUpgrade_UnifySameDomain(this.shapes[shapeName], true, true);
            fusor.Build();
            return fusor.Shape();
        }
    }

    /** Whether or not to show this tool in the menu */
    shouldShow() { return this.tools.tools[0].selected.length >= 1; }
}

export { CleanEdgesTool };
