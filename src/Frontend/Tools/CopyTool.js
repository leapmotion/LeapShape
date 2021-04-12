import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
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
        this.numCopys = 0;

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
        if (this.selected.length === 1) {
            this.selectedShapes = [];
            for (let i = 0; i < this.selected.length; i++) {
                this.selectedShapes.push(this.selected[i].shapeName);
            }

            this.createCopyGeometry(this.selected, [this.selectedShapes]);
            this.numCopys += 1;
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
    createCopyGeometry(copyMeshes, createCopyArgs) {
        let shapeName = "Copy #" + this.numCopys;
        this.engine.execute(shapeName, this.createCopy, createCopyArgs,
            (mesh) => {
                if (mesh) {
                    mesh.name = shapeName;
                    mesh.shapeName = shapeName;
                    this.tools.tools[0].clearSelection();
                    this.tools.tools[0].toggleSelection(mesh); // Select the copied object

                    // Creation of the Final Composite Copied Object
                    this.world.history.addToUndo(mesh, null, "Copy Object");
                }
                this.world.dirty = true;
            });
    }

    /** Create a Copy in OpenCascade; to be executed on the Worker Thread */
    createCopy(copyObjects) {
        if (copyObjects.length >= 1) {
            let shape = this.shapes[copyObjects[0]];
            return shape;
        }
    }

    /** Whether or not to show this tool in the menu */
    shouldShow() { return this.tools.tools[0].selected.length === 1; }
}

export { CopyTool };
