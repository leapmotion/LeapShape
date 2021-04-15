import * as THREE from '../../../node_modules/three/build/three.module.js';
import "../../../node_modules/leapjs/leap-1.1.0.js";
import { World } from '../World/World.js';
import { InteractionRay } from './Input.js';

/** This is the Leap Hand Tracking-based Input */
class LeapHandInput {
    /** Initialize Mouse Capture
     * @param {World} world */
    constructor(world) {
        this.world = world;
        this.controller = new window.Leap.Controller({ optimizeHMD: false }).connect();

        this.hands = {};
        this.lastFrameTimestamp = 0;
        this.palmDirection = new THREE.Vector3();
        this.palmNormal = new THREE.Vector3();
        this.vec = new THREE.Vector3(); this.vec2 = new THREE.Vector3(); this.vec3 = new THREE.Vector3();
        this.quat = new THREE.Quaternion(); this.quat2 = new THREE.Quaternion();
        this.mat1 = new THREE.Matrix4(); this.mat2 = new THREE.Matrix4();
        this.baseBoneRotation = (new THREE.Quaternion).setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));

        this.handParent = new THREE.Group();
        this.handParent.scale.set(0.001, 0.001, 0.001);
        this.world.camera.add(this.handParent);
        this.hmdEuler = new THREE.Euler(Math.PI / 2, 0, Math.PI);

        // Set up Pinch Related Data
        this.pinchSpheres = {};
        this.pinchSpheres['left'] = new THREE.Mesh(new THREE.SphereBufferGeometry(20, 10, 10), new THREE.MeshPhongMaterial());
        this.pinchSpheres['left'].material.color.setRGB(0.2, 0.5, 0.5);
        this.pinchSpheres['left'].name = "Left Pinch Sphere";
        this.pinchSpheres['left'].visible = false;
        this.pinchSpheres['left'].layers.set(1);
        this.pinchSpheres['right'] = new THREE.Mesh(new THREE.SphereBufferGeometry(20, 10, 10), new THREE.MeshPhongMaterial());
        this.pinchSpheres['right'].material.color.setRGB(0.5, 0.2, 0.2);
        this.pinchSpheres['right'].name = "Right Pinch Sphere";
        this.pinchSpheres['right'].visible = false;
        this.pinchSpheres['right'].layers.set(1);
        this.world.leftPinch  = this.pinchSpheres['left' ];
        this.world.rightPinch = this.pinchSpheres['right'];
        this.world.scene.add(this.pinchSpheres['left']);
        this.world.scene.add(this.pinchSpheres['right']);

        this.ray = new InteractionRay(new THREE.Ray());
        this.lastTimestep = performance.now();
        this.activeTime = 0; this.prevActive = false;
        this.mainHand = null;

        this.curInVR = false;

        this.nowToLeapOffsetUS = 0;
        let exampleFrameJSON = this.getExampleFrameJSON();
        console.log(exampleFrameJSON);
        this.interpolatedFrame = new window.Leap.Frame(exampleFrameJSON);
        console.log(this.interpolatedFrame);
    }

    /** Linearly Interpolate `a` to `b` by `alpha`
     * @param {number} a @param {number} b @param {number} alpha @returns {number} */
    lerp(a, b, alpha) { return (a * (1 - alpha)) + (b * alpha); }

    /** Fills toFill with the interpolation alpha between aFrame and bFrame 
     * @param {number} alpha */
    lerpFrame(toFill, a, b, alpha) {
        // Fill with interpolated information
        toFill.id = b.id;
        toFill.currentFrameRate = this.lerp(a.currentFrameRate, b.currentFrameRate, alpha);
        toFill.timestamp = this.lerp(a.timestamp, b.timestamp, alpha);

        // Loop through the newer frame's hands
        for (let h = 0; h < b.hands.length; h++) {
            let bHand = b.hands[h];
            let aHand = a.handsMap(bHand.id);
            let toFillHand = bHand.type === toFill.hands[0].type ? toFill.hands[0] : toFill.hands[1];
            // If hand is also in a, begin lerping the relevant parameters
            if (aHand) {
                // Lerp the Single Value Hand Parameters
                toFillHand.id              = bHand.id;
                toFillHand.palmWidth       = this.lerp(aHand.palmWidth      , bHand.palmWidth      , alpha);
                toFillHand.pinchDistance   = this.lerp(aHand.pinchDistance  , bHand.pinchDistance  , alpha);
                toFillHand.pinchStrength   = this.lerp(aHand.pinchStrength  , bHand.pinchStrength  , alpha);
                toFillHand.timeVisible     = this.lerp(aHand.timeVisible    , bHand.timeVisible    , alpha);
                toFillHand.armWidth        = this.lerp(aHand.armWidth       , bHand.armWidth       , alpha);
                toFillHand.confidence      = this.lerp(aHand.confidence     , bHand.confidence     , alpha);
                toFillHand.grabAngle       = this.lerp(aHand.grabAngle      , bHand.grabAngle      , alpha);
                toFillHand.grabStrength    = this.lerp(aHand.grabStrength   , bHand.grabStrength   , alpha);

                // Lerp the three-value Parameters
                toFillHand.direction   [0] = this.lerp(aHand.direction   [0], bHand.direction   [0], alpha);
                toFillHand.direction   [1] = this.lerp(aHand.direction   [1], bHand.direction   [1], alpha);
                toFillHand.direction   [2] = this.lerp(aHand.direction   [2], bHand.direction   [2], alpha);
                toFillHand.elbow       [0] = this.lerp(aHand.elbow       [0], bHand.elbow       [0], alpha);
                toFillHand.elbow       [1] = this.lerp(aHand.elbow       [1], bHand.elbow       [1], alpha);
                toFillHand.elbow       [2] = this.lerp(aHand.elbow       [2], bHand.elbow       [2], alpha);
                toFillHand.palmNormal  [0] = this.lerp(aHand.palmNormal  [0], bHand.palmNormal  [0], alpha);
                toFillHand.palmNormal  [1] = this.lerp(aHand.palmNormal  [1], bHand.palmNormal  [1], alpha);
                toFillHand.palmNormal  [2] = this.lerp(aHand.palmNormal  [2], bHand.palmNormal  [2], alpha);
                toFillHand.palmPosition[0] = this.lerp(aHand.palmPosition[0], bHand.palmPosition[0], alpha);
                toFillHand.palmPosition[1] = this.lerp(aHand.palmPosition[1], bHand.palmPosition[1], alpha);
                toFillHand.palmPosition[2] = this.lerp(aHand.palmPosition[2], bHand.palmPosition[2], alpha);
                toFillHand.palmVelocity[0] = this.lerp(aHand.palmVelocity[0], bHand.palmVelocity[0], alpha);
                toFillHand.palmVelocity[1] = this.lerp(aHand.palmVelocity[1], bHand.palmVelocity[1], alpha);
                toFillHand.palmVelocity[2] = this.lerp(aHand.palmVelocity[2], bHand.palmVelocity[2], alpha);
                toFillHand.wrist       [0] = this.lerp(aHand.wrist       [0], bHand.wrist       [0], alpha);
                toFillHand.wrist       [1] = this.lerp(aHand.wrist       [1], bHand.wrist       [1], alpha);
                toFillHand.wrist       [2] = this.lerp(aHand.wrist       [2], bHand.wrist       [2], alpha);

                // Ignore the 3x3 `armBasis` for now

                // Lerp the Finger Parameters
                toFillHand.fingers.forEach((finger, index) => {
                    // Lerp the Single Value Finger Parameters

                    // Lerp the Bones
                    finger.bones.forEach((bone, i) => {
                        //bone.center(), bone.length, bone.matrix(), bone.prevJoint, bone.nextJoint
                    });
                });
            }
        }
    }

    /** Interpolates a frame to the given timestamp 
     * @param {number} timestamp */
    getInterpolatedFrame(frame, controller, timestamp) {
        // Step through time until we have the two frames we'd like to interpolate between.
        let back = 0;
        let aFrame = controller.frame(back+1);
        let bFrame = controller.frame(back  );
        while (!(timestamp > bFrame.timestamp ||
                (aFrame.timestamp < timestamp && bFrame.timestamp > timestamp) ||
                back == 198)) { // Only 200 entries in the history buffer
            back++;
            aFrame = controller.frame(back+1);
            bFrame = controller.frame(back  );
        }

        let aTimestamp = aFrame.timestamp, bTimestamp = bFrame.timestamp;
        let alpha = timestamp - aTimestamp / (bTimestamp - aTimestamp);
        return lerpFrame(frame, aFrame, bFrame, alpha);
    }

    /** Updates visuals and regenerates the input ray */
    update() {
        // Set up Interpolation
        let latestFrame = this.controller.lastFrame;
        if (latestFrame.hands.length == 2) {
            console.log(latestFrame.dump());
        }

        if (latestFrame.timestamp !== this.lastFrameTimestamp && latestFrame.timestamp) {
            let leapTimestamp = latestFrame.timestamp;    // us
            let nowTimestamp  = performance.now() * 1000; // us
    
            // Solve for the rough offset between performance.now() and the leap timestamp
            let rawOffset = leapTimestamp - nowTimestamp;
            let offsetCorrection = rawOffset - this.nowToLeapOffsetUS;
            if (this.nowToLeapOffsetUS === 0 || Math.abs(offsetCorrection) > 10000) {
                this.nowToLeapOffsetUS = rawOffset;
            }
            this.nowToLeapOffsetUS += offsetCorrection / 100;
            this.world.parent.tools.cursor.updateTarget(this.vec.set(0,0,0)); // Debug visualize the temporal offset
            this.world.parent.tools.cursor.updateLabel(this.nowToLeapOffsetUS);

            let interpolatedFrameTimestamp = nowTimestamp + this.nowToLeapOffsetUS;
            //this.getInterpolatedFrame(this.interpolatedFrame, this.controller, interpolatedFrameTimestamp);
            this.interpolatedFrame = latestFrame;

            if (this.world.inVR != this.curInVR) {
                this.controller.setOptimizeHMD(this.world.inVR);
                if (this.world.inVR) {
                    // HMD Mode
                    this.handParent.position.y = 0;
                    this.handParent.position.z = -0.100;
                    this.handParent.quaternion.setFromEuler(this.hmdEuler);
                } else {
                    // Desktop Mode
                    this.handParent.position.y = -0.300;
                    this.handParent.position.z = -0.400;
                    this.handParent.quaternion.identity();
                }
                this.curInVR = this.world.inVR;
            }

            let handsAreTracking = false;
            for (let type in this.hands) {
                this.hands[type].markForHiding = true;
            }
            for (let h = 0; h < this.interpolatedFrame.hands.length; h++) {
                let hand = this.interpolatedFrame.hands[h];
                if (hand.type in this.hands) {
                    handsAreTracking = true;
                    this.updateHand(hand);
                    this.updatePinching(hand);

                    // First Hand that shows up becomes "the main hand"
                    if (!this.mainHand) { this.mainHand = hand.type; }
                } else {
                    this.createHand(hand);
                }
            }
            for (let type in this.hands) {
                if (this.hands[type].markForHiding) {
                    this.hands[type].visible = false;
                }
            }

            if (this.isActive()) {
                // Set Ray Origin and Direction
                let curSphere = this.pinchSpheres[this.mainHand];
                if (curSphere) {

                    this.world.camera.getWorldPosition(this.ray.ray.origin);

                    // Approximate shoulder position with magic values.
                    // TODO: Port to three.js
                    //this.world.camera.getWorldPosition(this.vec);
                    //let shoulderYaw      = Quaternion.Euler(0, headTransform.quaternion.eulerAngles.y, 0);
                    //let ProjectionOrigin = this.vec
                    //                        + (shoulderYaw * (new THREE.Vector3(0, -0.13, -0.1)
                    //                        + this.vec2((hand.IsLeft ? 1 : -1), 0, 0) * 0.15));
                    //let ProjectionDirection = hand.Fingers[1].bones[0].NextJoint.ToVector3() - ProjectionOrigin;

                    this.ray.ray.direction.copy(curSphere.position).sub(this.ray.ray.origin).normalize();
                }

                // Add Extra Fields for the active state
                this.ray.justActivated = false; this.ray.justDeactivated = false;
                this.ray.active = curSphere.visible;
                if ( this.ray.active && !this.prevActive) { this.ray.justActivated   = true; this.activeTime = 0; }
                if (!this.ray.active &&  this.prevActive) { this.ray.justDeactivated = true; }
                this.ray.alreadyActivated = false;
                this.prevActive = this.ray.active;
                if (this.ray.active) { this.activeTime += performance.now() - this.lastTimestep; }
                this.ray.activeMS = this.activeTime;
                this.lastTimestep = performance.now();
            }

            // HACK: Reset the world's camera parenting scheme so orbit controls still work
            if (!handsAreTracking && this.world.handsAreTracking && !this.world.inVR) {
                this.world.scene.attach(this.world.camera);
                this.world.cameraParent.position  .set(0, 0, 0);
                this.world.cameraParent.quaternion.identity();
                this.world.cameraParent.scale     .set(1, 1, 1);
                this.world.cameraParent.attach(this.world.camera);
                this.world.controls.target.copy(this.world.camera.localToWorld(new THREE.Vector3( 0, 0, -300)));
            }
            this.world.handsAreTracking = handsAreTracking;
            if (!handsAreTracking || !this.hands[this.mainHand].visible) { this.mainHand = null; }
            this.lastFrameTimestamp = latestFrame.timestamp;
        }
    }

    /** Does this input want to take control? */
    isActive() { return this.world.handsAreTracking && this.mainHand; }

    /** Update the pinch state of the hands 
     * @param {Hand} hand */
    updatePinching(hand) {
        let pinchSphere = this.pinchSpheres[hand.type];
        let handGroup   = this.hands       [hand.type];

        // Read the Index and Thumb Tip positions into vec and vec2
        handGroup.joints.getMatrixAt(4, this.mat1); this.mat1.decompose(this.vec , this.quat, this.vec3);
        handGroup.joints.getMatrixAt(9, this.mat1); this.mat1.decompose(this.vec2, this.quat, this.vec3);

        // Check pinching with local fingertip positions
        if (handGroup.visible &&
            this.vec.distanceTo(this.vec2) <
                ((pinchSphere.visible || pinchSphere.invalidPinch) ? 40 : 20)) { // Use hysteresis to mitigate spurious pinches

            // If the hand is too young and it starts pinching... that's no good.
            if (pinchSphere.invalidPinch || (!(pinchSphere.visible) && handGroup.ageMs < 300)) {
                pinchSphere.invalidPinch = true; return;
            }
            
            // This hand is pinching in a valid way, push it through
            pinchSphere.visible = true;
            //

        } else {
            pinchSphere.visible = false;
            pinchSphere.invalidPinch = false;
        }

        let worldScale = handGroup.getWorldScale(this.vec).x;
        // Unfiltered Palm-Relative Pinching position
        handGroup.localToWorld(this.vec.copy(handGroup.localPinchPos));
        // Keep the pinch point within a 10mm sphere in Unscaled World Space
        pinchSphere.position.sub(this.vec).clampLength(0, 10 * worldScale).add(this.vec);
        //pinchSphere.position.lerp(this.vec, 0.01);
        handGroup.getWorldQuaternion(pinchSphere.quaternion);
        pinchSphere.updateWorldMatrix(true, true);
    }

    /** Create the hand's meshes
     * @param {Hand} hand */
    createHand(hand) {
        let handGroup      = new THREE.Group();
        handGroup.name     = hand.type + " Hand";
        handGroup.handType = hand.type; 
        handGroup.visible  = true;
        handGroup.startMs  = performance.now();
        handGroup.age      = 0;
        handGroup.frustumCulled = false;

        handGroup.bones = new THREE.InstancedMesh(
            new THREE.CylinderBufferGeometry(5, 5, 1),
            new THREE.MeshPhongMaterial(), 32);
        //handGroup.bones.castShadow = true;
        handGroup.bones.layers.set(1);
        handGroup.add(handGroup.bones);

        let jointMat = new THREE.MeshPhongMaterial();
        jointMat.color = new THREE.Color(0, 0.53, 0.808);
        handGroup.joints = new THREE.InstancedMesh(
            new THREE.SphereBufferGeometry(1, 10, 10),
            jointMat, 32);
        //handGroup.joints.castShadow = true;
        handGroup.joints.layers.set(1);
        handGroup.add(handGroup.joints);

        // At Pinch Point
        //handGroup.localPinchPos = new THREE.Vector3(32 * (hand.type==='left'?-1:1), -50, 20);
        // Outside of Pinch Point
        handGroup.localPinchPos = new THREE.Vector3(10 * (hand.type==='left'?-1:1), -60, 40);
        handGroup.arrow = new THREE.ArrowHelper(this.vec.set(0, -1, 0), handGroup.localPinchPos, 0, 0x00ffff, 10, 10);
        //handGroup.arrow.visible = false;
        handGroup.arrow.layers.set(1);
        handGroup.arrow.cone.layers.set(1);
        handGroup.arrow.line.layers.set(1);
        handGroup.arrow.frustumCulled = false;
        handGroup.add(handGroup.arrow);

        this.handParent.add(handGroup);
        this.hands[hand.type] = handGroup;
    }

    /** Update the hand's meshes
     * @param {Hand} hand */
    updateHand(hand) {
        let handGroup = this.hands[hand.type];
        if (!(handGroup.visible)) {
            handGroup.startMs = performance.now();
            handGroup.ageMs = 0;
        } else {
            handGroup.ageMs = performance.now() - handGroup.startMs;
        }
        handGroup.visible = true;

        // Set Hand Palm Position
        handGroup.position.fromArray(hand.palmPosition);

        // Set Hand Palm Rotation
        this.palmDirection.fromArray(hand.direction );
        this.palmNormal   .fromArray(hand.palmNormal);
        this.vec.set(0, 0, 1);
        handGroup.quaternion.setFromUnitVectors(this.vec, this.palmDirection);
        this.vec.set(0, -1, 0).applyQuaternion(handGroup.quaternion);
        this.quat.setFromUnitVectors(this.vec, this.palmNormal);
        handGroup.quaternion.premultiply(this.quat);
        handGroup.updateMatrix();

        // Update the Hand Ray Arrow Helper...
        handGroup.arrow.visible = handGroup.handType === this.mainHand;
        handGroup.arrow.setDirection(this.vec.copy(this.ray.ray.direction).
            applyQuaternion(handGroup.getWorldQuaternion(this.quat2).invert()));

        // Create a to-local-space transformation matrix
        let toLocal = handGroup.matrix.clone().invert();

        let boneIdx = 0, jointIdx = 0;
        hand.fingers.forEach((finger, index) => {
            finger.bones.forEach((bone, i) => {
                // Sets up this bone's instance matrix
                this.mat1.fromArray(bone.matrix());
                this.mat1.decompose(this.vec, this.quat, this.vec2);
                this.vec2.set(1, bone.length, 1);
                this.quat.multiply (this.baseBoneRotation);
                this.mat1.compose  (this.vec.fromArray(bone.center()), this.quat, this.vec2);

                // Transforms into the local-space of the hand
                this.mat1.premultiply(toLocal);

                handGroup.bones.setMatrixAt(boneIdx, this.mat1);
                boneIdx++;
            });

            for (let i = 0; i < finger.bones.length + 1; i++) {
                let bone = finger.bones[i];
                if (bone) {
                    this.vec.fromArray(bone.prevJoint);
                } else {
                    bone = finger.bones[i - 1];
                    this.vec.fromArray(bone.nextJoint);
                }
                this.quat.identity();
                this.vec2.set(8, 8, 8);

                // Transforms into the local-space of the hand group
                this.mat1.compose(this.vec, this.quat, this.vec2).premultiply(toLocal);

                handGroup.joints.setMatrixAt(jointIdx, this.mat1);
                jointIdx++;
            }

        });

        handGroup.bones .count = boneIdx;
        handGroup.joints.count = jointIdx;
        handGroup.bones .instanceMatrix.needsUpdate = true;
        handGroup.joints.instanceMatrix.needsUpdate = true;

        handGroup.markForHiding = false;
        this.world.dirty = true;
    }

    getExampleFrameJSON() {
        return JSON.parse('{"currentFrameRate":60.69957,"devices":[],"hands":[{"armBasis":[[-0.741769,-0.615521,-0.266295],[0.213992,0.159086,-0.963794],[0.635599,-0.771897,0.013711]],"armWidth":60.961391,"confidence":1,"direction":[-0.257252,0.894977,-0.364469],"elbow":[279.411011,-100.835487,164.831589],"grabAngle":0.458213,"grabStrength":0,"id":280,"palmNormal":[-0.36367,0.259772,0.894574],"palmPosition":[93.363213,172.293121,143.529602],"palmVelocity":[-1233.282349,-1093.435303,9426.487305],"palmWidth":88.979919,"pinchDistance":59.469833,"pinchStrength":0,"timeVisible":0.124918,"type":"right","wrist":[111.590332,102.97274,161.21138]},{"armBasis":[[0.46334,-0.5208,0.716996],[0.360209,-0.628548,-0.689331],[-0.80967,-0.577663,0.103634]],"armWidth":60.961391,"confidence":1,"direction":[0.695266,0.560133,-0.450396],"elbow":[-398.074127,-81.112251,197.169601],"grabAngle":1.847007,"grabStrength":0.017353,"id":281,"palmNormal":[-0.219856,0.762338,0.608691],"palmPosition":[-137.440933,118.850044,137.773209],"palmVelocity":[3967.668945,-6650.443848,19033.183594],"palmWidth":88.979919,"pinchDistance":57.203442,"pinchStrength":0.153614,"timeVisible":0.001606,"type":"left","wrist":[-184.292694,71.411324,169.806442]}],"id":920531,"pointables":[{"bases":[[[-0.085189,-0.203649,-0.975331],[0.983568,-0.173571,-0.049667],[-0.159175,-0.963535,0.215089]],[[-0.039554,0.041569,-0.998352],[0.978526,-0.200665,-0.047124],[-0.202293,-0.978778,-0.032739]],[[-0.038438,0.014339,-0.999158],[0.958734,0.282402,-0.03283],[0.281694,-0.959189,-0.024603]],[[-0.022933,-0.010863,-0.999678],[0.683768,0.729318,-0.023611],[0.729339,-0.684089,-0.009297]]],"btipPosition":[110.115547,222.195312,177.526825],"carpPosition":[122.452057,129.037704,174.903427],"dipPosition":[123.045364,210.067703,177.362],"direction":[-0.281694,0.959189,0.024603],"extended":false,"handId":280,"id":2800,"length":51.386452,"mcpPosition":[122.452057,129.037704,174.903427],"pipPosition":[132.526703,177.783005,176.53392],"timeVisible":0.124918,"tipPosition":[110.115547,222.195312,177.526825],"type":0,"width":19.184837},{"bases":[[[-0.925785,-0.20726,-0.316172],[0.344326,-0.116989,-0.931533],[0.156081,-0.971266,0.179671]],[[-0.906886,-0.296644,-0.299265],[0.339006,-0.091828,-0.936292],[0.250264,-0.950563,0.183842]],[[-0.906886,-0.296644,-0.299265],[0.339006,-0.091828,-0.936292],[0.250264,-0.950563,0.183842]],[[-0.794635,-0.490105,-0.358261],[-0.126948,0.711232,-0.691399],[0.593665,-0.50393,-0.627388]]],"btipPosition":[85.874283,271.054199,133.660294],"carpPosition":[121.236984,132.007706,150.651672],"dipPosition":[93.501442,264.579926,125.599876],"direction":[-0.250264,0.950563,-0.183842],"extended":true,"handId":280,"id":2801,"length":57.659683,"mcpPosition":[110.007828,201.884781,137.725327],"pipPosition":[99.424805,242.081604,129.951126],"timeVisible":0.124918,"tipPosition":[85.874283,271.054199,133.660294],"type":1,"width":18.325356},{"bases":[[[-0.94123,-0.313575,-0.125524],[0.186197,-0.17164,-0.967404],[0.281809,-0.933922,0.219939]],[[-0.950586,-0.279845,-0.134436],[0.20183,-0.228002,-0.952512],[0.235904,-0.932578,0.273217]],[[-0.939121,-0.319361,-0.126726],[0.149751,-0.048498,-0.987534],[0.309234,-0.946391,0.09337]],[[-0.907871,-0.397135,-0.134367],[0.008603,0.30278,-0.953022],[0.419162,-0.866376,-0.271468]]],"btipPosition":[65.418533,276.664764,118.785828],"carpPosition":[110.288864,130.341629,145.509354],"dipPosition":[71.305687,264.49646,114.973038],"direction":[-0.309234,0.946391,-0.09337],"extended":true,"handId":280,"id":2802,"length":65.484474,"mcpPosition":[91.061943,194.060089,130.503601],"pipPosition":[79.890442,238.223343,117.565125],"timeVisible":0.124918,"tipPosition":[65.418533,276.664764,118.785828],"type":2,"width":17.997934},{"bases":[[[-0.900841,-0.433755,-0.018503],[0.127363,-0.223289,-0.966396],[0.415047,-0.872926,0.256392]],[[-0.938941,-0.340721,-0.04794],[0.146955,-0.271128,-0.951259],[0.311116,-0.900222,0.304644]],[[-0.949049,-0.310106,-0.056037],[0.108849,-0.15571,-0.981787],[0.295733,-0.937864,0.181531]],[[-0.946963,-0.316705,-0.054398],[0.138094,-0.248219,-0.958811],[0.290158,-0.91547,0.278789]]],"btipPosition":[47.73951,258.609528,106.740639],"carpPosition":[98.775993,127.759872,144.545593],"dipPosition":[51.786552,245.84079,110.629112],"direction":[-0.295733,0.937864,-0.181531],"extended":true,"handId":280,"id":2803,"length":62.716713,"mcpPosition":[73.351776,181.231979,128.839996],"pipPosition":[59.739567,220.619247,115.510941],"timeVisible":0.124918,"tipPosition":[47.73951,258.609528,106.740639],"type":3,"width":17.126175},{"bases":[[[-0.855327,-0.488975,0.171228],[0.021864,-0.364273,-0.931036],[0.517627,-0.792596,0.322263]],[[-0.924314,-0.363021,0.117723],[0.036114,-0.39029,-0.919984],[0.37992,-0.846102,0.37386]],[[-0.938624,-0.328106,0.106454],[-0.033588,-0.220213,-0.974873],[0.343304,-0.918615,0.195676]],[[-0.936374,-0.334037,0.107805],[-0.024355,-0.244563,-0.969328],[0.350157,-0.910279,0.220867]]],"btipPosition":[33.103168,225.62056,112.484985],"carpPosition":[86.270035,123.132072,149.993027],"dipPosition":[37.552216,214.054672,115.29129],"direction":[-0.343304,0.918615,-0.195676],"extended":true,"handId":280,"id":2804,"length":48.332447,"mcpPosition":[56.9184,168.075638,131.71933],"pipPosition":[43.902016,197.063843,118.910545],"timeVisible":0.124918,"tipPosition":[33.103168,225.62056,112.484985],"type":4,"width":15.212808},{"bases":[[[0.607675,-0.703004,-0.36948],[-0.723737,-0.29863,-0.622114],[-0.327011,-0.645449,0.69026]],[[0.694936,-0.378987,-0.611092],[-0.713933,-0.262226,-0.649259],[-0.085816,-0.887472,0.452802]],[[0.695549,-0.375276,-0.612683],[-0.686158,-0.094067,-0.721345],[-0.21307,-0.922128,0.322926]],[[0.695384,-0.376028,-0.612408],[-0.69355,-0.127954,-0.708955],[-0.188227,-0.917731,0.349771]]],"btipPosition":[-175.683243,190.305817,114.221466],"carpPosition":[-190.68158,97.633118,154.314957],"dipPosition":[-179.086655,173.711945,120.545822],"direction":[0.21307,0.922128,-0.322926],"extended":true,"handId":281,"id":2810,"length":52.288063,"mcpPosition":[-190.68158,97.633118,154.314957],"pipPosition":[-186.375076,142.169037,131.592056],"timeVisible":0.001606,"tipPosition":[-175.683243,190.305817,114.221466],"type":0,"width":19.184837},{"bases":[[[0.791323,-0.22553,0.568281],[0.302052,-0.663918,-0.684088],[-0.531575,-0.712986,0.457252]],[[0.77746,-0.250469,0.576907],[0.503903,-0.300825,-0.809682],[-0.376348,-0.920201,0.107667]],[[0.782822,-0.231089,0.577743],[0.604639,0.063198,-0.793988],[-0.14697,-0.970878,-0.189198]],[[0.780368,-0.20463,0.590891],[0.547391,0.680366,-0.487304],[0.302305,-0.703725,-0.642949]]],"btipPosition":[-121.038895,207.012878,116.88665],"carpPosition":[-174.6483,85.778328,141.802322],"dipPosition":[-117.22908,198.14415,108.783852],"direction":[0.14697,0.970878,0.189198],"extended":true,"handId":281,"id":2811,"length":56.745274,"mcpPosition":[-136.40448,137.073624,108.905602],"pipPosition":[-120.638252,175.623291,104.395134],"timeVisible":0.001606,"tipPosition":[-121.038895,207.012878,116.88665],"type":1,"width":18.325356},{"bases":[[[0.649066,-0.203275,0.733071],[0.419742,-0.707981,-0.56796],[-0.634453,-0.676344,0.374203]],[[0.684033,-0.154658,0.712867],[0.564495,-0.506723,-0.651596],[-0.462001,-0.848123,0.259311]],[[0.682623,-0.159266,0.713204],[0.723944,0.014293,-0.68971],[-0.099654,-0.987132,-0.125057]],[[0.682959,-0.164192,0.711764],[0.694239,0.448921,-0.562585],[0.227154,-0.878357,-0.420583]]],"btipPosition":[-99.886269,209.464905,119.661224],"carpPosition":[-164.527985,83.926865,148.111237],"dipPosition":[-96.729744,197.259262,113.816803],"direction":[0.099654,0.987132,0.125057],"extended":true,"handId":281,"id":2812,"length":65.040855,"mcpPosition":[-121.241348,130.07164,122.580582],"pipPosition":[-99.479507,170.02121,110.366104],"timeVisible":0.001606,"tipPosition":[-99.886269,209.464905,119.661224],"type":2,"width":17.997934},{"bases":[[[0.515125,-0.246636,0.820863],[0.444604,-0.741895,-0.501916],[-0.732785,-0.623508,0.272513]],[[0.477635,-0.354832,0.803715],[0.848469,0.423667,-0.317187],[0.227959,-0.833427,-0.503422]],[[0.419295,-0.334835,0.843847],[-0.310083,0.82078,0.479758],[0.853253,0.462823,-0.240322]],[[0.409453,-0.341558,0.845983],[-0.503556,0.68863,0.521747],[0.760775,0.639631,-0.109968]]],"btipPosition":[-156.962814,134.652985,170.177307],"carpPosition":[-155.874969,82.69458,156.162231],"dipPosition":[-145.435898,144.344376,168.511124],"direction":[-0.853253,-0.462823,0.240322],"extended":false,"handId":281,"id":2813,"length":65.776863,"mcpPosition":[-110.987343,120.888344,139.469116],"pipPosition":[-121.024765,157.58551,161.63562],"timeVisible":0.001606,"tipPosition":[-156.962814,134.652985,170.177307],"type":3,"width":17.126175},{"bases":[[[0.346261,-0.191147,0.918458],[0.452814,-0.823376,-0.342071],[-0.821622,-0.534336,0.198549]],[[0.195929,-0.318987,0.927286],[0.71609,-0.59949,-0.35753],[-0.669946,-0.73407,-0.110966]],[[0.309514,-0.076507,0.947812],[0.940887,-0.119594,-0.316906],[-0.137599,-0.989871,-0.034968]],[[0.286058,0.131559,0.949138],[0.890198,0.330039,-0.314041],[0.354568,-0.934755,0.022703]]],"btipPosition":[-84.040154,169.7798,161.988113],"carpPosition":[-151.891724,82.871346,169.02153],"dipPosition":[-79.404129,157.557739,162.284958],"direction":[0.137599,0.989871,0.034968],"extended":false,"handId":281,"id":2814,"length":49.524498,"mcpPosition":[-105.302269,113.170486,157.762985],"pipPosition":[-82.029541,138.670776,161.617752],"timeVisible":0.001606,"tipPosition":[-84.040154,169.7798,161.988113],"type":4,"width":15.212808}],"timestamp":439217709806}');
    }


}

export { LeapHandInput };
