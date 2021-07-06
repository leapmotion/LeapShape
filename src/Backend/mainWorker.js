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

// Leave these next 4 lines exactly as they are.  The comments are toggled for ESBuild
//import url from "../../node_modules/opencascade.js/dist/opencascade.wasm.wasm";
//import opencascade from '../../node_modules/opencascade.js/dist/opencascade.full.js';
//importScripts('./OpenCascadeMesher.js');
import opencascade from '../../node_modules/opencascade.js/dist/opencascade.full.js';
import { OpenCascadeMesher } from './OpenCascadeMesher.js';

/** This is the CAD Engine Worker Thread, where all the real work happens */
class LeapShapeEngineWorker {
    
    constructor() {
        this.shapes = {};
        this.resolution = 0.0025;
        this.backendFunctions = {};

        // Initialize the WebAssembly Module
        new opencascade({
            locateFile(path) {
                if (path.endsWith('.wasm')) {
                    return (typeof ESBUILD !== 'undefined') ? "."+url : "../../node_modules/opencascade.js/dist/opencascade.full.wasm";
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

            // Capture Errors
            self.addEventListener('error', (event) => { this.postError(event); });
            self.realConsoleError = console.error;
            console.error = this.fakeConsoleError.bind(this);

            // Set up a persistent Meshing System
            this.mesher = new OpenCascadeMesher(this.oc);
        });
    }

    /** Executes a CAD operation from the Main Thread 
     * @param {{name: string, shapeFunction: function, shapeArguments: number[], meshDataCallback: function}} payload */
    execute(payload) {
        // Cache Backend Execution Functions to save on memory
        if (!(payload.shapeFunction in this.backendFunctions)) {
            this.safari = /(Safari|iPhone)/g.test(navigator.userAgent) && ! /(Chrome)/g.test(navigator.userAgent);
            this.backendFunctions[payload.shapeFunction] =
                new Function("return " + (this.safari ? "" : "function ") + payload.shapeFunction)().bind(this);
        }
        let op = this.backendFunctions[payload.shapeFunction];
        
        let shape = null;
        try {
            shape = op(...payload.shapeArguments);
            if (shape && shape.isMetadata) {
                // Return the output raw if it's marked as data
                return { name: payload.name, payload: shape };
            } else {
                // Otherwise Convert the Shape to a Mesh + Metadata
                if (!shape || shape.IsNull()) { console.error("Shape is null"); console.error(shape); }
                let meshData = this.mesher.shapeToMesh(shape, this.resolution, {}, {});
                if (meshData) { this.shapes[payload.name] = shape; }
                return { name: payload.name, payload: meshData };
            }
        } catch (e) {
            console.error("CAD Operation Failed!");
            return { name: payload.name, payload: null };
        }
    }

    /** Posts an error message back to the main thread
     * @param {ErrorEvent} event */
    postError(event) {
        let path = event.filename.split("/");
        postMessage({
            "type": "error", payload:
                (path[path.length - 1] + ":" + event.lineno + " - " + event.message)
        });
    }

    fakeConsoleError(...args) {
        if (args.length > 0) {
            postMessage({ "type": "error", payload: args[0] });
        }
        self.realConsoleError.apply(console, arguments);
    }
}

// Initialize the worker as the top-level entrypoint in this scope
var worker = new LeapShapeEngineWorker();
