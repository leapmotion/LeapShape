import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';
import { snapToGrid } from './General/ToolUtils.js';

/** This class controls all of the RemoveTool behavior */
class UndoTool {

    /** Create the RedoTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ((typeof ESBUILD !== 'undefined') ? './textures/Undo.png' : '../../../textures/Undo.png' );
        this.descriptor = {
            name: "Undo Tool",
            icon: this.icon
        }
    }

    activate() {
        this.world.history.Undo();
        this.deactivate();
    }

    deactivate() {
        this.tools.activeTool = null;
    }

    /** Update the RemoveTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) { return; }

    /** Whether or not to show this tool in the menu */
    shouldShow() { return this.world.inVR && this.world.history.undoObjects.children.length > 0; }
}

export { UndoTool };
