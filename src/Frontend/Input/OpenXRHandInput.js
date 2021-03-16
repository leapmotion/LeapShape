/**
 * This is the OpenXR Hand Tracking-based Input
 */
 class OpenXRHandInput {
    
    constructor() { this.ray = null; }

    /** Updates visuals and regenerates the input ray */
    update(world) {
        
    }

    /** Does this input want to take control? */
    isActive() {
        return false;
    }

}

export { OpenXRHandInput };
