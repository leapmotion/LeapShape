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

                this.worldNormal = intersects[0].face.normal.clone().transformDirection( intersects[0].object.matrixWorld );

                // Spawn the Cylinder
                this.currentCylinder = new THREE.Mesh(new THREE.CylinderBufferGeometry(1, 1, 1, 50, 1),
                                                      new THREE.MeshPhongMaterial({ wireframe: false }));
                this.currentCylinder.material.color.setRGB(0.5, 0.5, 0.5);
                this.currentCylinder.name = "Cylinder #" + this.numCylinders;
                this.currentCylinder.position.copy(intersects[0].point);
                this.currentCylinder.quaternion.copy(new THREE.Quaternion()
                    .setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.worldNormal));
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
                this.currentCylinder.scale.x = this.distance;
                this.currentCylinder.scale.y = 1;
                this.currentCylinder.scale.z = this.distance;
            }

            // When let go, deactivate and add to Undo!
            if (!ray.active) {
                this.state += 1;
            }
        } else if(this.state === 2) {
            // Resize the Cylinder's Height until reclick
            let upperSegment = this.worldNormal.clone().multiplyScalar( 1000.0).add(this.point);
            let lowerSegment = this.worldNormal.clone().multiplyScalar(-1000.0).add(this.point);
            let pointOnRay = new THREE.Vector3(), pointOnSegment = new THREE.Vector3();
            let sqrDistToSeg = ray.ray.distanceSqToSegment(lowerSegment, upperSegment, pointOnRay, pointOnSegment);
            this.height = pointOnSegment.sub(this.point).dot(this.worldNormal);
            this.currentCylinder.position.copy(this.worldNormal.clone()
                .multiplyScalar(this.height / 2.0).add(this.point));
            this.currentCylinder.scale.y = this.height;

            // When let go, deactivate and add to Undo!
            if (ray.active) {
                this.createCylinderGeometry(this.currentCylinder,
                    [this.point.x, this.point.y, this.point.z,
                        this.worldNormal.x, this.worldNormal.y, this.worldNormal.z,
                        this.distance, this.height, this.hitObject.name]);

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
                    if (this.hitObject.name.includes("#")) {
                        this.hitObject.parent.remove(this.hitObject);
                        this.hitObject = null;
                    }

                    cylinderMesh.geometry.dispose();
                    cylinderMesh.position.set(0, 0, 0);
                    cylinderMesh.scale.set(1, 1, 1);
                    cylinderMesh.quaternion.set(0, 0, 0, 1);
                    cylinderMesh.geometry = geometry;
                }
            });
    }

    /** Create a Cylinder in OpenCascade; to be executed on the Worker Thread */
    createCylinder(x, y, z, nx, ny, nz, radius, height, hitObjectName) {
        if (radius > 0 && height != 0) {
            let centered = false; let hitAnObject = hitObjectName in this.shapes;

            // Change the Cylinder Extension direction based on the sign of the height
            nx *= Math.sign(height); ny *= Math.sign(height); nz *= Math.sign(height);

            // Ugly hack to account for the difference between the raycast point and implicit point
            // The true solution would be to raycast inside of the OpenCascade Kernel against the implicit BReps.
            if (hitAnObject) { x -= nx * this.resolution; y -= ny * this.resolution; z -= nz * this.resolution; }

            // Construct the Cylinder Shape
            let cylinderPlane = new this.oc.gp_Ax2(new this.oc.gp_Pnt(x, y, centered ? z-height / 2 : z), new this.oc.gp_Dir(nx, ny, nz));
            let shape = new this.oc.BRepPrimAPI_MakeCylinder(cylinderPlane, radius, Math.abs(height)).Shape();

            // If we hit an object, let's CSG this Cylinder to it
            if (hitAnObject && height > 0) {
                // The Height is Positive, let's Union
                let hitObject = this.shapes[hitObjectName];
                let unionOp = new this.oc.BRepAlgoAPI_Fuse(hitObject, shape);
                unionOp.SetFuzzyValue(0.001);
                unionOp.Build();
                return unionOp.Shape();
            } else if (hitAnObject && height < 0) {
                // The Height is Negative, let's Subtract
                let hitObject = this.shapes[hitObjectName];
                let differenceOp = new this.oc.BRepAlgoAPI_Cut(hitObject, shape);
                differenceOp.SetFuzzyValue(0.001);
                differenceOp.Build();
                return differenceOp.Shape();
            } else {
                // Otherwise, let's create a new object
                return shape;
            }
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