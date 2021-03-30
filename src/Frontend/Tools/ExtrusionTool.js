import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';
import { createDitherDepthMaterial } from './ToolUtils.js';

/** This class controls all of the ExtrusionTool behavior */
class ExtrusionTool {

    /** Create the ExtrusionTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;
        this.oc = oc; this.shapes = {};

        this.state = -1; // -1 is Deactivated
        this.numExtrusions = 0;
        this.distance = 1;
        this.point = new THREE.Vector3();
        this.rayPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000, 1000),
                                       new THREE.MeshBasicMaterial());

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ('../../../textures/Extrusion.png' );
        this.descriptor = {
            name: "Extrusion Tool",
            icon: this.icon
        }

        // All Extrusion handles are children of this
        this.handleParent = new THREE.Group();
        this.world.scene.add(this.handleParent);

        // Create a pool of extrusion handles which can be assigned to faces in the scene
        this.handles = [];
    }

    /** Spawn Extrusion Handles on each flat face */
    activate() {
        if (this.tools.activeTool) { this.tools.activeTool.deactivate(); }
        this.state = 0;
        this.tools.activeTool = this;

        // Place Extrusion Handles
        let curArrow = 0;
        for (let i = 0; i < this.world.history.shapeObjects.children.length; i++) {
            for (let j = 0; j < this.world.history.shapeObjects.children[i].faceMetadata.length; j++) {
                let faceData = this.world.history.shapeObjects.children[i].faceMetadata[j];

                if (curArrow >= this.handles.length) {
                    let dir = new THREE.Vector3( 1, 2, 0 ).normalize();
                    let origin = new THREE.Vector3( 0, 0, 0 );
                    this.handles.push(new THREE.ArrowHelper( dir, origin, 30, 0x00ffff ));
                }

                if (faceData.is_planar && curArrow < this.handles.length) {
                    this.handles[curArrow].position.set(faceData.average[0], faceData.average[1], faceData.average[2]);
                    let normal = new THREE.Vector3(faceData.normal[0], faceData.normal[1], faceData.normal[2]);
                    this.handles[curArrow].setDirection(normal);
                    this.handles[curArrow].setLength( 30, 10, 10 );
                    this.handles[curArrow].faceIndex = faceData.index;
                    this.handles[curArrow].parentObject = this.world.history.shapeObjects.children[i];
                    this.handles[curArrow].extrusionDirection = normal;

                    this.handleParent.add(this.handles[curArrow++]);
                }
            }
        }
    }

    deactivate() {
        this.state = -1;
        this.tools.activeTool = null;
        if (this.currentExtrusion && this.currentExtrusion.parent) {
            this.currentExtrusion.parent.remove(this.currentExtrusion);
        }
        for (let i = 0; i < this.handles.length; i++) {
            this.handleParent.remove(this.handles[i]);
        }
    }

