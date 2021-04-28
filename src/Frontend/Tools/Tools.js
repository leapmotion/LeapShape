/**
 * Copyright 2021 Ultraleap, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { LeapShapeEngine } from '../../Backend/main.js';
import { Menu } from './General/Menu.js';
import { World } from '../World/World.js';

import { Grid } from './General/Grid.js';
import { Cursor } from './General/Cursor.js';
import { Alerts } from './General/Alerts.js';

import { DefaultTool } from './DefaultTool.js';
import { UnionTool } from './UnionTool.js';
import { DifferenceTool } from './DifferenceTool.js';
import { CopyTool } from './CopyTool.js';
import { RemoveTool } from './RemoveTool.js';
import { CleanEdgesTool } from './CleanEdgesTool.js';
import { BoxTool } from './BoxTool.js';
import { SphereTool } from './SphereTool.js';
import { CylinderTool } from './CylinderTool.js';
import { ExtrusionTool } from './ExtrusionTool.js';
import { FilletTool } from './FilletTool.js';
import { OffsetTool } from './OffsetTool.js';
import { UndoTool } from './UndoTool.js';
import { RedoTool } from './RedoTool.js';

/** This class controls all of the Tool and Menu State Machines */
class Tools {
    
    /** Initialize the Main-Thread App Context
     * @param {World} world
     * @param {LeapShapeEngine} engine */
    constructor(world, engine) {
        this.world = world; this.engine = engine;

        this.grid = new Grid(this);
        this.cursor = new Cursor(this);
        this.alerts = new Alerts(this);

        this.tools = [
            new DefaultTool   (this),
            new UndoTool      (this),
            new RedoTool      (this),
            new UnionTool     (this),
            new DifferenceTool(this),
            new CopyTool      (this),
            new RemoveTool    (this),
            new CleanEdgesTool(this),
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
        this.alerts.update();
    }

}

export { Tools };
