import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.js';
import { Menu } from './Menu.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';

/** This class controls all of the Tool and Menu State Machines */
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

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ('../../../textures/noun_Sphere.png' );
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
                // Record the hit object and plane...
                this.hitObject = intersects[0].object;

                // Spawn the Sphere
                this.currentSphere = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 10, 10),
                                                    new THREE.MeshPhongMaterial({ wireframe: false }));
                this.currentSphere.material.color.setRGB(0.5, 0.5, 0.5);
                this.currentSphere.name = "Sphere #" + this.numSpheres;
                this.point.copy(intersects[0].point);
                this.world.scene.add(this.currentSphere);

                this.state += 1;
            }
        } else if(this.state === 1) {
            // While holding, resize the Sphere
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObject(this.hitObject);
            if (intersects.length > 0) {
                this.distance = Math.max(1.0, intersects[0].point.sub(this.point).length());
                this.createSphereGeometry(this.currentSphere, [this.point.x, this.point.y, this.point.z, this.distance]);
            }

            // When let go, deactivate and add to Undo!
            if (!ray.active) {
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
                    sphereMesh.geometry.dispose();
                    sphereMesh.scale.set(1, 1, 1);
                    sphereMesh.geometry = geometry;
                }
            });
    }

    /** Create a Sphere in OpenCascade; to be executed on the Worker Thread */
    createSphere(x, y, z, radius) {
        if (radius > 0) {
            let spherePlane = new this.oc.gp_Ax2(new this.oc.gp_Pnt(x, y, z), this.oc.gp.prototype.DZ());
            return new this.oc.BRepPrimAPI_MakeSphere(spherePlane, radius).Shape();
            //let cone = new this.oc.BRepPrimAPI_MakeCone(radius, radius * 0.5, radius).Shape();
            //let transformation = new this.oc.gp_Trsf();
            //transformation.SetTranslation(new this.oc.gp_Vec(x, y, z));
            //let translation = new this.oc.TopLoc_Location(transformation);
            //return new this.oc.TopoDS_Shape(cone.Moved(translation));
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
