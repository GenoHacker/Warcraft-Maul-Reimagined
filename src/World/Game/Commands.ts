import {WarcraftMaul} from '../WarcraftMaul';
import {COLOUR_CODES, NO_LIVES_LOST} from '../GlobalSettings';
import {Defender} from '../Entity/Players/Defender';
import {Log} from '../../lib/Serilog/Serilog';
import {CheckPoint} from '../Entity/CheckPoint';
import {AdvancedHoloMaze} from '../Holograms/AdvancedHoloMaze';
import {SimpleHoloMaze} from '../Holograms/SimpleHoloMaze';
import {CircleHoloMaze} from '../Holograms/CircleHoloMaze';
import {Rectangle} from '../../JassOverrides/Rectangle';
import {SpawnedCreeps} from '../Entity/SpawnedCreeps';
import {TimedEvent} from '../../lib/WCEventQueue/TimedEvent';
import {DummyPlayer} from '../Entity/EmulatedPlayer/DummyPlayer';
import {Maze, Walkable} from '../Antiblock/Maze';
import {COLOUR, DecodeFourCC, SendMessage, Util} from "../../lib/translators";
import {Effect, Frame, MapPlayer, Timer, Trigger, Unit} from "w3ts";
import {Image} from "../../JassOverrides/Image";
import {HybridRandomCommandButton} from "./Ui/HybridRandomCommandButton";

/**
 * Gets a random number between a range.
 */
function RandomChoice<T>(a: Array<T>): T {
    return a[Math.floor(Math.random() * a.length)];
}

export class Commands {

    public commandTrigger: Trigger;
    public game: WarcraftMaul;
    private voteKickInProgress: boolean = false;
    private voteAgainstPlayer: Defender | undefined;
    private hasVotedToKick: boolean[] = [];
    private voteKickTimer: timer = CreateTimer();
    private drawings: Image[][] = [];
    private points: Image[] = [];


    constructor(game: WarcraftMaul) {
        this.game = game;
        this.commandTrigger = Trigger.create();

        this.commandTrigger.addAction(() => this.handleCommand());
        for (let i: number = 0; i < bj_MAX_PLAYER_SLOTS; i++) {
            this.hasVotedToKick[i] = false;
        }
    }

