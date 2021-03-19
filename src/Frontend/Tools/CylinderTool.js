import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.js';
import { Menu } from './Menu.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';

/** This class controls all of the Tool and Menu State Machines */
class CylinderTool {

    /** Create the CylinderTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;
        this.oc = oc; this.shapes = {};

        this.state = -1; // -1 is Deactivated
        this.numCylinders = 0;
        this.distance = 1;
        this.point = new THREE.Vector3();
        this.rayPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000, 1000),
                                       new THREE.MeshBasicMaterial());

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ('../../../textures/noun_Pencil.png' );
        this.descriptor = {
            name: "Cylinder Tool",
            icon: this.icon
        }
    }

    /** Update the CylinderTool's State Machine
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) {
        if (ray.alreadyActivated || this.state === -1) {
            return; // Tool is currently deactivated
        } else if(this.state === 0) {
            // Wait for the ray to be active and pointing at a drawable surface
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObject(this.world.scene, true);

            if (ray.active && intersects.length > 0) {
                // Record the hit object and plane...
                this.hitObject = intersects[0].object;

                // Spawn the Cylinder
                this.currentCylinder = new THREE.Mesh(new THREE.CylinderBufferGeometry(1, 10, 10),
                                                      new THREE.MeshPhongMaterial({ wireframe: false }));
                this.currentCylinder.material.color.setRGB(0.5, 0.5, 0.5);
                this.currentCylinder.name = "Cylinder #" + this.numCylinders;
                //this.currentCylinder.position.copy(intersects[0].point);
                this.point.copy(intersects[0].point);
                this.world.scene.add(this.currentCylinder);
                this.rayPlane.position.copy(intersects[0].point);
                this.rayPlane.lookAt(intersects[0].face.normal.clone().transformDirection( intersects[0].object.matrixWorld ).add(this.rayPlane.position));
                this.rayPlane.updateMatrixWorld(true);

                this.state += 1;
            }
        } else if(this.state === 1) {
            // While holding, resize the Cylinder
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObject(this.rayPlane);
            if (intersects.length > 0) {
                this.distance = Math.max(1.0, intersects[0].point.sub(this.point).length());
                this.worldNormal = intersects[0].face.normal.clone().transformDirection( intersects[0].object.matrixWorld );
                //console.log("nx: " + worldNormal.x + ", ny: " + worldNormal.y + ", nz: " + worldNormal.z);
                this.createCylinderGeometry(this.currentCylinder,
                    [this.point.x, this.point.y, this.point.z,
                        this.worldNormal.x, this.worldNormal.y, this.worldNormal.z,
                        this.distance, 10, this.hitObject.name]);
            }

            // When let go, deactivate and add to Undo!
            if (!ray.active) {
                this.state += 1;
            }
        } else if(this.state === 2) {
            // Resize the Cylinder's Height until reclick
            //this.distance = Math.max(1.0, intersects[0].point.sub(this.point).length());
            let upperSegment = this.worldNormal.clone().multiplyScalar(1000.0) .add(this.point);
            let lowerSegment = this.worldNormal.clone().multiplyScalar(-1000.0).add(this.point);
            let pointOnRay = new THREE.Vector3(), pointOnSegment = new THREE.Vector3();
            let sqrDistToSeg = ray.ray.distanceSqToSegment(lowerSegment, upperSegment, pointOnRay, pointOnSegment);
            this.height = pointOnSegment.sub(this.point).dot(this.worldNormal);
            console.log(this.height);

            this.createCylinderGeometry(this.currentCylinder,
                [this.point.x, this.point.y, this.point.z,
                    this.worldNormal.x, this.worldNormal.y, this.worldNormal.z,
                    this.distance, this.height, this.hitObject.name]);

            // When let go, deactivate and add to Undo!
            if (ray.active) {
                this.numCylinders += 1;
                this.currentCylinder = null;
                this.deactivate();
            }
        }

        ray.alreadyActivated = true;
    }

    /** @param {THREE.Mesh} cylinderMesh */
    createCylinderGeometry(cylinderMesh, createCylinderArgs) {
        this.engine.execute("Cylinder #" + this.numCylinders, this.createCylinder, createCylinderArgs,
            (geometry) => {
                if (geometry) {
                    cylinderMesh.geometry.dispose();
                    cylinderMesh.position.set(0, 0, 0);
                    cylinderMesh.scale.set(1, 1, 1);
                    cylinderMesh.geometry = geometry;

                    //if (this.hitObject.name.includes("#")) {
                    //    this.hitObject.parent.remove(this.hitObject);
                    //}
                }
            });
    }

    /** Create a Cylinder in OpenCascade; to be executed on the Worker Thread */
    createCylinder(x, y, z, nx, ny, nz, radius, height, hitObjectName) {
        if (radius > 0) {
            //let spherePlane = new this.oc.gp_Ax2(new this.oc.gp_Pnt(x, y, z), this.oc.gp.prototype.DZ());
            //let shape = new this.oc.BRepPrimAPI_MakeCylinder(spherePlane, radius).Shape();
            //let cone = new this.oc.BRepPrimAPI_MakeCone(radius, radius * 0.5, radius).Shape();
            //let transformation = new this.oc.gp_Trsf();
            //transformation.SetTranslation(new this.oc.gp_Vec(x, y, z));
            //let translation = new this.oc.TopLoc_Location(transformation);
            //let shape = ew this.oc.TopoDS_Shape(cone.Moved(translation));
            //console.log("nx: " + nx + ", ny: " + ny + ", nz: " + nz);
            let centered = false;
            let cylinderPlane = new this.oc.gp_Ax2(new this.oc.gp_Pnt(x, y, centered ? z-height / 2 : z), new this.oc.gp_Dir(nx, ny, nz));
            let shape = new this.oc.BRepPrimAPI_MakeCylinder(cylinderPlane, radius, Math.abs(height)).Shape();
            return shape;

            /*if (hitObjectName in this.shapes) {
                let hitObject = this.shapes[hitObjectName];
                let differenceCut = new this.oc.BRepAlgoAPI_Cut(hitObject, shape);
                differenceCut.SetFuzzyValue(0.1);
                differenceCut.Build();
                return differenceCut.Shape();
            } else {
                return shape;
            }*/
        }
    }

    activate() {
        if (this.tools.activeTool) {
            this.tools.activeTool.deactivate();
        }
        this.state = 0;
        this.tools.activeTool = this;
    }

    deactivate() {
        this.state = -1;
        this.tools.activeTool = null;
        if (this.currentCylinder) {
            this.currentCylinder.parent.remove(this.currentCylinder);
        }
    }

}

export { CylinderTool };
