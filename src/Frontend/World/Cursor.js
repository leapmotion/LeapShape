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

        this.middle = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial());
        this.middle.material.color.set(0xff0000);
        //this.middle.scale.set(new THREE.Vector3(10, 10, 10));
        this.middle.name = "Middle Marker";
        this.middle.receiveShadow = false;
        this.middle.castShadow = false;
        this.middle.layers.set(1); // Ignore Raycasts

        //this.world.cursor = this.cursor;
        this.world.scene.add(this.cursor);
        this.world.scene.add(this.middle);
    }

    update() {
        if (performance.now() - this.lastTimeTargetUpdated < 100) {
            this.cursor.visible = true;

            // Lerp the Cursor to the Target Position
            if (this.metadata) {
                this.cursor.position.set(this.metadata.x, this.metadata.y, this.metadata.z);
                this.middle.position.set(this.metadata.midX, this.metadata.midY, this.metadata.midZ);
            } else {
                this.cursor.position.lerp(this.targetPosition, 0.15);
            }

            // Make the Cursor Contents Face the Camera
            this.cursor.quaternion.slerp(this.world.camera.quaternion, 0.15);

            if (this.hit && this.hit.object.shapeName && !this.engine.workerWorking) {
                this.querySurface(this.hit);
            }

        } else {
            this.cursor.visible = false;
        }
    }

    updateMetadata(position, raycastHit) {
        this.targetPosition.copy(position);
        this.hit = raycastHit;
        this.lastTimeTargetUpdated = performance.now();
    }

    querySurface(raycastHit) {
        // Match the triangle index to the face index from the face metadata
        let faceID = -1; let faceMetadata = raycastHit.object.faceMetadata;
        for (let i = 0; i < faceMetadata.length; i++){
            if (raycastHit.faceIndex >= faceMetadata[i].start &&
                raycastHit.faceIndex  < faceMetadata[i].end) {
                faceID = faceMetadata[i].index; break;
            }
        }

        let queryArgs = [raycastHit.object.shapeName, faceID,
                            raycastHit.uv2.x, raycastHit.uv2.y,
                            raycastHit.point.x, raycastHit.point.y, raycastHit.point.z];

        this.engine.execute("CursorSurfaceQuery", this.querySurfaceBackend, queryArgs,
            (metadata) => {
                if (metadata) { /*console.log(metadata);*/ this.metadata = metadata; }
                this.world.dirty = true;
            });
    }

    querySurfaceBackend(shapeName, faceIndex, u, v, x, y, z) { //faceIndex, u, v) {
        let toReturn = { isMetadata: true };
        let shape = this.shapes[shapeName];
        let faceName = shapeName + " Face #" + faceIndex;

        // Get the BRepAdaptor_Surface associated with this face
        if (!this.surfaces) { this.surfaces = {}; }
        if (!(faceName in this.surfaces)) {
            let face = null; let face_index = 0;
            let anExplorer = new this.oc.TopExp_Explorer(shape, this.oc.TopAbs_FACE);
            for (anExplorer.Init(shape, this.oc.TopAbs_FACE); anExplorer.More(); anExplorer.Next()) {
                if (face_index === faceIndex) {
                    face = this.oc.TopoDS.prototype.Face(anExplorer.Current());
                    break;
                } else {
                    face_index += 1;
                }
            }

            this.surfaces[faceName] = new this.oc.BRepAdaptor_Surface(face, false);
        }
        let adapter = this.surfaces[faceName];

        // Get the true implicit point
        let truePnt = adapter.Value(u, v);
        toReturn.x = truePnt.X(); toReturn.y = truePnt.Y(); toReturn.z = truePnt.Z();
        this.oc._free(truePnt);

        // Get the type of face
        toReturn.faceType = adapter.GetType(); // https://dev.opencascade.org/doc/occt-7.4.0/refman/html/_geom_abs___surface_type_8hxx.html

        // Get the point in the middle of the face if it's flat
        //if (toReturn.faceType == 0) {
            let UMiddle = (adapter.LastUParameter() + adapter.FirstUParameter()) * 0.5;
            let VMiddle = (adapter.LastVParameter() + adapter.FirstVParameter()) * 0.5;
            let Middle  =  adapter.Value(UMiddle, VMiddle);
            toReturn.midX = Middle.X(); toReturn.midY = Middle.Y(); toReturn.midZ = Middle.Z();
            this.oc._free(Middle);
        //}
        return toReturn;
    }

    /*
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

        let overlapChecker = new this.oc.BRepExtrema_DistShapeShape(curPoint, shape); // Don't do this every frame...
        overlapChecker.Perform();

        if (overlapChecker.NbSolution() > 0) {
            let nearestPnt = overlapChecker.PointOnShape2(1);
            toReturn.x = nearestPnt.X();
            toReturn.y = nearestPnt.Y();
            toReturn.z = nearestPnt.Z();
            toReturn.distance = overlapChecker.Value();
            toReturn.innerSolution = overlapChecker.InnerSolution();
            toReturn.supportType = overlapChecker.SupportTypeShape2(1);

            let mySupport = overlapChecker.SupportOnShape2(1);
            if (toReturn.supportType === 0) { // 0 = "BRepExtrema_IsVertex"
                // Point is inside the shape; nothing we can do...
            }else if (toReturn.supportType === 1) { // 1 = "BRepExtrema_IsOnEdge"
                // Get Parameterization on Curve
                let adapter = new this.oc.BRepAdaptor_Curve(mySupport); // Don't do this every frame...

                // Get the point in the middle of the face
                let UMiddle = (adapter.LastParameter() + adapter.FirstParameter()) * 0.5;
                let Middle  = adapter.Value(UMiddle);
                toReturn.midX = Middle.X(); toReturn.midY = Middle.Y(); toReturn.midZ = Middle.Z();
            } else if (toReturn.supportType === 2) { // 2 = "BRepExtrema_IsInFace"
                // Get Parameterization on Face
                let adapter = new this.oc.BRepAdaptor_Surface(mySupport, false); // Don't do this every frame...

                // Get the type of face
                toReturn.faceType = adapter.GetType(); // https://dev.opencascade.org/doc/occt-7.4.0/refman/html/_geom_abs___surface_type_8hxx.html

                // Get the point in the middle of the face if it's flat
                if (toReturn.faceType == 0) {
                    let UMiddle = (adapter.LastUParameter() + adapter.FirstUParameter()) * 0.5;
                    let VMiddle = (adapter.LastVParameter() + adapter.FirstVParameter()) * 0.5;
                    let Middle = adapter.Value(UMiddle, VMiddle);
                    toReturn.midX = Middle.X(); toReturn.midY = Middle.Y(); toReturn.midZ = Middle.Z();
                }

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
    }*/

}

export { Cursor };
