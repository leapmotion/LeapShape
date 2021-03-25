import * as THREE from '../../../node_modules/three/build/three.module.js';
import { World } from '../World/World.js';
import { InteractionRay } from './Input.js';

/** This is the standard mouse (and touchscreen?) input. */
class MouseInput {
    /** Initialize Mouse Capture
     * @param {World} world */
    constructor(world) {
        this.world = world;
        this.ray = new InteractionRay(new THREE.Ray());
        this.mouse = { x: 0, y: 0, buttons: -1 };
        //let options = { passive: false, capture: false };
        this.world.container.addEventListener( 'pointermove', this._onContainerMouse.bind(this) );
        this.world.container.addEventListener( 'pointerdown', this._onContainerMouse.bind(this) );
        this.world.container.addEventListener( 'pointerup'  , this._onContainerMouse.bind(this) );
        //this.world.container.addEventListener( 'touchstart', this._onContainerTouch.bind(this) );
        //this.world.container.addEventListener( 'touchmove' , this._onContainerTouch.bind(this) );
        //this.world.container.addEventListener( 'touchend'  , this._onContainerTouchEnd.bind(this) );
        this.prevButton = 0;
    }

    /** Triggered whenever the mouse moves over the application
     * @param {PointerEvent} event */
    _onContainerMouse( event ) {
        event.preventDefault();
        let rect = event.target.getBoundingClientRect();
        this.mouse.x =   ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1;
        this.mouse.y = - ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1;
        this.mouse.buttons = event.buttons;
    }

    ///** Triggered whenever a touch starts or moves over the application
    // * @param {TouchEvent} event */
    //_onContainerTouch( event ) {
    //    event.preventDefault();
    //    let rect = event.target.getBoundingClientRect();
    //    this.mouse.x =   ( ( event.changedTouches[0].clientX - rect.left ) / rect.width ) * 2 - 1;
    //    this.mouse.y = - ( ( event.changedTouches[0].clientY - rect.top ) / rect.height ) * 2 + 1;
    //    this.mouse.buttons = 1;
    //}
    ///** Triggered whenever a touch ends over the application
    // * @param {TouchEvent} event */
    //_onContainerTouchEnd( event ) {
    //    this.mouse.buttons = 0;
    //}

    update() {
        if (this.isActive()) {
            this.ray.ray.origin.setFromMatrixPosition( this.world.camera.matrixWorld );
            this.ray.ray.direction.set(this.mouse.x, this.mouse.y, 0.5)
                .unproject(this.world.camera).sub(this.ray.ray.origin).normalize();
            
            // Add Extra Fields for the active state
            //console.log(this.mouse.button); 
            this.ray.justActivated = false; this.ray.justDeactivated = false;
            this.ray.active = this.mouse.buttons    === 1;
            if ( this.ray.active && this.prevButton === 0) { this.ray.justActivated   = true; }
            if (!this.ray.active && this.prevButton === 1) { this.ray.justDeactivated = true; }
            this.ray.alreadyActivated = false;
            this.prevButton = this.mouse.buttons;
        }
    }

    /** Does this input want to take control? */
    isActive() {
        return true;
    }

}

export { MouseInput };