    private handleDebugCommand(player: Defender, command: string[], command2: string[]): void {
        Log.Debug(Util.ArraysToString(command));
        let amount: number = 0;
        switch (command[0]) {
            case 'dummy':
                // const dummy1: DummyPlayer = new DummyPlayer(this.game, 11);
                // const dummy2: DummyPlayer = new DummyPlayer(this.game, 12);
                // const dummy3: DummyPlayer = new DummyPlayer(this.game, 10);
                // const dummy4: DummyPlayer = new DummyPlayer(this.game, 9);
                // const dummy5: DummyPlayer = new DummyPlayer(this.game, 8);
                // const dummy6: DummyPlayer = new DummyPlayer(this.game, 7);
                // const dummy7: DummyPlayer = new DummyPlayer(this.game, 6);
                // const dummy8: DummyPlayer = new DummyPlayer(this.game, 5);
                // const dummy9: DummyPlayer = new DummyPlayer(this.game, 4);
                // const dummy10: DummyPlayer = new DummyPlayer(this.game, 3);
                // const dummy11: DummyPlayer = new DummyPlayer(this.game, 2);

                break;
            case 'ui':
                print('Nothing here')
                break;
            case 'openall':
                player.sendMessage('All spawns are now open!');
                this.OpenAllSpawns();
                break;
            case 'gold':
                amount = Util.ParseInt(command[1]);
                if (!amount) {
                    player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Amount'));
                    return;
                }
                player.sendMessage(`Gold was set to |cFFFFCC00${amount}|r`);
                player.setGold(amount);
                break;
            case 'lumber':
                amount = Util.ParsePositiveInt(command[1]);
                if (!amount) {
                    player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Amount'));
                    return;

                }
                player.sendMessage(`Lumber was set to |cFF00C850${amount}|r`);
                player.setLumber(amount);
                break;
            case 'lives':
                amount = Util.ParseInt(command[1]);
                if (!amount) {
                    player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Amount'));
                    return;

                }
                amount = Math.floor(Number(amount));
                this.game.gameLives = amount;
                this.game.startLives = amount;
                player.sendMessage(`Lives were set to |cFFFFCC00${amount}|r`);
                break;
            case 'closeall':
                player.sendMessage('All spawns are now closed!');
                this.CloseAllSpawns();

                break;
            // case 'item':
            //     // player.hybridBuilder?.useItem(player.hybridBuilder?.getItemInSlot(1)!);
            //
            //     print(BlzGetUnitStringField(player.hybridBuilder!.handle, ConvertUnitStringField(FourCC('ubui'))!))
            //     print(BlzSetUnitStringField(player.hybridBuilder!.handle, ConvertUnitStringField(FourCC('ubui'))!, ''))
            //
            //
            //
            //     break;
            // case 'up':
            //     Log.Debug('Keys')
            //     const whichToEnable = Object.keys(HybridSpells);
            //     Log.Debug(`Choice ${whichToEnable}`)
            //
            //     const randomChoice = RandomChoice(whichToEnable);
            //     Log.Debug(`Grab ${randomChoice}`)
            //
            //     const toEnable = HybridSpells[randomChoice]
            //     Log.Debug(`Should enable`)
            //     Log.Debug(`Should enable ${toEnable.newId}`)
            //
            //     for (const spell of Object.values(HybridSpells)) {
            //         let ability = player.hybridBuilder?.getAbility(FourCC(spell.newId));
            //         Log.Debug(`Setting ${spell.newId} ${spell.newId === toEnable.newId ? 'enable': 'disable'}`)
            //         player.hybridBuilder?.removeAbility(BlzGetAbilityId(ability!));
            //         if(spell.newId === toEnable.newId) {
            //             // player.hybridBuilder?.addAbility(FourCC(spell.newId))
            //             // player.hybridBuilder?.setAbilityLevel(FourCC(spell.newId), player.hybridTowers[parseInt(randomChoice)].level)
            //         }
            //     }
            //     // player.hybridBuilder?.issueImmediateOrder('cannibalize');
            //     const ability = HybridSpells['0']
            //     player.hybridBuilder?.addAbility(FourCC(toEnable.newId));
            //     // player.hybridBuilder?.disableAbility()
            //     player.hybridBuilder?.setAbilityLevel(FourCC(toEnable.newId), player.hybridTowers[parseInt(randomChoice)].level)
            //     // player.hybridBuilder?.addAbility(FourCC('AIbt'));
            //     // player.hybridBuilder?.addAbility(FourCC('AIbl'));
            //     // player.hybridBuilder?.addAbility(FourCC('AIbg'));
            //     // player.hybridBuilder?.addAbility(FourCC('AIbb'));
            //     // player.hybridBuilder?.addAbility(FourCC('AIbf'));
            //     // player.hybridBuilder?.addAbility(FourCC('AIbr'));
            //     // player.hybridBuilder?.addAbility(FourCC('AIbs'));
            //     // player.hybridBuilder?.addAbility(FourCC('AIbh'));
            //     player.hybridBuilder?.addItemById(FourCC('itxb'));
            //     player.hybridBuilder?.addItemById(FourCC('itxb'));
            //     player.hybridBuilder?.addItemById(FourCC('itxb'));
            //     player.hybridBuilder?.addItemById(FourCC('itxb'));
            //     player.hybridBuilder?.addItemById(FourCC('itxb'));
            //     player.hybridBuilder?.addItemById(FourCC('itxb'));
            //
            //
            //
            //
            //     // const abilityId = HybridSpells['1'].newId;
            //     // const newValue = !player.metadata['abilityEnabled'];
            //
            //     if (player.isLocal()) {
            //         // BlzFrameClick(BlzGetFrameByName("InventoryButton_0", 0)!);
            //
            //         // Log.Debug(BlzGetOriginFrame(ORIGIN_FRAME_COMMAND_BUTTON, 0))
            //         // let commandButtonFrame = BlzGetOriginFrame(ORIGIN_FRAME_COMMAND_BUTTON, 0);
            //         // const childCount =BlzFrameGetChildrenCount(commandButtonFrame!);
            //         const numberOfButtons = 12; // This is a typical number, but it may vary
            //
            //         for (let i = 0; i < numberOfButtons; i++) {
            //             let abilityButton = Frame.fromName("CommandButton_" + i, 0);
            //             Log.Debug(abilityButton?.id && `${abilityButton?.id}` || `${i} not found`);
            //         }
            //         //
            //         //     // Perform your operations with the abilityButton here
            //         //     // For example, checking if this ability is the one you're looking for
            //         // }
            //
            //
            //     }
            //
            //
            //     // print(abilityId);
            //     // player.hybridBuilder?.incAbilityLevel(FourCC(abilityId))
            //     // const level = player.hybridBuilder?.getAbilityLevel(FourCC(abilityId))
            //     // print(level);
            //     //
            //     // BlzSetAbilityIcon(BlzGetAbilityId(ability!), HybridTierOne.find(a => a.level === level)?.icon!);
            //     break;

            case "test":
                print('Nothing here')

                break;
            case 'diff':
                amount = Util.ParsePositiveInt(command[1]);
                if (!amount) {
                    player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Amount'));
                    return;

                }
                player.sendMessage(`Difficulty was set to ${amount}%`);
                this.game.diffVote.difficulty = amount;
                for (const enemy of this.game.enemies) {
                    enemy.handicap = amount;
                }
                break;
            case 'wave':
                amount = Util.ParsePositiveInt(command[1]);
                if (!amount) {
                    player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Amount'));
                    return;

                }
                if (amount > this.game.worldMap.waveCreeps.length) {
                    player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Amount'));
                    return;
                }
                player.sendMessage(`Current wave was set to ${amount}`);

                if (this.game.worldMap.gameRoundHandler) {
                    this.game.worldMap.gameRoundHandler.currentWave = amount;
                }
                break;
            case 'draw':
                const arr: Maze[] = this.game.worldMap.playerMazes;
                switch (command[1]) {
                    case 'ab':
                    case 'antiblock':
                        break;
                }
                for (let i: number = 0; i < command.length - 2; i++) {
                    if (!command[2 + i]) {
                        Log.Error('Missing arguments');
                        return;
                    }
                    if (!arr) {
                        Log.Error('invalid array');
                        return;
                    }

                    if (!arr[+command[2 + i]]) {
                        Log.Error('invalid index');
                        return;
                    }
                    this.DrawMaze(arr[+command[2 + i]]);

                }

                break;
            case 'undraw':

                this.DestroyDrawings();
                break;
            case 'point':
                this.drawPoint(player!);
                break;
            case 'bird':
                SetCameraField(CAMERA_FIELD_ANGLE_OF_ATTACK, 270, 1);
                break;
            case 'killall':
                const spawnedCreeps: SpawnedCreeps | undefined = this.game.worldMap.spawnedCreeps;
                if (spawnedCreeps !== undefined) {
                    spawnedCreeps.unitMap.forEach(u => u.unit.destroy());
                }
                break;
            case 'events':
                Log.Debug(`TickEvents: ${this.game.towerTicker.GetTickingTowerCount()}`);
                break;
            case 'timer':
                this.TestTimeout();
                break;
            case 'start':
            case 'startwave':
                this.game.waveTimer = 1;
                break;
            // case 'mmd':
            //     switch (command2[1]) {
            //         case 'define':
            //             switch (command2[2]) {
            //                 case 'string':
            //                     this.game.mmd.DefineValue(command2[3], MMDType.String, MMDGoal.None, MMDSuggest.Track);
            //                     break;
            //                 case 'number':
            //                     this.game.mmd.DefineValue(command2[3], MMDType.Number, MMDGoal.Low, MMDSuggest.Track);
            //                     break;
            //                 case 'event':
            //                     this.game.mmd.DefineEvent(command2[3], ...command2.slice(4));
            //                     break;
            //             }
            //             break;
            //         case 'update':
            //             switch (command2[2]) {
            //                 case 'string':
            //                     this.game.mmd.UpdateValueString(command2[3], player.wcPlayer, command2.slice(4).join(' '));
            //                     break;
            //                 case 'number':
            //                     this.game.mmd.UpdateValueNumber(command2[3], player.wcPlayer, MMDOperator.Set, +command2[4]);
            //                     break;
            //                 case 'event':
            //                     this.game.mmd.LogEvent(command2[3], ...command2.slice(4));
            //                     break;
            //             }
            //             break;
            //     }
            //     break;
            case 'leave':
                player.PlayerLeftTheGame();
                break;
            case 'spawn':
                const id: string = command2[1];
                if (id.length === 4) {
                    const u = Unit.create(
                        player, FourCC(id), BlzGetTriggerPlayerMouseX(), BlzGetTriggerPlayerMouseY(), bj_UNIT_FACING);
                    this.game.worldMap.towerConstruction.SetupTower(u!, player);
                }
                break;
            case 'tm':
                player.sendMessage(Util.ArraysToString(this.game.worldMap.playerMazes[player.id].maze));
                PreloadGenStart();
                this.MazeToString(this.game.worldMap.playerMazes[player.id].maze);

                PreloadGenEnd('testmap.txt');
                break;
            case 'sanity':
                this.game.worldMap.playerMazes[player.id].SanityCheck();
                this.game.worldMap.playerMazes[player.id].CheckAll();
                break;
            case 'time':
                amount = Util.ParsePositiveInt(command[1]);
                if (!amount) {
                    player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Amount'));
                    return;

                }
                this.game.waveTimer = amount;
                break;
        }
    }

