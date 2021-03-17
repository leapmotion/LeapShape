/**
 * This is the CAD Engine entrypoint for LeapShape;
 * all CAD Operations are managed through here.
 */
class LeapShapeEngine {
    /** Initializes the CAD Worker Thread and Callback System */
    constructor() {
        // Initialize the OpenCascade Worker Thread
        this.worker = new Worker(new URL( './Backend/mainWorker.js', import.meta.url ), { type: "module" });

        // Ping Pong Messages Back and Forth based on their registration in messageHandlers
        this.messageHandlers = {};
        this.worker.onmessage = (e) => {
            if(e.data.type in this.messageHandlers){
                let response = this.messageHandlers[e.data.type](e.data.payload);
                if (response) { this.worker.postMessage({ "type": e.data.type, payload: response }) };
            }
        }
        this.registerCallback("startupCallback", () => { console.log("Worker Started!"); });
    }

    /** Registers a callback from the Worker Thread 
     * @param {string} name Name of the callback
     * @param {function} callback The Callback to Execute */
    registerCallback(name, callback) { this.messageHandlers[name] = callback; }
}

export { LeapShapeEngine };
