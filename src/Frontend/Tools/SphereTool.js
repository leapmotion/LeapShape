import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';
import { createDitherDepthMaterial } from './ToolUtils.js';

/** This class controls all of the SphereTool behavior */
class SphereTool {

    /** Create the SphereTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;
        this.oc = oc; this.shapes = {};

        this.state = -1; // -1 is Deactivated
        this.numSpheres = 0;
        this.distance = 1;
        this.point = new THREE.Vector3();
        this.cameraRelativeMovement = new THREE.Vector3();
        this.rayPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000, 1000),
                                       new THREE.MeshBasicMaterial());

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin('');
        this.icon = this.loader.load ((typeof ESBUILD !== 'undefined') ? './textures/Sphere.png' : '../../../textures/Sphere.png');
        this.descriptor = {
            name: "Sphere Tool",
            icon: this.icon
        }
    }

    /** Update the SphereTool's State Machine
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
                    if (intersects[i].object.name.includes("#")) {
                        this.hit = intersects[i]; break;
                    }
                }
                
                // Record the hit object and plane...
                this.hitObject = this.hit.object;

                // Spawn the Sphere
                let curMaterial = createDitherDepthMaterial(this.world, new THREE.MeshPhongMaterial({ wireframe: false, fog: false }));
                this.currentSphere = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 10, 10), curMaterial);
                this.currentSphere.material.color.setRGB(0.5, 0.5, 0.5);
                this.currentSphere.material.emissive.setRGB(0, 0.25, 0.25);
                this.currentSphere.name = "Sphere #" + this.numSpheres;
                this.currentSphere.position.copy(this.hit.point);
                this.point.copy(this.hit.point);
                this.world.scene.add(this.currentSphere);
                this.rayPlane.position.copy(this.hit.point);
                this.rayPlane.lookAt(this.hit.face.normal.clone().transformDirection( this.hit.object.matrixWorld ).add(this.rayPlane.position));
                this.rayPlane.updateMatrixWorld(true);

                this.state += 1;
            }
        } else if(this.state === 1) {
            // While holding, resize the Sphere
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObject(this.rayPlane);
            if (intersects.length > 0) {
                // Get camera-space position to determine union or subtraction
                this.cameraRelativeMovement.copy(intersects[0].point.clone().sub(this.point));
                this.cameraRelativeMovement.transformDirection(this.world.camera.matrixWorld.invert());

                this.distance = Math.max(1.0, intersects[0].point.clone().sub(this.point).length()) ;
                this.currentSphere.scale.x = this.distance;
                this.currentSphere.scale.y = this.distance;
                this.currentSphere.scale.z = this.distance;
                this.distance *= Math.sign(this.cameraRelativeMovement.x);
                this.currentSphere.material.emissive.setRGB(
                    this.distance > 0 ? 0.0  : 0.25,
                    this.distance > 0 ? 0.25 : 0.0 , 0.0);
            }

            // When let go, deactivate and add to Undo!
            if (!ray.active) {
                this.createSphereGeometry(this.currentSphere,
                    [this.point.x, this.point.y, this.point.z, this.distance, this.hitObject.name]);
                this.numSpheres += 1;
                this.currentSphere = null;
                this.deactivate();
            }
        }

        ray.alreadyActivated = true;
    }

    /** @param {THREE.Mesh} sphereMesh */
    createSphereGeometry(sphereMesh, createSphereArgs) {
        this.engine.execute("Sphere #" + this.numSpheres, this.createSphere, createSphereArgs,
            (geometry) => {
                if (geometry) {
                    if (this.hitObject.name.includes("#")) {
                        this.hitObject.parent.remove(this.hitObject);
                        this.hitObject = null;
                    }

                    sphereMesh.geometry.dispose();
                    sphereMesh.position.set(0, 0, 0);
                    sphereMesh.scale.set(1, 1, 1);
                    sphereMesh.geometry = geometry;
                    sphereMesh.material = new THREE.MeshPhongMaterial({ wireframe: false });
                    sphereMesh.material.color.setRGB(0.5, 0.5, 0.5);
                } else {
                    // Operation Failed, remove preview
                    sphereMesh.parent.remove(sphereMesh);
                }
            });
    }

    /** Create a Sphere in OpenCascade; to be executed on the Worker Thread */
    createSphere(x, y, z, radius, hitObjectName) {
        if (radius != 0) {
            let spherePlane = new this.oc.gp_Ax2(new this.oc.gp_Pnt(x, y, z), this.oc.gp.prototype.DZ());
            let shape = new this.oc.BRepPrimAPI_MakeSphere(spherePlane, Math.abs(radius)).Shape();

            if (hitObjectName in this.shapes) {
                let hitObject = this.shapes[hitObjectName];
                if (radius > 0) {
                    let union = new this.oc.BRepAlgoAPI_Fuse(hitObject, shape);
                    union.SetFuzzyValue(0.00001);
                    union.Build();
                    return union.Shape();
                } else {
                    let differenceCut = new this.oc.BRepAlgoAPI_Cut(hitObject, shape);
                    differenceCut.SetFuzzyValue(0.00001);
                    differenceCut.Build();
                    return differenceCut.Shape();
                }
            }
            return shape;
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
        if (this.currentSphere) {
            this.currentSphere.parent.remove(this.currentSphere);
        }
    }

}

export { SphereTool };
