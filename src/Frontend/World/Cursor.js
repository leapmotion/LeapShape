import * as THREE from '../../../node_modules/three/build/three.module.js';
import oc from  '../../../node_modules/opencascade.js/dist/opencascade.wasm.module.js';

/** This is an in-scene helper for measurements and precision placement. */
class Cursor {
    
    /** Initialize the Cursor
     * @param {World} world */
    constructor(world) {
        // Store a reference to the World
        this.world = world;
        this.oc = oc;
        this.engine = this.world.parent.engine;

        this.sphereGeo = new THREE.SphereBufferGeometry(1, 5, 5);
        this.cursor = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial());
        this.cursor.material.color.set(0x00ffff);
        this.cursor.name = "Cursor";
        this.cursor.receiveShadow = false;
        this.cursor.castShadow = false;
        this.cursor.layers.set(1); // Ignore Raycasts
        this.targetPosition = new THREE.Vector3();
        this.lastTimeTargetUpdated = performance.now();
        this.position = this.cursor.position;
        this.hitObject = null;

        //this.world.cursor = this.cursor;
        this.world.scene.add(this.cursor);
    }

    update() {
        if (performance.now() - this.lastTimeTargetUpdated < 100) {
            this.cursor.visible = true;

            // Lerp the Cursor to the Target Position
            this.cursor.position.lerp(this.targetPosition, 0.15);

            // Make the Cursor Contents Face the Camera
            this.cursor.quaternion.slerp(this.world.camera.quaternion, 0.15);

            if (this.hitObject && this.hitObject.shapeName && !this.engine.workerWorking) {
                this.querySurface(this.hitObject.shapeName, this.position);
            }

        } else {
            this.cursor.visible = false;
        }
    }

    updateMetadata(position, hitObject) {
        this.targetPosition.copy(position);
        this.hitObject = hitObject;
        this.lastTimeTargetUpdated = performance.now();
    }

    querySurface(shapeName, position) {
        this.engine.execute("CursorSurfaceQuery", this.querySurfaceBackend,
            [shapeName, position.x, position.y, position.z],
            (metadata) => {
                if (metadata) { console.log(metadata); this.metadata = metadata; }
                this.world.dirty = true;
            });
    }

    querySurfaceBackend(shapeName, x, y, z) { //faceIndex, u, v) {
        let toReturn = { isMetadata: true };

        let shape = this.shapes[shapeName];
        let curPoint = new this.oc.BRepBuilderAPI_MakeVertex(new this.oc.gp_Pnt(x, y, z)).Vertex();

        let overlapChecker = new this.oc.BRepExtrema_DistShapeShape(curPoint, shape);
        overlapChecker.Perform();

        if (overlapChecker.NbSolution() > 0) {
            let nearestPnt = overlapChecker.PointOnShape2(1);
            toReturn.x = nearestPnt.X();
            toReturn.y = nearestPnt.Y();
            toReturn.z = nearestPnt.Z();
            toReturn.distance = overlapChecker.Value();
            toReturn.innerSolution = overlapChecker.InnerSolution();
            toReturn.supportType = overlapChecker.SupportTypeShape2(1);

            if (toReturn.supportType === 0) { // 0 = "BRepExtrema_IsVertex"
                // Point is inside the shape
            }else if (toReturn.supportType === 1) { // 1 = "BRepExtrema_IsOnEdge"
                // Get Parameterization on Curve
            } else if (toReturn.supportType === 2) { // 2 = "BRepExtrema_IsInFace"
                // Get Parameterization on Face

                // Compute the Arclengths of the Isoparametric Curves of the face
                //let surfaceHandle = this.oc.BRep_Tool.prototype.Surface(myFace);
                //let surface = surfaceHandle.get();
                //let UIso_Handle = surface.UIso(UMin + ((UMax - UMin) * 0.5));
                //let VIso_Handle = surface.VIso(VMin + ((VMax - VMin) * 0.5));
                //let UAdaptor = new this.oc.GeomAdaptor_Curve(VIso_Handle);
                //let VAdaptor = new this.oc.GeomAdaptor_Curve(UIso_Handle);
                //uv_boxes.push({
                //    w: this.LengthOfCurve(UAdaptor, UMin, UMax),
                //    h: this.LengthOfCurve(VAdaptor, VMin, VMax),
                //    index: curFace
                //});
            }
        }

        return toReturn;
    }

}

export { Cursor };