    private handleCommand(): void {
        const player: Defender | undefined = this.game.players.get(GetPlayerId(GetTriggerPlayer()!));
        if (!player) {
            return;
        }
        if (GetEventPlayerChatString()!.substr(0, 1) !== '-') {
            // Log.Debug(GetEventPlayerChatString());
            Log.Event(0, `{"message":"${GetEventPlayerChatString()}", "sender": "${player.GetLogStr()}"}`);

            return;
        }

        const playerCommand: string = GetEventPlayerChatString()!.substr(1).toLowerCase();
        const playerCommand2: string = GetEventPlayerChatString()!.substr(1);
        const command: string[] = playerCommand.split(' ');
        const command2: string[] = playerCommand2.split(' ');


        Log.Event(4, `{"command":"${Util.ArraysToString(command)}", "sender": "${player.GetLogStr()}"}`);

        if (command[0] === 'air') {
            player.sendMessage('|cFF999999Air:|r 5 / 15 / 20 / 25 / 30');
        } else if (command[0] === 'boss') {
            player.sendMessage('|cFF3737F2Boss:|r 9 / 14 / 19 / 24 / 29 / 31');
        } else if ((command[0] === 'champ') || (command[0] === 'champion')) {
            player.sendMessage('|cFFF2A137Champion:|r 35 / 36');
        } else if (command[0] === 'light') {
            player.sendMessage('|cFF6d7c86Light:|r 4 / 8 / 11 / 16 / 19 / 23 / 27 / 32');
        } else if (command[0] === 'medium') {
            player.sendMessage('|cFF416073Medium:|r 3 / 7 / 12 / 17 / 24 / 28 / 33');
        } else if (command[0] === 'heavy') {
            player.sendMessage('|cFF154360Heavy:|r 2 / 5 / 13 / 15 / 20 / 25 / 30 / 32 / 35');
        } else if (command[0] === 'fortified') {
            player.sendMessage('|cFFCA8500Fortified:|r 10 / 18 / 22 / 26 / 31');
        } else if (command[0] === 'hero') {
            player.sendMessage('|cFF7525FFHero:|r 36');
        } else if (command[0] === 'waves') {
            player.sendMessage(
                `|cFF999999Air:|r 5 / 15 / 20 / 25 / 30
|cFF3737F2Boss:|r 9 / 14 / 19 / 24 / 29 / 31
|cFFF2A137Champion:|r 35 / 36
|cFF6d7c86Light:|r 4 / 8 / 11 / 16 / 19 / 23 / 27 / 32
|cFF416073Medium:|r 3 / 7 / 12 / 17 / 24 / 28 / 33
|cFF154360Heavy:|r 2 / 5 / 13 / 15 / 20 / 25 / 30 / 32 / 35
|cFFCA8500Fortified:|r 10 / 18 / 22 / 26 / 31
|cFF7525FFHero:|r 36`);
        } else if (command[0] === 'buffs') {
            player.sendMessage(
                '|cFFFFCC00Hardened Skin:|r Creeps ignore 2x creep level incoming physical damage\n' +
                '|cFFFFCC00Evasion:|r Creeps will have a 1x creep level chance to evade physical damage\n' +
                '|cFFFFCC00Armor Bonus:|r Increases creep armor by creep level divided by 3\n' +
                '|cFFFFCC00Cripple Aura:|r Whenever a creep takes damage it has a 10% chance to cripple the attacking tower,' +
                'slowing attack speed by 1.5% times creep level\n' +
                '|cFFFFCC00Spell Shield:|r Blocks targetting spells from casting every 4 (minus 0.1 times creep level) second\n' +
                '|cFFFFCC00Tornado Aura:|r Nearby towers are slowed by 1% times creep level\n' +
                '|cFFFFCC00Vampiric Aura:|r Creeps have a 10% chance to heal for 4x creep level\n' +
                '|cFFFFCC00Divine Shield:|r Creeps ignore damage until they\'ve been damaged 1x creep level times\n' +
                '|cFFFFCC00Walk it Off:|r slowed down creeps take 0.5% times creep level less damage\n' +
                '|cFFFFCC00Morning Person:|r creeps heal for 0.5% times creep level of their max health every time they ' +
                'reach a checkpoint (not teleports)');
        } else if (command[0] === 'repick') {
            if (this.RepickConditions(player)) {
                this.RepickActions(player);
            } else {
                DisplayTimedTextToPlayer(player.handle, 0, 0, 5, 'You can only repick before wave 1!');
            }
        } else if ((command[0] === 'sa') || (command[0] === 'sellall')) {
            // player.sendMessage('SellAll Is Disabled');
            //
            // Log.Debug('[command] sellall');
            // player.SellAll();
        } else if (command[0] === 'y' || command[0] === 'yes') {
            this.VoteYes(player);
        } else if (command[0] === 'kick' || command[0] === 'votekick') {
            if (command[1]) {
                const receiver: number = this.getPlayerIdFromColourName(command[1]);
                const receivingPlayer: Defender | undefined = this.game.players.get(receiver);
                if (receivingPlayer) {
                    this.VoteKick(player, receivingPlayer);
                } else {
                    player.sendMessage('Player not available');
                }
            }
        } else if (command[0] === 'give' || command[0] === 'send') {
            const receiver: number = this.getPlayerIdFromColourName(command[1]);
            const receivingPlayer: Defender | undefined = this.game.players.get(receiver);

            const amount: number = Util.ParsePositiveInt(command[2]);
            if (!amount) {
                player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Amount'));
                return;
            }
            this.giveGoldToPlayer(receivingPlayer, player, amount);
        } else if (command[0] === 'allow') {
            // AllowSpecificPlayer();
            if (command[1]) {
                const receiver: number = this.getPlayerIdFromColourName(command[1]);
                const receivingPlayer: Defender | undefined = this.game.players.get(receiver);
                if (receivingPlayer) {
                    player.AllowPlayer(receivingPlayer.id);
                } else {
                    player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Colour'));
                }
            }
        } else if (command[0] === 'deny') {
            // DenySpecificPlayer();
            if (command[1]) {
                const receiver: number = this.getPlayerIdFromColourName(command[1]);
                const receivingPlayer: Defender | undefined = this.game.players.get(receiver);
                if (receivingPlayer) {
                    player.DenyPlayer(receivingPlayer.id);
                    player.ClaimTowers();
                } else {
                    player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Colour'));
                }
            }
        } else if (command[0] === 'allowall') {
            // AllowAllPlayers();
            // for (let i: number = 0; i < 13; i++) {
            //     player.AllowPlayer(i);
            // }.
            player.AllowAllPlayers();
            player.sendMessage('ALL players are now |cFF00FF00allowed|r to build in your spawn!');
        } else if (command[0] === 'denyall') {
            // DenyAllPlayers();
            // for (let i: number = 0; i < 13; i++) {
            //     player.DenyPlayer(i);
            // }
            player.DenyAllPlayers();
            player.ClaimTowers();
            player.sendMessage('ALL players are now |cFFFF0000denied|r access to your spawn!');
        } else if (command[0] === 'claim') {
            player.ClaimTowers();
        } else if (command[0] === 'forceblitz') {
            if (player.isDeveloper) {
                this.game.diffVote.forceBlitz = true;
            }
        } else if (command[0] === 'build') {
            player.setBuildMode(!player.buildMode);
        } else if (command[0] === 'zoom' || command[0] === 'cam') {
            if (GetLocalPlayer() === player.handle) {
                const amount: number = Util.ParsePositiveInt(command[1]);
                if (!amount) {
                    player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Amount'));
                    return;

                }
                SetCameraField(CAMERA_FIELD_TARGET_DISTANCE, amount, 1);
            }
        } else if (command[0] === 'dt' || command[0] === 'disabletowers') {
            // player.DisableTowers();
            player.sendMessage('This command has been removed.');
        } else if (command[0] === 'buildings' || command[0] === 'towers') {
            if (command[1]) {
                const receiver: number = this.getPlayerIdFromColourName(command[1]);
                const receivingPlayer: Defender | undefined = this.game.players.get(receiver);
                if (receivingPlayer) {
                    if (receivingPlayer.hasHybridRandomed) {
                        for (const tower of receivingPlayer.hybridTowers) {
                            player.sendMessage(GetLocalizedString(tower.name) || '');
                        }
                    } else {
                        player.sendMessage(`${receivingPlayer.getNameWithColour()} has not hybrid randomed.`);

                    }
                } else {
                    player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Colour'));
                }
            } else {
                player.sendMessage('Wrong Usage: -buildings <colour>');
            }
        } else if (command[0] === 'maze') {
            let invalidMaze: boolean = false;
            if (command.length === 2) {
                const playerId = MapPlayer.fromEvent()?.id!;
                const firstSpawn: CheckPoint | undefined = this.game.worldMap.playerSpawns[playerId].spawnOne;
                if (firstSpawn === undefined) {
                    return;
                }

                const firstCheckpoint: CheckPoint | undefined = firstSpawn.next;
                if (firstCheckpoint === undefined) {
                    return;
                }

                const secondCheckpoint: CheckPoint | undefined = firstCheckpoint.next;
                if (secondCheckpoint === undefined) {
                    return;
                }

                let imagePath: string = '';
                // if (GetTriggerPlayer() === GetLocalPlayer()) {
                imagePath = 'ReplaceableTextures\\Splats\\SuggestedPlacementSplat.blp';
                // }

                switch (command[1]) {
                    case 'none':
                        player.setHoloMaze(undefined);
                        break;
                    case '1':
                        player.setHoloMaze(
                            new CircleHoloMaze(
                                imagePath,
                                GetRectCenterX(firstCheckpoint.rectangle),
                                GetRectCenterY(firstCheckpoint.rectangle),
                                GetRectCenterX(secondCheckpoint.rectangle),
                                GetRectCenterY(secondCheckpoint.rectangle)));
                        break;
                    case '2':
                        player.setHoloMaze(
                            new SimpleHoloMaze(
                                imagePath,
                                GetRectCenterX(firstCheckpoint.rectangle),
                                GetRectCenterY(firstCheckpoint.rectangle),
                                GetRectCenterX(secondCheckpoint.rectangle),
                                GetRectCenterY(secondCheckpoint.rectangle)));
                        break;
                    case '3':
                        player.setHoloMaze(
                            new AdvancedHoloMaze(
                                imagePath,
                                GetRectCenterX(firstCheckpoint.rectangle),
                                GetRectCenterY(firstCheckpoint.rectangle),
                                GetRectCenterX(secondCheckpoint.rectangle),
                                GetRectCenterY(secondCheckpoint.rectangle)));
                        break;
                    default:
                        invalidMaze = true;
                        break;
                }
            } else {
                invalidMaze = true;
            }

            if (invalidMaze === true) {
                player.sendMessage(
                    'Unknown maze selected, please try one of the mazes shown below\n' +
                    '|cFFFFCC00-maze none|r: removes the current maze\n' +
                    '|cFFFFCC00-maze 1|r: shows a very simple circled maze\n' +
                    '|cFFFFCC00-maze 2|r: shows a basic maze\n' +
                    '|cFFFFCC00-maze 3|r: shows a more advanced maze');
            }
        }
        if (this.game.debugMode) {
            this.handleDebugCommand(player, command, command2);
        }
    }

