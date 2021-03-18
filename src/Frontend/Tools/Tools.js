import { LeapShapeEngine } from '../../Backend/main.js';
import { Menu } from './Menu.js';
import { World } from '../World/World.js';
import { SphereTool } from './SphereTool.js';

/** This class controls all of the Tool and Menu State Machines */
class Tools {
    
    /** Initialize the Main-Thread App Context
     * @param {World} world
     * @param {LeapShapeEngine} engine */
    constructor(world, engine) {
        this.world = world;
        this.engine = engine;

        this.tools = [
            new SphereTool(this)
        ];

        // Create the menu system, which will 
        // be populated from the List of Tools
        this.menu = new Menu(this);

        this.activeTool = null;
    }

    /** Update the Tool and Menu State Machines
     * @param {THREE.Ray} ray The Current Input Ray */
    update(ray) {
        // Check the menus for interactions first
        // Activate Tools from here
        this.menu.update(ray);

        if (this.activeTool) {
            this.activeTool.update(ray);
        } else {
            // Update the selection tool?
        }

    }

}

export { Tools };
