import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';
import { snapToGrid } from './ToolUtils.js';

/** This class controls all of the UnionTool behavior */
class UnionTool {

    /** Create the UnionTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;
        this.oc = oc; this.shapes = {};

        this.state = -1; // -1 is Deactivated
        this.numUnions = 0;

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ('../../../textures/Union.png' );
        this.descriptor = {
            name: "Union Tool",
            icon: this.icon
        }
    }

    activate() {
        // Get Selected Objects
        this.selected = this.tools.tools[0].selected;
        if (this.selected.length > 1) {
            this.selectedShapes = [];
            for (let i = 0; i < this.selected.length; i++) {
                this.selectedShapes.push(this.selected[i].shapeName);
            }

            this.createUnionGeometry(this.selected, [this.selectedShapes]);
            this.numUnions += 1;
        }

        this.deactivate();
    }

    deactivate() {
        this.state = -1;
        this.tools.activeTool = null;
    }

    /** Update the UnionTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) { return; }

    /** @param {THREE.Mesh[]} unionMeshes */
    createUnionGeometry(unionMeshes, createUnionArgs) {
        let shapeName = "Union #" + this.numUnions;
        this.engine.execute(shapeName, this.createUnion, createUnionArgs,
            (mesh) => {
                if (mesh) {
                    mesh.name = shapeName;
                    mesh.shapeName = shapeName;
                    this.tools.tools[0].clearSelection();

                    for (let s = 0; s < unionMeshes.length; s++){
                        this.world.history.removeShape(unionMeshes[s]);
                    }

                    this.world.history.addToUndo(mesh);
                }
                this.world.dirty = true;
            });
    }

    /** Create a Union in OpenCascade; to be executed on the Worker Thread */
    createUnion(unionObjects) {
        if (unionObjects.length >= 2) {
            let fused = false;
            let shape = this.shapes[unionObjects[0]];
            console.log(unionObjects);

            for (let i = 1; i < unionObjects.length; i++){
                let fuseTool = this.shapes[unionObjects[i]];

                console.log(shape, fuseTool);

                // Check to see if shape and fuseTool are touching
                //let overlapChecker = new this.oc.BRepExtrema_DistShapeShape(shape, fuseTool);
                //overlapChecker.Perform();

                //if (overlapChecker.InnerSolution()) {
                    let union = new this.oc.BRepAlgoAPI_Fuse(shape, fuseTool);
                    union.SetFuzzyValue(0.00001); union.Build();
                    shape = union.Shape();
                    fused = true;
                //}
            }

            return fused ? shape : null;
        }
    }

}

export { UnionTool };
