/**
 * All credits to Runi95 for 99% of the work of these modules
 */

import { AbstractActionButton } from './Buttons/AbstractActionButton';
import { WarcraftMaul } from '../../WarcraftMaul';
import { ExampleMaze } from './Buttons/ExampleMaze';
import { ClaimButton } from './Buttons/ClaimButton';
import {Frame} from "w3ts";

export class ActionBar {
    private readonly game: WarcraftMaul;
    private readonly actionBarY: number = 0.143;
    private readonly actionBarHeight: number = 0.02;
    private readonly actionBarButtonsSpaceBetween: number = 0.0247;
    private readonly actionBarX: number = 0.4 - this.actionBarButtonsSpaceBetween * 2;
    private readonly buttons: AbstractActionButton[] = [];

    constructor(game: WarcraftMaul) {
        this.game = game;
        const baseFrame = Frame.fromOrigin(ORIGIN_FRAME_GAME_UI, 0)!;
        const actionbar = Frame.createType('actiobarBackdrop', baseFrame, 0, 'BACKDROP', '')!;
        const barHeightOffset: number = 6.5;
        const barHeight: number = 0.03;
        actionbar.setSize(barHeightOffset * barHeight, barHeight)
        actionbar.setAbsPoint( FRAMEPOINT_CENTER, 0.4, this.actionBarY);
        actionbar.setTexture( 'uiImport/CommandButtons/actionbar.dds', 0, true);

        this.initializeButtons();
    }

    private initializeButtons(): void {
        // if (this.game.debugMode) {
        //     this.buttons.push(new DebugGoldButton(this.game, this.getNextX(), this.getNextY(), this.actionBarHeight, this.buttons.length));
        // }
        this.buttons.push(new ExampleMaze(this.game, this.getNextX(), this.getNextY(), this.actionBarHeight, this.buttons.length));
        this.buttons.push(new ClaimButton(this.game, this.getNextX(), this.getNextY(), this.actionBarHeight, this.buttons.length));

    }

    private getNextX(): number {
        return this.actionBarX + (this.buttons.length % 15 * this.actionBarButtonsSpaceBetween);
    }

    private getNextY(): number {
        return this.actionBarY + (Math.floor(this.buttons.length / 15) * this.actionBarButtonsSpaceBetween);
    }
}