    public getPlayerIdFromColourName(color: string): number {
        return Util.COLOUR_IDS[color.toUpperCase()];
    }

    public RepickActions(player: Defender): void {
        const grp: group = GetUnitsInRectAll(GetPlayableMapRect()!)!;
        const maxGold: number = player.id === COLOUR.GRAY ? 150 : 100;
        if (player.getGold() > maxGold) {
            player.setGold(maxGold);
        }
        player.setLumber(1);
        ForGroupBJ(grp, () => this.RemovePlayerUnits(player));
        DestroyGroup(grp);
    }

    public RepickConditions(player: Defender): boolean {
        if (!(this.game.worldMap.gameRoundHandler && this.game.worldMap.gameRoundHandler.currentWave === 1)) {
            return false;
        }
        if (this.game.worldMap.gameRoundHandler && this.game.worldMap.gameRoundHandler.isWaveInProgress) {
            return false;
        }
        if (player.hasHardcoreRandomed) {
            return false;
        }
        if (player.hasHybridRandomed) {
            return false;
        }
        return true;
    }

    public RemovePlayerUnits(player: Defender): void {
        const unit = Unit.fromEnum();
        if (unit?.owner.id === player.id) {
            if (this.RepickRemoveConditions(unit)) {
                unit.destroy();
            }
        }
    }

