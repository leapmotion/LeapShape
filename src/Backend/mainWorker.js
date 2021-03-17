import opencascade from '../../node_modules/opencascade.js/dist/opencascade.wasm.js';

/** This is the CAD Engine Worker Thread, where all the real work happens */
class LeapShapeEngineWorker {
    
    constructor() {
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
                let response = this.messageHandlers[e.data.type](e.data.payload);
                if (response) { postMessage({ "type": e.data.type, payload: response }); };
            }
          
            // Send a message back to the main thread saying everything is a-ok...
            postMessage({ type: "startupCallback" });
        });
    }
}

//export { LeapShapeEngine };
new LeapShapeEngineWorker();
