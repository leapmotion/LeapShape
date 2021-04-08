import { LeapShapeEngine } from '../../Backend/main.js';
import { World } from './World.js';
import * as THREE from '../../../node_modules/three/build/three.module.js';
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

        // Record browser metadata...
        this.safari = /(Safari)/g.test( navigator.userAgent ) && ! /(Chrome)/g.test( navigator.userAgent );
        this.mobile = /(Android|iPad|iPhone|iPod)/g.test(navigator.userAgent) || this.safari;

        // Create Export Buttons
        this.createNavLink("Export to .GLTF", this.saveShapesGLTF);
        if (this.mobile && this.safari) {
            this.arLink = this.createNavLink("AR Preview", this.launchARiOS);
        } else {
            this.createNavLink("Export to .obj" , this.saveShapesOBJ );
            this.createNavLink("Export to .stl" , this.saveShapesSTL );
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
        // Scale to 1/1000th for iOS Quick Look
        this.objectToSave().scale.set(0.001, 0.001, 0.001);
        this.objectToSave().updateWorldMatrix(true, true);

        this.usdzExporter = new USDZExporter();
        let usdz = await this.usdzExporter.parse(this.objectToSave());
        let usdzURL = URL.createObjectURL(new Blob([usdz], { type: "model/vnd.usdz+zip" }));
        this.arLink.setAttribute('rel', 'ar');
        this.arLink.appendChild(document.createElement('img'));
        this.arLink.href = usdzURL;

        // Scale back to 1:1 for Editing
        this.objectToSave().scale.set(1.0, 1.0, 1.0);
        this.objectToSave().updateWorldMatrix(true, true);
    }
}

export { FileIO };