    private RepickRemoveConditions(unit: Unit): boolean {
        if (unit.typeId === FourCC('h03S')) {
            return false;
        }

        if (unit.typeId === FourCC('e00C')) {
            return false;
        }

        return true;
    }

    public OpenAllSpawns(): void {
        for (const spawn of this.game.worldMap.playerSpawns) {
            spawn.isOpen = true;
        }
    }

    public CloseAllSpawns(): void {
        for (const spawn of this.game.worldMap.playerSpawns) {
            spawn.isOpen = false;
        }
    }

    private giveGoldToPlayer(receivingPlayer: Defender | undefined, player: Defender, amount: number): void {
        if (receivingPlayer) {
            if (player.getGold() >= amount) {
                player.setGold(player.getGold() - amount);
                receivingPlayer.setGold(receivingPlayer.getGold() + amount);
                player.sendMessage(
                    `You've sent ${Util.ColourString('#FFCC00', `${amount}`)} gold to ${receivingPlayer.getNameWithColour()}`);
                receivingPlayer.sendMessage(
                    `You've received ${Util.ColourString('#FFCC00', `${amount}`)} gold from ${player.getNameWithColour()}`);

            } else {
                player.sendMessage('You do not have this much gold');
            }
        } else {
            player.sendMessage(Util.ColourString(COLOUR_CODES[COLOUR.RED], 'Invalid Receiver'));
        }
    }

