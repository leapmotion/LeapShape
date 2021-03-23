import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.js';
import { Tools } from './Tools.js';
import { InteractionRay } from '../Input/Input.js';

/** This class controls all of the BoxTool behavior */
class BoxTool {

    /** Create the BoxTool
     * @param {Tools} tools */
    constructor(tools) {
        this.tools  = tools;
        this.world  = this.tools.world;
        this.engine = this.tools.engine;
        this.oc = oc; this.shapes = {};

        this.state = -1; // -1 is Deactivated
        this.numBoxs = 0;
        this.distance = 1;
        this.point = new THREE.Vector3();
        this.tangentAxis = new THREE.Vector3(); 
        this.rayPlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000, 1000),
                                       new THREE.MeshBasicMaterial());
        this.vec = new THREE.Vector3(), this.quat1 = new THREE.Quaternion(), this.quat2 = new THREE.Quaternion();
        this.xQuat = new THREE.Quaternion(), this.yQuat = new THREE.Quaternion();

        // Create Metadata for the Menu System
        this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
        this.icon = this.loader.load ('../../../textures/Box.png' );
        this.descriptor = {
            name: "Box Tool",
            icon: this.icon
        }
    }

    /** Update the BoxTool's State Machine
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
                this.point.copy(this.hit.point);
                this.worldNormal = this.hit.face.normal.clone()
                    .transformDirection(this.hit.object.matrixWorld);

                // Position an Invisible Plane to Raycast against for resizing operations
                this.rayPlane.position.copy(this.point);
                this.rayPlane.lookAt(this.hit.face.normal.clone()
                    .transformDirection(this.hit.object.matrixWorld).add(this.rayPlane.position));
                this.rayPlane.updateMatrixWorld(true);

                // Spawn the Box
                this.currentBox = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1),
                                                 new THREE.MeshPhongMaterial({ wireframe: false }));
                this.currentBox.material.color.setRGB(0.5, 0.5, 0.5);
                this.currentBox.material.emissive.setRGB(0, 0.25, 0.25);
                this.currentBox.name = "Box #" + this.numBoxs;
                this.currentBox.position.copy(this.point);
                this.world.scene.add(this.currentBox);

                this.state += 1;
            }
        } else if(this.state === 1) {
            // While holding, resize the Box
            this.world.raycaster.set(ray.ray.origin, ray.ray.direction);
            let intersects = this.world.raycaster.intersectObject(this.rayPlane);
            if (intersects.length > 0) {
                let relative = intersects[0].object.worldToLocal(intersects[0].point);
                this.width   = relative.x;
                this.length  = relative.y;

                this.height     = 1;
                this.widthAxis  = new THREE.Vector3(1, 0, 0).transformDirection(this.rayPlane.matrixWorld).multiplyScalar(Math.sign(this. width));
                this.lengthAxis = new THREE.Vector3(0, 1, 0).transformDirection(this.rayPlane.matrixWorld).multiplyScalar(Math.sign(this.length));
                this.heightAxis = new THREE.Vector3(0, 0, 1).transformDirection(this.rayPlane.matrixWorld).multiplyScalar(Math.sign(this.height));

                this.alignXandYUnitVectors(this.currentBox.quaternion, this.widthAxis, this.lengthAxis);
                this.currentBox.scale.x = Math.abs(this.width );
                this.currentBox.scale.y = Math.abs(this.height);
                this.currentBox.scale.z = Math.abs(this.length);

                this.currentBox.position.copy(this.point);
                this.currentBox.position.add (this.widthAxis .clone().multiplyScalar(Math.abs(this.width ) / 2.0));
                this.currentBox.position.add (this.heightAxis.clone().multiplyScalar(Math.abs(this.height) / 2.0));
                this.currentBox.position.add (this.lengthAxis.clone().multiplyScalar(Math.abs(this.length) / 2.0));
            }

            // When let go, deactivate and add to Undo!
            if (!ray.active) { this.state += 1; }
        } else if(this.state === 2) {
            // Resize the Box's Height until reclick
            let upperSegment = this.worldNormal.clone().multiplyScalar( 1000.0).add(this.point);
            let lowerSegment = this.worldNormal.clone().multiplyScalar(-1000.0).add(this.point);
            ray.ray.distanceSqToSegment(lowerSegment, upperSegment, null, this.vec);
            this.height = this.vec.sub(this.point).dot(this.worldNormal);

            this.heightAxis = new THREE.Vector3(0, 0, 1)
                .transformDirection(this.rayPlane.matrixWorld).multiplyScalar(Math.sign(this.height));

            this.currentBox.scale.x = Math.abs(this.width );
            this.currentBox.scale.y = Math.abs(this.height);
            this.currentBox.scale.z = Math.abs(this.length);

            this.currentBox.position.copy(this.point);
            this.currentBox.position.add (this.widthAxis .clone().multiplyScalar(Math.abs(this.width ) / 2.0));
            this.currentBox.position.add (this.heightAxis.clone().multiplyScalar(Math.abs(this.height) / 2.0));
            this.currentBox.position.add (this.lengthAxis.clone().multiplyScalar(Math.abs(this.length) / 2.0));

            this.currentBox.material.emissive.setRGB(
                this.height > 0 ? 0.0  : 0.25,
                this.height > 0 ? 0.25 : 0.0 , 0.0);

            // When let go, deactivate and add to Undo!
            if (ray.active) {
                // This fangles the coordinate space so the box is always drawn in the (+,+,+) Octant
                let sameSign = Math.sign(this.width) != Math.sign(this.length);
                this.flip = this.height > 0 ? !sameSign : sameSign;
                this.tangentAxis.copy(this.flip ? this.widthAxis : this.lengthAxis);

                this.createBoxGeometry(this.currentBox,
                    [this.point.x, this.point.y, this.point.z,
                        this.heightAxis.x, this.heightAxis.y, this.heightAxis.z,
                        this.tangentAxis.x, this.tangentAxis.y, this.tangentAxis.z,
                        this.flip?this.length:this.width, this.height, this.flip?this.width:this.length, this.hitObject.name]);

                this.numBoxs += 1;
                this.currentBox = null;
                this.deactivate();
            }
        }

        ray.alreadyActivated = true;
    }

    /** @param {THREE.Mesh} boxMesh */
    createBoxGeometry(boxMesh, createBoxArgs) {
        this.engine.execute("Box #" + this.numBoxs, this.createBox, createBoxArgs,
            (geometry) => {
                if (geometry) {
                    if (this.hitObject.name.includes("#")) {
                        this.hitObject.parent.remove(this.hitObject);
                        this.hitObject = null;
                    }

                    boxMesh.geometry.dispose();
                    boxMesh.position.set(0, 0, 0);
                    boxMesh.scale.set(1, 1, 1);
                    boxMesh.quaternion.set(0, 0, 0, 1);
                    boxMesh.geometry = geometry;
                    boxMesh.material = new THREE.MeshPhongMaterial({ wireframe: false });
                    boxMesh.material.color.setRGB(0.5, 0.5, 0.5);
                } else {
                    // Operation Failed, remove preview
                    boxMesh.parent.remove(boxMesh);
                }
            });
    }

    /** Create a Box in OpenCascade; to be executed on the Worker Thread */
    createBox(x, y, z, nx, ny, nz, vx, vy, vz, width, height, length, hitObjectName) {
        if (width != 0 && height != 0 && length != 0) {
            let hitAnObject = hitObjectName in this.shapes;

            // Construct the Box Shape
            let boxPlane = new this.oc.gp_Ax2(new this.oc.gp_Pnt(x, y, z), new this.oc.gp_Dir(nx, ny, nz), new this.oc.gp_Dir(vx, vy, vz));
            let shape = new this.oc.BRepPrimAPI_MakeBox(boxPlane, Math.abs(length), Math.abs(width), Math.abs(height)).Shape();

            if (!shape || shape.IsNull()) { console.error("BRepPrimAPI_MakeBox did not like its arguments!"); }

            // If we hit an object, let's CSG this Box to it
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
            }

            return shape;
        } else {
            console.error("createBox got a Zero Dimension!");
        }
    }

    /** Sets a quaternion to align to two directions
     * @param {THREE.Quaternion} quat
     * @param {THREE.Vector3} xDir
     * @param {THREE.Vector3} yDir */
    alignXandYUnitVectors(quat, xDir, yDir) {
        this.vec.set(1, 0, 0);
        quat.setFromUnitVectors(this.vec, xDir);
        this.vec.set(0, 0, 1).applyQuaternion(quat);
        this.quat1.setFromUnitVectors(this.vec, yDir);
        return quat.premultiply(this.quat1);
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
        if (this.currentBox) {
            this.currentBox.parent.remove(this.currentBox);
        }
    }

}

export { BoxTool };
