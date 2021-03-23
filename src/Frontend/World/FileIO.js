import { LeapShapeEngine } from '../../Backend/main.js';
import { World } from './World.js';
import * as THREE from '../../../node_modules/three/build/three.module.js';
import { OBJExporter } from '../../../node_modules/three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from '../../../node_modules/three/examples/jsm/exporters/STLExporter.js';
import { GLTFExporter } from '../../../node_modules/three/examples/jsm/exporters/GLTFExporter.js';

/** This is the main File Saving/Loading Interface. */
class FileIO {
    
    /** Initialize File Saving/Loading Mechanisms + Shortcuts
     * @param {World} world
     * @param {LeapShapeEngine} engine */
    constructor(world, engine) {
        // Store a reference to the CAD Engine and World
        this.engine = engine;
        this.world = world;
        window.saveShapesOBJ = this.saveShapesOBJ.bind(this);
        window.saveShapesSTL = this.saveShapesSTL.bind(this);
        window.saveSceneGLTF = this.saveSceneGLTF.bind(this);

        window.addEventListener("keydown", event => {
            if (event.isComposing || event.keyCode === 229) { return; }
            if (event.ctrlKey || event.metaKey) {
                if (event.key == "s") { event.preventDefault(); this.saveShapesOBJ();  }
            }
        });
    }

    async getNewFileHandle(desc, mime, ext, open = false) {
        const options = {
          types: [{
              description: desc,
              accept: {
                [mime]: ['.' + ext],
              }}]};
        if (open) {
            return await window.showOpenFilePicker(options);
        } else {
            return await window.showSaveFilePicker(options);
        }
    }
    
    async writeFile(fileHandle, contents) {
        // Create a FileSystemWritableFileStream to write to.
        let writable = await fileHandle.createWritable();
        // Write the contents of the file to the stream.
        await writable.write(contents);
        // Close the file and write the contents to disk.
        await writable.close();
    }

    /**  Save the current scene shapes to .obj */
    async saveShapesOBJ() {
        this.objExporter = new OBJExporter();
        this.world.scene.traverseVisible(async (object) => {
            if (object.name.includes("#")) {
                let result = this.objExporter.parse(object);
                let fileHandle = await this.getNewFileHandle("OBJ files", "text/plain", "obj");
                this.writeFile(fileHandle, result).then(() => {
                    console.log("Saved OBJ to " + fileHandle.name);
                });
            }
        });
    }

    /**  Save the current scene shapes to .stl */
    async saveShapesSTL() {
        this.stlExporter = new STLExporter();
        this.world.scene.traverseVisible(async (object) => {
            if (object.name.includes("#")) {
                let result = this.stlExporter.parse(object, { binary: false });
                let fileHandle = await this.getNewFileHandle("STL files", "text/plain", "stl");
                this.writeFile(fileHandle, result).then(() => {
                    console.log("Saved STL to " + fileHandle.name);
                });
            }
        });
    }

    /**  Save the current scene to .gltf */
    async saveSceneGLTF() {
        this.gltfExporter = new GLTFExporter();
        this.gltfExporter.parse(this.world.scene, async (result) => {
            let fileHandle = await this.getNewFileHandle("GLTF files", "text/plain", "gltf");
            this.writeFile(fileHandle, JSON.stringify(result)).then(() => {
                console.log("Saved Full Scene GLTF to " + fileHandle.name);
            });
        }, { binary: false });
    }
}

export { FileIO };