    private VoteKick(player: Defender, receivingPlayer: Defender): void {
        if (!this.voteKickInProgress) {
            if (player !== receivingPlayer) {
                SendMessage(
                    `${player.getNameWithColour()} has started a votekick for ${receivingPlayer.getNameWithColour()} (say -y to vote)`);
                this.voteKickInProgress = true;
                this.voteAgainstPlayer = receivingPlayer;
                this.hasVotedToKick[player.id] = true;
                this.game.timedEventQueue.AddEvent(new TimedEvent(() => this.VotekickExpire(), 300, false));

            } else {
                player.sendMessage('You idiot, you cannot stomp your own ass with the front of your own foot.');
                // this.game.timedEventQueue.AddEvent(new TimedEvent(() => this.VotekickExpire(), 30, false));
                // TimerStart(this.voteKickTimer, 30.00, false, () => this.VotekickExpire());
            }
        } else {
            player.sendMessage('There is already a votekick in progress');
        }

    }

    private VotekickExpire(): boolean {
        const count: number = this.CountCurrentVotes();
        if (this.voteAgainstPlayer) {
            SendMessage(`Votekick for ${this.voteAgainstPlayer.getNameWithColour()} has ended with ${count} votes`);
        }
        this.voteKickInProgress = false;
        return true;
    }

