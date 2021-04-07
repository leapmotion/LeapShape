import { LeapShapeEngine } from '../../Backend/main.js';
import { Menu } from './Menu.js';
import { World } from '../World/World.js';

import { Grid } from './Grid.js';
import { Cursor } from './Cursor.js';

import { DefaultTool } from './DefaultTool.js';
import { UnionTool } from './UnionTool.js';
import { DifferenceTool } from './DifferenceTool.js';
import { BoxTool } from './BoxTool.js';
import { SphereTool } from './SphereTool.js';
import { CylinderTool } from './CylinderTool.js';
import { ExtrusionTool } from './ExtrusionTool.js';
import { FilletTool } from './FilletTool.js';
import { OffsetTool } from './OffsetTool.js';

/** This class controls all of the Tool and Menu State Machines */
class Tools {
    
    /** Initialize the Main-Thread App Context
     * @param {World} world
     * @param {LeapShapeEngine} engine */
    constructor(world, engine) {
        this.world = world; this.engine = engine;

        this.grid = new Grid(this);
        this.cursor = new Cursor(this);

        this.tools = [
            new DefaultTool   (this),
            new UnionTool     (this),
            new DifferenceTool(this),
            new BoxTool       (this),
            new SphereTool    (this),
            new CylinderTool  (this),
            new ExtrusionTool (this),
            new FilletTool    (this),
            new OffsetTool    (this)
        ];

        this.activeTool = null;
    }

    /** Update the Tool and Menu State Machines
     * @param {THREE.Ray} ray The Current Input Ray */
    update(ray) {
        if (this.menu) {
            // Let the user/menus set the activeTool
            this.menu.update(ray);
        } else if(this.engine.started) {
            // Create the menu system, which will 
            // be populated from the List of Tools
            this.menu = new Menu(this);
            this.world.dirty = true; // Update the rendered view
        }

        if (!this.activeTool) {
            this.tools[0].activate();
        }
        this.activeTool.update(ray);
        this.cursor.update();
    }

}

export { Tools };
