import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';

/** This class controls all of the CylinderTool behavior */
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
                                       this.world.basicMaterial);
        this.arrow = new THREE.ArrowHelper(
            new THREE.Vector3(1, 2, 0).normalize(), new THREE.Vector3(0, 0, 0), 30, 0x00ffff);

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ('../../../textures/Cylinder.png' );
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
                this.hit = intersects[0];
                // Shoot through the floor if necessary
                for (let i = 0; i < intersects.length; i++){
                    if (intersects[i].object.name.includes("#") || this.hit.face !== null) {
                        this.hit = intersects[i]; break;
                    }
                }
                
                // Record the hit object and plane...
                this.hitObject = this.hit.object;

                this.worldNormal = this.hit.face.normal.clone().transformDirection( this.hit.object.matrixWorld );

                // Spawn the Cylinder
                this.currentCylinder = new THREE.Mesh(new THREE.CylinderBufferGeometry(1, 1, 1, 50, 1), this.world.noDepthPreviewMaterial);
                this.currentCylinder.material.color.setRGB(0.5, 0.5, 0.5);
                this.currentCylinder.material.emissive.setRGB(0, 0.25, 0.25);
                this.currentCylinder.name = "Cylinder #" + this.numCylinders;
                this.currentCylinder.position.copy(this.worldNormal.clone()
                    .multiplyScalar(0.5).add(this.hit.point));
                this.currentCylinder.quaternion.copy(new THREE.Quaternion()
                    .setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.worldNormal));
                this.point.copy(this.hit.point);
                this.world.scene.add(this.currentCylinder);
                this.rayPlane.position.copy(this.hit.point);
                this.rayPlane.lookAt(this.hit.face.normal.clone().transformDirection( this.hit.object.matrixWorld ).add(this.rayPlane.position));
                this.rayPlane.updateMatrixWorld(true);
                ray.alreadyActivated = true;

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
            ray.alreadyActivated = true;

            // When let go, advance to waiting for the next drag
            if (!ray.active) {
                this.state += 1;

                // Add Arrow Preview
                this.arrow.position.copy(this.worldNormal.clone().add(this.point));
                this.arrow.setDirection(this.worldNormal);
                this.arrow.setLength( 20, 13, 10 );
                this.world.scene.add(this.arrow);
            }
        } else if (this.state === 2) {
            // When dragging begins again, advance to the next state
            if (ray.justActivated) {
                this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
                let intersects = this.world.raycaster.intersectObjects([this.currentCylinder, this.arrow], true);
                if (intersects.length > 0) {
                    this.world.scene.remove(this.arrow);
                    this.currentCylinder.material = this.world.previewMaterial;
                    ray.alreadyActivated = true;
                    this.state += 1;
                }
            }
        } else if(this.state === 3) {
            // Resize the Height while dragging
            let upperSegment = this.worldNormal.clone().multiplyScalar( 1000.0).add(this.point);
            let lowerSegment = this.worldNormal.clone().multiplyScalar(-1000.0).add(this.point);
            let pointOnRay = new THREE.Vector3(), pointOnSegment = new THREE.Vector3();
            let sqrDistToSeg = ray.ray.distanceSqToSegment(lowerSegment, upperSegment, pointOnRay, pointOnSegment);
            this.height = pointOnSegment.sub(this.point).dot(this.worldNormal);
            this.currentCylinder.position.copy(this.worldNormal.clone()
                .multiplyScalar(this.height / 2.0).add(this.point));
            this.currentCylinder.scale.y = this.height;
            this.currentCylinder.material.emissive.setRGB(
                this.height > 0 ? 0.0  : 0.25,
                this.height > 0 ? 0.25 : 0.0 , 0.0);
            ray.alreadyActivated = true;

            // When let go, deactivate and add to Undo!
            if (!ray.active) {
                this.createCylinderGeometry(this.currentCylinder,
                    [this.point.x, this.point.y, this.point.z,
                        this.worldNormal.x, this.worldNormal.y, this.worldNormal.z,
                        this.distance, this.height, this.hitObject.shapeName]);

                this.numCylinders += 1;
                this.currentCylinder = null;
                this.deactivate();
            }
        }
    }

    /** @param {THREE.Mesh} cylinderMesh */
    createCylinderGeometry(cylinderMesh, createCylinderArgs) {
        let shapeName = "Cylinder #" + this.numCylinders;
        this.engine.execute(shapeName, this.createCylinder, createCylinderArgs,
            (mesh) => {
                if (mesh) {
                    mesh.name = cylinderMesh.name;
                    mesh.shapeName = shapeName;
                    if (this.hitObject.name.includes("#")) {
                        this.world.history.addToUndo(mesh, this.hitObject);
                        this.hitObject = null;
                    } else {
                        this.world.history.addToUndo(mesh);
                    }
                }

                cylinderMesh.parent.remove(cylinderMesh);
                this.world.dirty = true;
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
                unionOp.SetFuzzyValue(0.00001);
                unionOp.Build();
                return unionOp.Shape();
            } else if (hitAnObject && height < 0) {
                // The Height is Negative, let's Subtract
                let hitObject = this.shapes[hitObjectName];
                let differenceOp = new this.oc.BRepAlgoAPI_Cut(hitObject, shape);
                differenceOp.SetFuzzyValue(0.00001);
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
        this.world.scene.remove(this.arrow);
        if (this.currentCylinder && this.currentCylinder.parent) {
            this.currentCylinder.parent.remove(this.currentCylinder);
        }
    }

}

export { CylinderTool };
