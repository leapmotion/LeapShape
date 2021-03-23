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

        this.shapeObjects = [];
        this.undoObjects  = [];
        this.redoObjects  = [];
        this.removeCmd = "Remove-";
    }

    Undo() { if (undoObjects.length > 0) { this.processDoCommand( shapeObjects, undoObjects, redoObjects); } }
    Redo() { if (redoObjects.length > 0) { this.processDoCommand( shapeObjects, redoObjects, undoObjects); } }

    // Dequeue a do element, and queue its reverse into the ...reverse queue
    processDoCommand(drawingLayer, commandLayer, reverseLayer) {
        let command = commandLayer[commandLayer.length - 1];
        if (command) {
            // If this item's name starts with the removeCmd...
            if (command.name.startsWith(removeCmd)) {
                // Find this item and "delete" it...
                let condemnedName = command.name.substring(removeCmd.length);
                let condemnedStroke = null;
                for (let i = 0; i < drawingLayer.length; i++){
                    if (drawingLayer[i].name == condemnedName) { condemnedStroke = drawingLayer[i]; }
                }
                if (condemnedStroke) {
                    condemnedStroke.parent.remove(condemnedStroke);
                    reverseLayer.push(condemnedStroke);
                } else {
                    console.error("Undo/Redo History is corrupt; " +
                        "couldn't find " + condemnedName + " to delete it...");
                }
                commandLayer.length = commandLayer.length - 1;
            } else {
                // Check and see if this item already exists
                let strokeToReplace = null; let i = 0;
                for (i = 0; i < drawingLayer.length; i++){
                    if (drawingLayer[i].name == command.name) { strokeToReplace = drawingLayer[i]; }
                }
                if (strokeToReplace) {
                    // If it *does* exist, just replace it
                    let parent = strokeToReplace.parent;
                    strokeToReplace.parent.remove(strokeToReplace);
                    reverseLayer.push(strokeToReplace);
  
                    // Use 'replaceWith' to preserve layer order!
                    parent.add(command);
                    drawingLayer[i] = command;
                } else {
                    // If it does not exist, create it
                    this.world.scene.add(command);
                    drawingLayer.push(command);
  
                    let removeCommand = { name: removeCmd + command.name };
                    reverseLayer.push(removeCommand);
                }
            }
        }
    }

    /** Store this item's current state in the Undo Queue */
    createItemStateForUndo(item) {
        // If an object doesn't have a good name, give it one :)
        if (!item.name.Contains("#")) {
            item.name = "#-" + item.GetHashCode();
        }
        this.undoObjects.push({ name: this.removeCmd + item.name });

        // Clear the redo "history" (it's technically invalid now...)
        this.ClearRedoHistory();
    }

    /** Store this item's current state in the Redo Queue */
    saveItemStateForUndo(item) {
        // If an object doesn't have a good name, give it one :)
        if (!item.name.Contains("#")) {
            item.name = "#-" + item.GetHashCode();
        }
        this.undoObjectParent.push(item);

        // Clear the redo "history" (it's technically invalid now...)
        ClearRedoHistory();
    }

    /** Clear the Redo Queue */
    ClearRedoHistory() { this.redoObjects = []; }
    /** Clear the Undo Queue */
    ClearUndoHistory() { this.undoObjects = []; }
    /** Undo all actions up to this point (can be redone individually) */
    ClearAll() {
      for (let i = 0; i < undoObjects.length; i++) { Undo(); }
    }

}

export { History };
