import { LeapShapeEngine } from '../Backend/main.js';
import { World } from './World/World.js';
import { Input } from './Input/Input.js';
import { Tools } from './Tools/Tools.js';

/**
 * This is the visualization entrypoint for LeapShape;
 * all visualization and interactivity are managed through here. */
class LeapShapeRenderer {
    
    /** Initialize the Main-Thread App Context
     * @param {LeapShapeEngine} engine */
    constructor(engine) {
        // Store a reference to the CAD Engine
        this.engine = engine;

        // Create the world and set its update loop
        this.world = new World(this.update.bind(this));

        // Create the input abstraction for Mice, Hands, and Controllers
        this.input = new Input(this.world);

        // Create the menu system, which is populated from the List of Tools
        this.tools = new Tools(this.world, engine);
    }

    update() {
        // Update the Input Abstraction
        this.input.update();

        // Update the Tool and Menu State Machines
        this.tools.update(this.input.ray);

        // Render the World
        this.world.update(this.input.ray);
    }

}

export { LeapShapeRenderer };
