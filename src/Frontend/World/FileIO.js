import { LeapShapeEngine } from '../../Backend/main.js';
import { World } from './World.js';
import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
import { OBJExporter } from '../../../node_modules/three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from '../../../node_modules/three/examples/jsm/exporters/STLExporter.js';
import { GLTFExporter } from '../../../node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { USDZExporter } from '../../../node_modules/three/examples/jsm/exporters/USDZExporter.js';

/** This is the main File Saving/Loading Interface. */
class FileIO {
    
    /** Initialize File Saving/Loading Mechanisms + Shortcuts
     * @param {World} world
     * @param {LeapShapeEngine} engine */
    constructor(world, engine) {
        // Store a reference to the CAD Engine and World
        this.engine = engine;
        this.world = world;
        this.oc = oc;

        // Record browser metadata...
        this.safari = /(Safari)/g.test( navigator.userAgent ) && ! /(Chrome)/g.test( navigator.userAgent );
        this.mobile = /(Android|iPad|iPhone|iPod)/g.test(navigator.userAgent) || this.safari;

        // Create Export Buttons
        this.createNavLink("Export to .GLTF", this.saveShapesGLTF);
        if (this.mobile && this.safari) {
            this.arLink = this.createNavLink("AR Preview", this.launchARiOS);
        } else {
            this.createNavLink("Export to .obj" , this.saveShapesOBJ );
            this.createNavLink("Export to .stl", this.saveShapesSTL);
            this.createNavLink("Export to .step" , this.saveShapesSTEP );
        }

        window.addEventListener("keydown", event => {
            if (event.isComposing || event.keyCode === 229) { return; }
            if (event.ctrlKey || event.metaKey) {
                if (event.key == "s") { event.preventDefault(); this.saveShapesOBJ();  }
            }
        });
    }

    /** Return all objects unless one object is selected. */
    objectToSave(){
        let toSave = this.world.history.shapeObjects;
        if (this.world.parent.tools.tools[0].selected.length === 1) {
            toSave = this.world.parent.tools.tools[0].selected[0];
        }
        return toSave;
    }

    /** Creates a NavBar Button
     * @param {string} title
     * @param {Function} callback */
    createNavLink(title, callback) {
        let link = document.createElement("a");
        link.innerText = title;
        link.title = title;
        link.href = "#";
        link.onmouseup = (e) => { callback.bind(this)(e); };
        document.getElementById("topnav").appendChild(link);
        return link;
    }

    /** Saves data to a file
     * @param {BufferSource|Blob|string} contents File Contents
     * @param {string} ext File Extension
     * @param {string} mime MIME Type
     * @param {string} desc Friendly File Picker Type */
    async writeFile(contents, ext, mime, desc) {
        // Use new api's if you've got 'em (Chrome Desktop)
        if (window.showSaveFilePicker) {
            let options = { types: [{ description: desc, accept: { [mime]: ['.' + ext], } }] };
            let fileHandle = await window.showSaveFilePicker(options);
            let writable   = await fileHandle.createWritable();
            await writable.write(contents);
            await writable.close();
        } else {
            // Else (Firefox, Safari, Mobile) save via the old school URI Method
            let link = document.createElement("a");
            link.download = "LeapShape."+ext;
            //link.href = "data:" + mime + ";utf8," + encodeURIComponent(contents);
            link.href = URL.createObjectURL(new Blob([contents], { type: mime }));
            link.click();
        }
    }

    /**  Save the current scene shapes to .obj */
    async saveShapesOBJ() {
        this.objExporter = new OBJExporter();
        let result = this.objExporter.parse(this.objectToSave());
        await this.writeFile(result, "obj", "text/plain", "OBJ files").then(() => {
            console.log("Saved OBJ");
        });
    }

    /**  Save the current scene shapes to .stl */
    async saveShapesSTL() {
        this.stlExporter = new STLExporter();
        let result = this.stlExporter.parse(this.objectToSave(), { binary: false });
        await this.writeFile(result, "stl", "text/plain", "STL files").then(() => {
            console.log("Saved STL");
        });
    }

    /**  Save the current scene to .gltf */
    async saveShapesGLTF() {
        this.gltfExporter = new GLTFExporter();
        this.gltfExporter.parse(this.objectToSave(), async (result) => {
            let gltf = JSON.stringify(result, null, 2);
            this.writeFile(gltf, "gltf", "text/plain", "GLTF files").then(() => {
                console.log("Saved GLTF");
            });
        }, { binary: false });
    }

    async launchARiOS() {
        this.objectToSave().updateWorldMatrix(true, true);

        this.usdzExporter = new USDZExporter();
        let usdz = await this.usdzExporter.parse(this.objectToSave());
        let usdzURL = URL.createObjectURL(new Blob([usdz], { type: "model/vnd.usdz+zip" }));
        this.arLink.setAttribute('rel', 'ar');
        this.arLink.appendChild(document.createElement('img'));
        this.arLink.href = usdzURL;

        this.objectToSave().updateWorldMatrix(true, true);
    }

    /**  Save the current scene or shape */
    async saveShapesSTEP() {
        let toSave = this.objectToSave(); let shapeNames = [];
        if (toSave.shapeName) {
            shapeNames.push(toSave.shapeName);
        } else {
            for (let i = 0; i < toSave.children.length; i++){
                shapeNames.push(toSave.children[i].shapeName);
            }
        }

        this.engine.execute("SaveSTEP", this.saveShapeSTEPBackend, [shapeNames], (metadata) => {
            if (metadata && metadata.stepFileText) {
                this.writeFile(metadata.stepFileText, "step", "application/STEP", "STEP files").then(() => {
                    console.log("Saved STEP");
                });
            } else {
                console.error("Returned metadata does not contain the STEP File!");
            }
        });
    }

    /** This function returns the `.STEP` file content of the shapeNames array.  */
    saveShapeSTEPBackend(shapeNames) {
        let toReturn = { isMetadata: true };
        let writer = new this.oc.STEPControl_Writer();
        let filename = "LeapShapePart - "+Math.random()+".step";
        // Convert to a .STEP File
        let transferResult = writer.Transfer(this.shapes[shapeNames[0]], 0);
        if (transferResult === 1) {
            // Write the STEP File to the virtual Emscripten Filesystem Temporarily
            let writeResult = writer.Write(filename);
            if (writeResult === 1) {
                // Read the STEP File from the filesystem and clean up
                toReturn.stepFileText = this.oc.FS.readFile("/" + filename, { encoding: "utf8" });
                this.oc.FS.unlink("/" + filename);
            }else{
                console.error("WRITE STEP FILE FAILED.");
            }
        }else{
            console.error("TRANSFER TO STEP WRITER FAILED.");
        }
        return toReturn;
    }
}

export { FileIO };
