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

import { LeapShapeEngine } from '../../Backend/main.js';
import { World } from './World.js';
import * as THREE from '../../../node_modules/three/build/three.module.js';
import * as oc from  '../../../node_modules/opencascade.js/dist/opencascade.full.js';
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
        this.mobile = /(Android|iPad|iPhone|iPod|Oculus)/g.test(navigator.userAgent) || this.safari;

        // Create General-Purpose Import Button
        this.createImportButton("Import File...");

        // Create Export Buttons
        this.createNavLink("Export to .GLTF", this.saveShapesGLTF);
        if (this.mobile && this.safari) {
            this.arLink = this.createNavLink("AR Preview", this.launchARiOS);
        } else {
            this.createNavLink("Export to .obj"  , this.saveShapesOBJ );
            this.createNavLink("Export to .stl"  , this.saveShapesSTL);
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

    /** Creates a NavBar Button for uploading files
     * @param {string} title */
    createImportButton(title) {
        //<label for="files" title="Import STEP, IGES, or (ASCII) STL from File">Import STEP/IGES/STL
        //  <input id="files" name="files" type="file" accept=".iges,.step,.igs,.stp,.stl" multiple style="display:none;" oninput="loadFiles();"/>
        //</label>

        let label = document.createElement("label");
        label.innerText = title;
        label.title = title;

        let input = document.createElement("input");
        input.id = "files";
        input.name = "files";
        input.type = "file";
        input.accept = ".iges,.step,.igs,.stp,.stl";
        input.multiple = true;
        input.style.display = "none";
        input.oninput = (e) => { this.loadFiles(e.target.files); }

        label.appendChild(input);
        label.for = "files";
        document.getElementById("topnav").appendChild(label);
        return label;
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


    // File Loading Interface

    /** This function synchronously loads a list of files into the scene.
     * @param {FileList} files */
    async loadFiles(files) {
        console.log("Importing Files...", files);
        for (let i = 0; i < files.length; i++) {
            let fileText = await files[i].text(); // TODO: Try reading the raw arraybuffers here...
            let isSTL = files[i].name.toLowerCase().includes(".stl");

            this.engine.execute(files[i].name, isSTL ? this.importSTLBackend : this.importSTEPorIGESBackend,
                [files[i].name, fileText], (mesh) => {
                    if (mesh) {
                        mesh.name = files[i].name;
                        mesh.shapeName = files[i].name;
                        this.world.history.addToUndo(mesh, null, "Import " + isSTL ? ".stl" : "CAD Shape");
                    }
                    this.world.dirty = true;
                });
        };
    }

    /** This function parses the ASCII contents of a `.STEP` or `.IGES` 
      * file as a Shape into the `externalShapes` dictionary. */
    importSTEPorIGESBackend(fileName, fileText) {
        // Writes the uploaded file to Emscripten's Virtual Filesystem
        this.oc.FS.createDataFile("/", fileName, fileText, true, true);

        // Choose the correct OpenCascade file parsers to read the CAD file
        let reader = null; let tempFilename = fileName.toLowerCase();
        if (tempFilename.endsWith(".step") || tempFilename.endsWith(".stp")) {
            reader = new this.oc.STEPControl_Reader();
        } else if (tempFilename.endsWith(".iges") || tempFilename.endsWith(".igs")) {
            reader = new this.oc.IGESControl_Reader();
        } else { console.error("opencascade.js can't parse this extension! (yet)"); }

        let readResult = reader.ReadFile(fileName);            // Read the file
        if (readResult === 1) {
            console.log(fileName + " loaded successfully!     Converting to OCC now...");
            reader.TransferRoots();                            // Translate all transferable roots to OpenCascade
            let stepShape = reader.OneShape();                 // Obtain the results of translation in one OCCT shape

            // Remove the file when we're done (otherwise we run into errors on reupload)
            this.oc.FS.unlink("/" + fileName);

            return stepShape;
        } else {
            console.error("Failed to Read " + fileName);
            return null;
        }
    }
  
    /** This function parses the contents of an ASCII .STL File as a Shape 
      * into the `externalShapes` dictionary. */
    importSTLBackend(fileName, fileText) {
        // Writes the uploaded file to Emscripten's Virtual Filesystem
        this.oc.FS.createDataFile("/", fileName, fileText, true, true);

        // Choose the correct OpenCascade file parsers to read the STL file
        var reader = new this.oc.StlAPI_Reader();
        let readShape = new this.oc.TopoDS_Shape();

        if (reader.Read(readShape, fileName)) {
            console.log(fileName + " loaded successfully!     Converting to OCC now...");

            // Remove the file when we're done (otherwise we run into errors on reupload)
            this.oc.FS.unlink("/" + fileName);

            // Convert Shell to Solid as is expected
            let solidSTL = new this.oc.BRepBuilderAPI_MakeSolid();
            readShape = new this.oc.TopoDS_Shape(readShape);
            solidSTL.Add(readShape);
            readShape = new this.oc.TopoDS_Shape(solidSTL.Solid());

            // Remove Internal Faces and Edges and Return
            let cleanSTL = new this.oc.ShapeUpgrade_UnifySameDomain(readShape, true, true);
            cleanSTL.Build();
            return cleanSTL.Shape();
        } else {
            console.error("Something in OCCT went wrong trying to read " + fileName + ".  \n" +
                "Cascade Studio only imports small ASCII .stl files for now!");
            return null;
        }
    }

}

export { FileIO };