    private VoteYes(player: Defender): void {
        if (this.voteKickInProgress) {
            if (!this.hasVotedToKick[player.id]) {
                if (!(this.voteAgainstPlayer === player)) {
                    this.hasVotedToKick[player.id] = true;
                    this.CheckVotes();
                } else {
                    player.sendMessage('You can not kick yourself');

                }
            } else {
                player.sendMessage('You have already voted to kick this player');
            }
        } else {
            player.sendMessage('There is no votekick in progress');
        }
    }

    private CheckVotes(): void {
        const currentVotes: number = this.CountCurrentVotes();
        const neededVotes: number = (this.game.players.size / 2) + 1;
        const missingVotes: number = neededVotes - currentVotes;


        if (currentVotes >= neededVotes) {
            if (this.voteAgainstPlayer) {
                this.game.worldMap.playerSpawns[this.voteAgainstPlayer.id].isOpen = false;

                this.RemoveAllKickedPlayerTowers();
                if (this.game.scoreBoard) {
                    MultiboardSetItemValueBJ(this.game.scoreBoard.board, 1, 7 + this.voteAgainstPlayer.scoreSlot,
                        Util.ColourString(this.voteAgainstPlayer.getColourCode(), '<Kicked>'));
                }
                this.game.players.delete(this.voteAgainstPlayer.id);

                SendMessage(`Votekick for ${this.voteAgainstPlayer.getNameWithColour()} has succeeded!`);
                CustomDefeatBJ(this.voteAgainstPlayer.handle, 'Kicked!');

                // DestroyTimer(this.voteKickTimer);
                this.voteKickInProgress = false;
            }
        } else {
            SendMessage(`You'll need ${missingVotes} more votes to kick`);
        }
    }

    private CountCurrentVotes(): number {
        let count: number = 0;
        for (let i: number = 0; i < this.hasVotedToKick.length; i++) {
            if (this.hasVotedToKick[i]) {
                count++;
            }
        }
        return count;
    }

    private RemoveAllKickedPlayerTowers(): void {
        const grp: group = GetUnitsInRectAll(GetPlayableMapRect()!)!;
        ForGroupBJ(GetUnitsInRectAll(GetPlayableMapRect()!)!, () => this.RemoveKickedPlayerTowers());
        DestroyGroup(grp);
    }

    private RemoveKickedPlayerTowers(): void {
        if (this.IsPickedUnitOwnedByKickedPlayer()) {
            const unit = Unit.fromEnum();
            unit?.destroy();
        }
    }

    private IsPickedUnitOwnedByKickedPlayer(): boolean {
        if (!this.voteAgainstPlayer) {
            return false;
        }

        const unit = Unit.fromEnum();
        if (!(unit?.owner.id === this.voteAgainstPlayer.id)) {
            return false;
        }

        return unit.typeId !== FourCC('h03S');


    }

    private DrawRect(rectangle: Rectangle): void {
        const x1: number = rectangle.minX;
        const y1: number = rectangle.minY;
        const x2: number = rectangle.maxX;
        const y2: number = rectangle.maxY;

        const imagePath: string = 'ReplaceableTextures\\Splats\\SuggestedPlacementSplat.blp';


        const sfx: Image[] = [];
        for (let x: number = x1; x < x2; x = x + 16) {
            sfx.push(new Image(imagePath, 96, x, y1, 0.00));
        }

        for (let y: number = y1; y < y2; y = y + 16) {
            sfx.push(new Image(imagePath, 96, x2, y, 0.00));
        }

        for (let x: number = x1; x < x2; x = x + 16) {
            sfx.push(new Image(imagePath, 96, x, y2, 0.00));
        }
        for (let y: number = y1; y < y2; y = y + 16) {
            sfx.push(new Image(imagePath, 96, x1, y, 0.00));
        }
        this.drawings.push(sfx);
        sfx.forEach((img: Image) => {
            img.SetImageRenderAlways(true);
            img.visible = true;
        });
    }

    private DrawMaze(maze: Maze): void {
        const x1: number = maze.minX;
        const y1: number = maze.minY;
        const x2: number = maze.maxX;
        const y2: number = maze.maxY;

        const imagePath: string = 'ReplaceableTextures\\Splats\\SuggestedPlacementSplat.blp';


        const sfx: Image[] = [];
        for (let x: number = x1; x < x2; x = x + 72) {
            sfx.push(new Image(imagePath, 96, x, y1, 0.00));
        }

        for (let y: number = y1; y < y2; y = y + 72) {
            sfx.push(new Image(imagePath, 96, x2, y, 0.00));
        }

        for (let x: number = x1; x < x2; x = x + 72) {
            sfx.push(new Image(imagePath, 96, x, y2, 0.00));
        }
        for (let y: number = y1; y < y2; y = y + 72) {
            sfx.push(new Image(imagePath, 96, x1, y, 0.00));
        }
        this.drawings.push(sfx);
        sfx.forEach((img: Image) => {
            img.SetImageRenderAlways(true);
            img.visible = true;
        });
    }