    /** Update the ExtrusionTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) {
        if (ray.alreadyActivated || this.state === -1) {
            return; // Tool is currently deactivated
        } else if(this.state === 0) {
            // Wait for the ray to be active and pointing at a drawable surface
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObject(this.handleParent, true);

            if (ray.active && intersects.length > 0) {
                this.hit = intersects[0].object.parent;
                console.log(this.hit);

                // Spawn the Extrusion Preview
                //let curMaterial = createDitherDepthMaterial(this.world, new THREE.MeshPhongMaterial({ wireframe: false, fog: false }));
                this.currentExtrusion = new THREE.Mesh();
                //this.currentExtrusion.material.color.setRGB(0.5, 0.5, 0.5);
                //this.currentExtrusion.material.emissive.setRGB(0, 0.25, 0.25);
                //this.currentExtrusion.name = "Extrusion #" + this.numExtrusions;
                //this.currentExtrusion.position.copy(this.hit.point);
                //this.currentExtrusion.quaternion.copy(new THREE.Quaternion()
                //    .setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.worldNormal));
                //this.point.copy(this.hit.point);
                this.world.scene.add(this.currentExtrusion);

                ray.alreadyActivated = true;

                this.state += 1;
            }
        } else if(this.state === 1) {
            // Resize the Height while dragging
            let upperSegment = this.hit.extrusionDirection.clone().multiplyScalar( 1000.0).add(this.point);
            let lowerSegment = this.hit.extrusionDirection.clone().multiplyScalar(-1000.0).add(this.point);
            let pointOnRay = new THREE.Vector3(), pointOnSegment = new THREE.Vector3();
            let sqrDistToSeg = ray.ray.distanceSqToSegment(lowerSegment, upperSegment, pointOnRay, pointOnSegment);
            this.height = pointOnSegment.sub(this.hit.position).dot(this.hit.extrusionDirection);
            //this.currentExtrusion.position.copy(this.hit.extrusionDirection.clone()
            //    .multiplyScalar(this.height / 2.0).add(this.point));
            //this.currentExtrusion.scale.y = this.height;
            //this.currentExtrusion.material.emissive.setRGB(
            //    this.height > 0 ? 0.0  : 0.25,
            //    this.height > 0 ? 0.25 : 0.0 , 0.0);
            ray.alreadyActivated = true;

            // When let go, deactivate and add to Undo!
            if (!ray.active) {
                console.log(this.height);
                this.createExtrusionGeometry(this.currentExtrusion,
                    [this.hit.extrusionDirection.x, this.hit.extrusionDirection.y, this.hit.extrusionDirection.z,
                        this.height, this.hit.faceIndex, this.hit.parentObject.shapeName]);

                this.numExtrusions += 1;
                this.currentExtrusion = null;
                this.deactivate();
            }
        }
    }

    /** @param {THREE.Mesh} extrusionMesh */
    createExtrusionGeometry(extrusionMesh, createExtrusionArgs) {
        let shapeName = "Extrusion #" + this.numExtrusions;
        this.engine.execute(shapeName, this.createExtrusion, createExtrusionArgs,
            (geometry, faceMetadata) => {
                if (geometry) {
                    extrusionMesh.geometry.dispose();
                    extrusionMesh.position.set(0, 0, 0);
                    extrusionMesh.scale.set(1, 1, 1);
                    extrusionMesh.quaternion.set(0, 0, 0, 1);
                    extrusionMesh.geometry = geometry;
                    extrusionMesh.material = new THREE.MeshPhongMaterial({ wireframe: false });
                    extrusionMesh.material.color.setRGB(0.5, 0.5, 0.5);
                    extrusionMesh.shapeName = shapeName;
                    extrusionMesh.faceMetadata = faceMetadata;

                    if (this.hit.parentObject.name.includes("#")) {
                        this.world.history.addToUndo(extrusionMesh, this.hit.parentObject);
                        this.hit = null;
                    } else {
                        this.world.history.addToUndo(extrusionMesh);
                    }
                } else {
                    // Operation Failed, remove preview
                    extrusionMesh.parent.remove(extrusionMesh);
                }
                this.world.dirty = true;
            });
    }

    /** Create a Extrusion in OpenCascade; to be executed on the Worker Thread */
    createExtrusion(nx, ny, nz, height, faceIndex, hitObjectName) {
        if (height != 0) {
            let hitObject = this.shapes[hitObjectName];

            // Change the Extrusion Extension direction based on the height
            nx *= height; ny *= height; nz *= height;

            // Get a reference to the face to extrude
            let face = null; let face_index = 0;
            let anExplorer = new this.oc.TopExp_Explorer(hitObject, this.oc.TopAbs_FACE);
            anExplorer.Init(hitObject, this.oc.TopAbs_FACE);
            for (anExplorer.Init(hitObject, this.oc.TopAbs_FACE); anExplorer.More(); anExplorer.Next()) {
                if (face_index === faceIndex) {
                    face = this.oc.TopoDS.prototype.Face(anExplorer.Current());
                    break;
                } else {
                    face_index += 1;
                }
            }

            if (face) {
                // Construct the Extrusion Shape
                let shape = new this.oc.BRepPrimAPI_MakePrism(face,
                    new this.oc.gp_Vec(nx, ny, nz), true, true).Shape();

                // Let's CSG this Extrusion onto/into the object it came from
                if (height > 0) {
                    // The Height is Positive, let's Union
                    let unionOp = new this.oc.BRepAlgoAPI_Fuse(hitObject, shape);
                    unionOp.SetFuzzyValue(0.00001);
                    unionOp.Build();
                    return unionOp.Shape();
                    //let unionOp = new this.oc.BRepBuilderAPI_Sewing(0.00001);
                    //unionOp.Add(hitObject);
                    //unionOp.Add(shape);
                    //unionOp.Perform();
                    //return unionOp.SewedShape();
                } else if (height < 0) {
                    // The Height is Negative, let's Subtract
                    let differenceOp = new this.oc.BRepAlgoAPI_Cut(hitObject, shape);
                    differenceOp.SetFuzzyValue(0.00001);
                    differenceOp.Build();
                    return differenceOp.Shape();
                }
            }
        }
    }

}

export { ExtrusionTool };
