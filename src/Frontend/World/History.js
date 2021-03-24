import * as THREE from '../../../node_modules/three/build/three.module.js';

/** With every action, an object and its anti-object are created. The two are time-reversals of each other.
 *  When a shape is created into the "shapeObjects", its symmetric "Remove-" shape is added to "undoObjects"
 *  When it is undone, the shape is moved to "redoObjects" and the "Remove-" shape is destroyed.
 *  When it is redone, the shape is moved back to "shapeObjects", and a "Remove-" shape is added to "undoObjects" all over again.
 *  If an object with equivalent name already exists, then it is replaced, and the older object is banished to its shadow realm.
 *  This is the cycle.  Of Birth and Destruction.  Change and Stagnation.  The flow and ebb of time.  This is the Undo/Redo system. */
class History {
    
    /** Initialize the Modelling History + Undo/Redo Shortcuts
     * @param {World} world */
    constructor(world) {
        // Store a reference to the World
        this.world = world;

        this.shapeObjects = new THREE.Group();
        this.undoObjects  = new THREE.Group();
        this.redoObjects  = new THREE.Group();
        this.removeCmd = "Remove-";

        this.world.scene.add(this.shapeObjects);

        // Handle Keyboard events
        window.addEventListener("keydown", event => {
            if (event.isComposing || event.keyCode === 229) { return; }
            if (event.ctrlKey || event.metaKey) {
                if (event.key == "z") { this.Undo(); }
                if (event.key == "y") { this.Redo(); }
            }
        });
    }

    Undo() { if (this.undoObjects.children.length > 0) { this.processDoCommand( this.shapeObjects, this.undoObjects, this.redoObjects); } }
    Redo() { if (this.redoObjects.children.length > 0) { this.processDoCommand( this.shapeObjects, this.redoObjects, this.undoObjects); } }

    /** Dequeue a do element, and queue its reverse into the ...reverse queue
     * @param {THREE.Object3D} drawingLayer 
     * @param {THREE.Object3D} commandLayer
     * @param {THREE.Object3D} reverseLayer */ 
    processDoCommand(drawingLayer, commandLayer, reverseLayer) {
        let command = commandLayer.children[commandLayer.children.length - 1];
        if (command) {
            // If this item's name starts with the removeCmd...
            if (command.name.startsWith(this.removeCmd)) {
                // Find this item and "delete" it...
                let condemnedName = command.name.substring(this.removeCmd.length);
                let condemnedStroke = null;
                for (let i = 0; i < drawingLayer.children.length; i++){
                    if (drawingLayer.children[i].name == condemnedName) { condemnedStroke = drawingLayer.children[i]; }
                }
                if (condemnedStroke) {
                    //condemnedStroke.parent.remove(condemnedStroke);
                    reverseLayer.add(condemnedStroke);
                } else {
                    console.error("Undo/Redo History is corrupt; " +
                        "couldn't find " + condemnedName + " to delete it...");
                }
                //commandLayer.length = commandLayer.length - 1;
                commandLayer.remove(command);
            } else {
                // Check and see if this item already exists
                let strokeToReplace = null; let i = 0;
                for (i = 0; i < drawingLayer.children.length; i++){
                    if (drawingLayer.children[i].name == command.name) { strokeToReplace = drawingLayer.children[i]; }
                }
                if (strokeToReplace) {
                    // If it *does* exist, just replace it
                    let parent = strokeToReplace.parent;
                    //strokeToReplace.parent.remove(strokeToReplace);
                    reverseLayer.add(strokeToReplace);
  
                    // Use 'replaceWith' to preserve layer order!
                    parent.add(command);
                    //drawingLayer.children[i] = command;
                } else {
                    // If it does not exist, create it
                    //this.world.scene.add(command);
                    drawingLayer.add(command);
  
                    let removeCommand = new THREE.Group();
                    removeCommand.name = this.removeCmd + command.name;
                    reverseLayer.add(removeCommand);
                }
            }
        }
    }

    /** Store this item's current state in the Undo Queue 
     * @param {Object3D} item Object to add into the scene
     * @param {toReplace} toReplace Object to replace with item 
    */
    addToUndo(item, toReplace) {
        if (toReplace) {
            this.undoObjects.add(toReplace);
            item.name = toReplace.name;
        }else{
            let removeCommand = new THREE.Group();
            removeCommand.name = this.removeCmd + item.name;
            this.undoObjects.add(removeCommand);
        }

        this.shapeObjects.add(item);

        console.log("Shape Objects: ", this.shapeObjects.children);
        console.log("Undo Objects:  ", this. undoObjects.children);
        console.log("Redo Objects:  ", this. redoObjects.children);

        // Clear the redo "history" (it's technically invalid now...)
        this.ClearRedoHistory();
    }

    /** Store this item's current state in the Undo Queue */
    createItemStateForUndo(item) {
        // If an object doesn't have a good name, give it one :)
        if (!item.name.includes("#")) {
            item.name = "#-" + item.id;
        }
        let removeCommand = new THREE.Group();
        removeCommand.name = this.removeCmd + item.name;
        this.undoObjects.add(removeCommand);

        this.shapeObjects.add(item);

        // Clear the redo "history" (it's technically invalid now...)
        this.ClearRedoHistory();
    }

    /** Store this item's current state in the Undo Queue */
    saveItemStateForUndo(item) {
        // If an object doesn't have a good name, give it one :)
        if (!item.name.includes("#")) {
            item.name = "#-" + item.id;
        }
        this.undoObjects.add(item);

        // Clear the redo "history" (it's technically invalid now...)
        this.ClearRedoHistory();
    }

    /** Clear the Redo Queue */
    ClearRedoHistory() { this.redoObjects.clear(); }
    /** Clear the Undo Queue */
    ClearUndoHistory() { this.undoObjects.clear(); }
    /** Undo all actions up to this point (can be redone individually) */
    ClearAll() {
      for (let i = 0; i < this.undoObjects.length; i++) { Undo(); }
    }

}

export { History };