    private drawPoint(player: Defender): void {
        let playerSpawnId: number | undefined;
        // Find which maze belongs to the player
        // for (let i: number = 0; i < this.game.mapSettings.PLAYER_AREAS.length; i++) {
        //     if (this.game.mapSettings.PLAYER_AREAS[i].ContainsUnit(player.builders[0])) {
        //         playerSpawnId = i;
        //         break;
        //     }
        // }
        //
        // if (playerSpawnId === undefined) {
        //     Log.Debug('Could not find player maze');
        //     return;
        // }

        const playerMouseX = player.mouseX;
        const playerMouseY = player.mouseY;
        const imagePath: string = 'ReplaceableTextures\\Splats\\SuggestedPlacementSplat.blp';

        // const img: Image = new Image(imagePath, 128, player.mouseX-32, player.mouseY-32, 0.00);
        // img.setColour(255, 255, 255, 153);
        // img.SetImageRenderAlways(true);
        // img.ShowImage(true);
        // this.points.push(img);
        const effect = Effect.create('units\\nightelf\\Chimaera\\Chimaera', playerMouseX, playerMouseY);
        effect?.setColor(128, 128, 128);
        effect?.setAlpha(153);
        effect?.setYaw(Deg2Rad(270));
        effect?.setTimeScale(0.01);


        // const maze: Maze = this.game.worldMap.playerMazes[playerSpawnId];
        // const imagePath: string = 'ReplaceableTextures\\Splats\\SuggestedPlacementSplat.blp';
        //
        // // Draw grid points at cell centers
        // for (let x: number = 0; x < maze.width; x++) {
        //     for (let y: number = 0; y < maze.height; y++) {
        //         const xPos = maze.minX + (x * 64) + 32; // Add 32 to center in cell
        //         const yPos = maze.minY + (y * 64) + 32; // Add 32 to center in cell
        //         const img: Image = new Image(imagePath, 64, xPos, yPos, 0.00);
        //
        //         img.setColour(0, 0, 255, 153);
        //         img.SetImageRenderAlways(true);
        //         img.ShowImage(true);
        //         this.points.push(img);
        //     }
        // }
        //
        // player.sendMessage(`Maze dimensions: ${maze.width}x${maze.height}`);
    }


    private DestroyDrawings(): void {
        for (const drawing of this.drawings) {
            for (const sfx of drawing) {
                sfx.Destroy();
            }
        }
        for (const sfx of this.points) {
            sfx.Destroy();
        }
        this.drawings = [];
        this.points = [];
    }

    //
    // private TestUi(): void {
    //     // const fh: framehandle = BlzCreateSimpleFrame('TestPanel', BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0), 0);
    //     // // const fh: framehandle = BlzGetFrameByName('SimpleUnitStatsPanel', 0);
    //     // // BlzFrameClearAllPoints(fh);
    //     // BlzFrameSetSize(fh, 0.1, 0.1);
    //     //
    //     // BlzFrameSetAbsPoint(fh, FRAMEPOINT_CENTER, 0.4, 0.3);
    //     // Log.Debug(ToString(GetHandleId(fh)));
    //     // // BlzFrameSetPoint(fh, FRAMEPOINT_TOP, BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0), FRAMEPOINT_TOP, 0, -0.3);
    //     // // Log.Debug(ToString(BlzFrameGetValue(fh)));
    //     // // BlzFrameSetAbsPoint(fh, FRAMEPOINT_TOP, 0.0, 0.1);
    //     // // BlzFrameSetValue(fh, 100);
    //     // // BlzFrameSetText(BlzGetFrameByName('MyBarText', 0), '');
    //     // // BlzFrameSetTexture(BlzGetFrameByName('MyBarBackground', 0), 'Replaceabletextures\\CommandButtons\\BTNHeroDeathKnight.blp', 0, true);
    //     // // BlzFrameSetTexture(fh, 'Replaceabletextures\\CommandButtons\\BTNArthas.blp', 0, false);
    //     // // BlzFrameSetSize(fh, 0.02, 0.02);
    //     // // TimerStart(CreateTimer(), 0.08, true, () => this.ChangeUI());
    // }
    //
    //
    // private ChangeUI(): void {
    //     const fh: framehandle = BlzGetFrameByName('MyBar', 0);
    //     BlzFrameSetValue(fh, BlzFrameGetValue(fh) + GetRandomReal(-3, 3));
    //
    // }
    private TestTimeout(): void {
        this.game.timedEventQueue.AddEvent(new TimedEvent(() => this.Timeout(), 20, false));
    }

    private Timeout(): boolean {
        Log.Debug('Hello world');
        return true;
    }

    private MazeToString(maze: Walkable[][]): void {
        let output: string = '[';
        Preload(`{"logevent":}`);
        for (let i: number = 0; i < maze.length; i++) {
            if (i === maze.length - 1) {
                Preload(`"${Util.ArraysToString(maze[i])}"`);
                continue;
            }
            Preload(`"${Util.ArraysToString(maze[i])}"`);
        }
    }
}
