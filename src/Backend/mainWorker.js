import opencascade from '../../node_modules/opencascade.js/dist/opencascade.wasm.js';
import { OpenCascadeMesher } from './OpenCascadeMesher.js';

/** This is the CAD Engine Worker Thread, where all the real work happens */
class LeapShapeEngineWorker {
    
    constructor() {
        this.shapes = {};
        this.resolution = 0.75;

        // Initialize the WebAssembly Module
        new opencascade({
            locateFile(path) {
                if (path.endsWith('.wasm')) {
                    return "../../node_modules/opencascade.js/dist/opencascade.wasm.wasm";
                }
                return path;
            }
        }).then((openCascade) => {
            // Register the "OpenCascade" under the shorthand "this.oc"
            this.oc = openCascade;
          
            // Ping Pong Messages Back and Forth based on their registration in messageHandlers
            this.messageHandlers = {};
            onmessage = (e) => {
                if (e.data.type in this.messageHandlers) {
                    let response = this.messageHandlers[e.data.type](e.data.payload);
                    if (response) { postMessage({ "type": e.data.type, payload: response }); };
                }
            }
          
            // Send a message back to the main thread saying everything is a-ok...
            postMessage({ type: "startupCallback" });
            this.messageHandlers["execute"] = this.execute.bind(this);

            // Set up a persistent Meshing System
            this.mesher = new OpenCascadeMesher(this.oc);
        });
    }

    /** Executes a CAD operation from the Main Thread 
     * @param {{name: string, shapeFunction: function, shapeArguments: number[], meshDataCallback: function}} payload */
    execute(payload) {
        let op = new Function("return function " + payload.shapeFunction)().bind(this);
        let shape = op(...payload.shapeArguments);
        if (shape && !shape.IsNull()) { this.shapes[payload.name] = shape; } else { console.error("Shape is null"); console.error(shape); }
        let meshData = this.mesher.shapeToMesh(shape, this.resolution, {}, {});
        return { name: payload.name, payload: meshData };
    }
}

// Initialize the worker as the top-level entrypoint in this scope
var worker = new LeapShapeEngineWorker();
