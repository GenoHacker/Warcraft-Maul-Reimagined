import * as settings from '../GlobalSettings';
import {WarcraftMaul} from '../WarcraftMaul';
import {MultiBoard} from './MultiBoard';
import {Log} from '../../lib/Serilog/Serilog';
import {ClassicGameRound} from './ClassicMaul/ClassicGameRound';
import {BlitzGameRound} from './BlitzMaul/BlitzGameRound';
import {DebugGameRound} from './DebugMaul/DebugGameRound';
import {MapPlayer, Timer} from "w3ts";
import {SendMessage, Util} from "../../lib/translators";
import {VotePanel} from './Ui/VotePanel';
import {HostSettingsPanel} from './Ui/HostSettingsPanel';
import {Defender} from '../Entity/Players/Defender';
import {SyncTrace} from '../../lib/SyncTrace';
import {votedDifficulty} from './DifficultyVote';
import {Saves} from './Saves';

// The attacker's slot (the creep owner). A host bot sits here, and only here; no normal player can,
// so settings that come from this slot can never be spoofed by a joiner.
const ATTACKER_SLOT = 13;

// The host bot's settings file, in CustomMapData on its own machine. Read once the game is up when a
// human sits in the attacker slot; its -s lines set the game. A fixed, well-known name: the slot-13
// occupant's battletag is not available in-map (the engine reports the map's slot name there), and
// the file is local to the bot's own machine, so one name per machine is enough.
const HOST_FILE = 'WarcraftMaul\\maulbot-host.txt';

// Written on the attacker-slot host bot's own machine the instant it has read HOST_FILE, so the bot
// can leave the moment the read is done - it cannot know from a wall-clock timer when loading
// finished and the in-game read ran. The content is what was read, for the bot to confirm.
const READ_MARKER = 'WarcraftMaul\\maulbot-read.txt';

// Host detection answers within a second or two; after this the players vote instead
const HOST_WAIT = 3.00;
// A host who never confirms must not stall the game
const HOST_DECISION_TIMEOUT = 45.00;
const VOTE_LENGTH = 10.00;

/**
 * Game mode and difficulty. When the host is known they choose both on a settings panel and
 * the game goes straight to race selection. Otherwise (no host detected, the host prefers a
 * vote, or the host never answers) the players vote: mode first, then difficulty - with race
 * selection already open, since the difficulty does not change what can be picked.
 *
 * Panel clicks are frame events; the acting client sends a sync message and every client
 * applies the result in the handler, so the outcome is identical everywhere. A vote ends when
 * every player has voted, or else when its time is up.
 */
export class Vote {
    public game: WarcraftMaul;
    private readonly panel: VotePanel;
    private readonly hostPanel: HostSettingsPanel;
    private awaitingHost: Defender | undefined;

    private votedMode: number[] = [];
    private hasVotedMode: boolean[] = [];
    private votedDiff: number[] = [];
    // A vote ends when everyone has voted or its time is up, whichever comes first - once
    private modeVoteOpen: boolean = false;
    private diffVoteOpen: boolean = false;
    public difficulty: number = 0;
    public forceBlitz: boolean = false;
    // Set once the attacker-slot host bot's settings file has decided the game, so begin() and the
    // fallback timer leave it alone
    private fileSettingsDone: boolean = false;

    constructor(game: WarcraftMaul) {
        this.game = game;
        this.panel = new VotePanel(game);
        this.hostPanel = new HostSettingsPanel(game,
            (mode, difficulty) => game.playerSync.send('game-settings', `${mode}:${difficulty}`),
            () => game.playerSync.send('game-vote'));

        game.playerSync.on('game-settings', (player, data) => this.applyHostSettings(player, data));
        game.playerSync.on('game-vote', player => this.hostChoseVote(player));
        game.playerSync.on('vote-mode', (player, data) => this.recordModeVote(player, Number(data)));
        game.playerSync.on('vote-diff', (player, data) => this.recordDiffVote(player, Number(data)));
        // A host bot in the attacker slot can't click the panel; it reads its settings from a file
        // and syncs the lines. Any player may send on this channel, but applyFileLine takes it only
        // from the attacker slot.
        game.playerSync.onAnyPlayer('hostfile', (player, data) => this.applyFileLine(player, data));

        Timer.create().start(HOST_WAIT, false, () => this.begin());
    }

    private begin(): void {
        // Each player starts looking at their own lane (the race shops the camera used to show
        // are gone; races are picked on the panel)
        for (const player of this.game.players.values()) {
            PanCameraToTimedForPlayer(player.handle, player.getCenterX(), player.getCenterY(), 0.00);
        }
        // A host bot in the attacker slot (a human there, not the usual computer) sets the game from
        // a file it alone holds; wait for that before anything else. No bot there: the normal flow.
        if (GetPlayerController(Player(ATTACKER_SLOT)!) === MAP_CONTROL_USER
            && GetPlayerSlotState(Player(ATTACKER_SLOT)!) === PLAYER_SLOT_STATE_PLAYING) {
            this.awaitFileSettings();
            return;
        }
        const host = this.game.hostDetection.detected ? this.game.hostDetection.host : undefined;
        const hostDefender = host ? this.game.players.get(host.id) : undefined;
        if (hostDefender) {
            this.askHost(hostDefender);
        } else {
            this.startModeVote();
        }
    }

    /**
     * The attacker-slot host bot sets the game from HOST_FILE (it can't click the panel, and leaves
     * before the game runs). Only its own machine holds the file, so that client reads it and syncs
     * each line; every client applies them in applyFileLine. If nothing is applied before the timeout
     * - no file, an empty one, or the bot is already gone - the players vote, as they would with no
     * host.
     */
    private awaitFileSettings(): void {
        if (GetLocalPlayer() === Player(ATTACKER_SLOT)!) {
            const text = Saves.read(HOST_FILE);
            Log.Info(`hostfile: read ${text.length} chars from ${HOST_FILE}`);
            Log.flush();
            for (const line of text.split('\n')) {
                const trimmed = line.trim();
                if (trimmed !== '') {
                    this.game.playerSync.send('hostfile', trimmed);
                }
            }
            Vote.writeReadMarker(text);
        }
        Timer.create().start(HOST_DECISION_TIMEOUT, false, () => {
            if (!this.fileSettingsDone) {
                SendMessage('The host left the game to a vote');
                this.startModeVote();
            }
        });
    }

    /** Writes READ_MARKER on the local (attacker-slot) machine: the host bot's signal to leave now. */
    private static writeReadMarker(text: string): void {
        const [safe] = string.gsub(text, '["\r\n]', ' ');
        PreloadGenClear();
        PreloadGenStart();
        Preload(`read ${text.length} chars: ${safe}`);
        PreloadGenEnd(READ_MARKER);
    }

    /**
     * One line of the host bot's settings file, an `-s` command, applied once. Taken only from the
     * attacker slot - a seat no joiner can occupy - so the file can never be spoofed by a player. The
     * same grammar as the `-s` chat command: a mode, then `vote` to leave the difficulty to the
     * players, or a difficulty percentage to force it.
     */
    private applyFileLine(player: MapPlayer, data: string): void {
        if (this.fileSettingsDone || player.id !== ATTACKER_SLOT) {
            return;
        }
        let words: string[] = data.toLowerCase().split(' ').filter(word => word !== '');
        if (words.length > 0 && (words[0] === '-s' || words[0] === '.s'
            || words[0] === '-settings' || words[0] === '.settings')) {
            words = words.slice(1);
        }
        let mode: number = settings.GAME_MODES.CLASSIC;
        let difficulty: number = settings.DIFFICULTIES[0];
        let leaveToVote: boolean = false;
        const highest: number = settings.DIFFICULTIES[settings.DIFFICULTIES.length - 1];
        for (const word of words) {
            const percent: number = Number(word);
            if (word === 'n' || word === 'normal') {
                mode = settings.GAME_MODES.CLASSIC;
            } else if (word === 'b' || word === 'blitz') {
                mode = settings.GAME_MODES.BLITZ;
            } else if (word === 'd' || word === 'debug') {
                mode = settings.GAME_MODES.DEBUG;
            } else if (word === 'v' || word === 'vote') {
                leaveToVote = true;
            } else if (percent === Math.floor(percent)
                && percent >= settings.DIFFICULTIES[0] && percent <= highest) {
                difficulty = percent;
            }
        }
        this.fileSettingsDone = true;
        Log.Info(`hostfile: applied ${leaveToVote ? 'a players vote' : `mode=${mode} difficulty=${difficulty}`}`);
        Log.flush();
        if (leaveToVote) {
            this.startModeVote();
        } else {
            this.applyMode(mode);
            this.applyDifficulty(difficulty);
            this.openRaceSelection();
        }
    }

    private askHost(host: Defender): void {
        this.awaitingHost = host;
        this.hostPanel.show(host);
        SendMessage(`${host.getNameWithColour()} is choosing the game mode and difficulty`);
        Timer.create().start(HOST_DECISION_TIMEOUT, false, () => {
            if (this.awaitingHost) {
                this.hostPanel.hide(this.awaitingHost);
                this.awaitingHost = undefined;
                SendMessage('The host did not choose, the players vote instead');
                this.startModeVote();
            }
        });
    }

    /** The host's choice from their panel, as "mode:difficulty index". */
    private applyHostSettings(player: Defender, data: string): void {
        const [mode, difficultyIndex] = data.split(':').map(value => Number(value));
        if (difficultyIndex >= 0 && difficultyIndex < settings.DIFFICULTIES.length) {
            this.applyHostChoice(player, mode, settings.DIFFICULTIES[difficultyIndex]);
        }
    }

    /**
     * The host's choice of mode and difficulty (a whole percentage from the lowest difficulty to
     * the highest - 250 is fine, as a vote can end up there too); ignored from anyone but the
     * host the game waits for. Returns whether it was taken.
     */
    public applyHostChoice(player: Defender, mode: number, difficulty: number): boolean {
        if (!this.awaitingHost || player.id !== this.awaitingHost.id) {
            return false;
        }
        if (!(mode >= 0 && mode < settings.GAME_MODE_STRINGS.length) || difficulty !== Math.floor(difficulty)
            || !(difficulty >= settings.DIFFICULTIES[0] && difficulty <= settings.DIFFICULTIES[settings.DIFFICULTIES.length - 1])) {
            return false;
        }
        this.awaitingHost = undefined;
        this.hostPanel.hide(player);
        SendMessage(`${player.getNameWithColour()} set the game mode to ${this.modeName(mode)}`);
        this.applyMode(mode);
        this.applyDifficulty(difficulty);
        this.openRaceSelection();
        return true;
    }

    /**
     * The host's choice to leave the game to a players' vote - the `-s vote` command, the text form
     * of the panel's vote button (what MaulBot does by default). Ignored from anyone but the host the
     * game waits for; returns whether it was taken.
     */
    public applyHostVote(player: Defender): boolean {
        if (!this.awaitingHost || player.id !== this.awaitingHost.id) {
            return false;
        }
        this.hostChoseVote(player);
        return true;
    }

    private hostChoseVote(player: Defender): void {
        if (!this.awaitingHost || player.id !== this.awaitingHost.id) {
            return;
        }
        this.awaitingHost = undefined;
        this.hostPanel.hide(player);
        SendMessage(`${player.getNameWithColour()} left the choice to a vote`);
        this.startModeVote();
    }

    private startModeVote(): void {
        for (let i = 0; i < settings.PLAYER_GAME_MODES.length; i++) {
            this.votedMode[i] = 0;
        }
        const labels = settings.PLAYER_GAME_MODES.map(mode => this.modeName(mode));
        this.panel.show('Game mode vote', labels, index => this.game.playerSync.send('vote-mode', `${index}`));
        this.modeVoteOpen = true;
        Timer.create().start(VOTE_LENGTH, false, () => this.resolveModeVote());
    }

    private recordModeVote(player: MapPlayer, index: number): void {
        if (this.hasVotedMode[player.id] || index < 0 || index >= this.votedMode.length) {
            return;
        }
        this.hasVotedMode[player.id] = true;
        this.votedMode[index]++;
        this.panel.hide(this.game.players.get(player.id)!);
        SendMessage(`${this.playerName(player)} voted for: ${this.modeName(settings.PLAYER_GAME_MODES[index])}`);
        if (this.everyoneVoted(defender => this.hasVotedMode[defender.id])) {
            this.resolveModeVote();
        }
    }

    /** Whether every player has voted: then the vote need not wait for its time. */
    private everyoneVoted(hasVoted: (defender: Defender) => boolean): boolean {
        for (const defender of this.game.players.values()) {
            if (!hasVoted(defender)) {
                return false;
            }
        }
        return true;
    }

    private resolveModeVote(): void {
        if (!this.modeVoteOpen) {
            return;
        }
        this.modeVoteOpen = false;
        let winningMode: number = 0;
        for (let i = 1; i < this.votedMode.length; i++) {
            if (this.votedMode[i] > this.votedMode[winningMode]) {
                winningMode = i;
            }
        }
        const mode = settings.PLAYER_GAME_MODES[winningMode];
        SendMessage(`${this.modeName(mode)} won with ${this.votedMode[winningMode]} votes.`);
        SyncTrace.note('vote', `mode=${mode} votes=${this.votedMode[winningMode]}`);
        this.applyMode(mode);

        // Difficulty is voted on while the race selection is already open
        this.startDiffVote();
        this.openRaceSelection();
    }

    private applyMode(mode: number): void {
        if (this.forceBlitz) {
            mode = settings.GAME_MODES.BLITZ;
            SendMessage(`Developer forced gamemode to be: ${this.modeName(mode)}.`);
        }
        switch (mode) {
            case settings.GAME_MODES.CLASSIC:
                this.game.worldMap.gameRoundHandler = new ClassicGameRound(this.game);
                break;
            case settings.GAME_MODES.BLITZ:
                this.game.worldMap.gameRoundHandler = new BlitzGameRound(this.game);
                break;
            case settings.GAME_MODES.DEBUG:
                this.game.worldMap.gameRoundHandler = new DebugGameRound(this.game);
                break;
            default:
                Log.Fatal('Invalid game mode, defaulting to classic.');
                this.game.worldMap.gameRoundHandler = new ClassicGameRound(this.game);
                break;
        }
    }

    private startDiffVote(): void {
        const labels = settings.DIFFICULTIES.map((diff, i) =>
            Util.ColourString(settings.DIFFICULTY_COLOURS[i], `${diff}% ${settings.DIFFICULTY_STRINGS[i]}`));
        this.panel.show('Difficulty vote', labels, index => this.game.playerSync.send('vote-diff', `${index}`));
        this.diffVoteOpen = true;
        Timer.create().start(VOTE_LENGTH, false, () => this.resolveDiffVote());
    }

    private recordDiffVote(player: MapPlayer, index: number): void {
        if (this.votedDiff[player.id] || index < 0 || index >= settings.DIFFICULTIES.length) {
            return;
        }
        this.votedDiff[player.id] = settings.DIFFICULTIES[index];
        this.panel.hide(this.game.players.get(player.id)!);
        SendMessage(`${this.playerName(player)} voted for: ${Util.ColourString(settings.DIFFICULTY_COLOURS[index], settings.DIFFICULTY_STRINGS[index])}`);
        if (this.everyoneVoted(defender => this.votedDiff[defender.id] !== undefined)) {
            this.resolveDiffVote();
        }
    }

    private resolveDiffVote(): void {
        if (!this.diffVoteOpen) {
            return;
        }
        this.diffVoteOpen = false;
        const votes: number[] = [];
        for (const player of this.game.players.values()) {
            if (!this.votedDiff[player.id]) {
                this.panel.hide(player);
                SendMessage(`${player.getNameWithColour()} did not vote, their vote will not be counted`);
            } else {
                votes.push(this.votedDiff[player.id]);
            }
        }
        if (votes.length === 0) {
            SendMessage('Nobody voted, difficulty will automatically be set to Normal');
            this.applyDifficulty(settings.DIFFICULTIES[0]);
        } else {
            this.applyDifficulty(votedDifficulty(votes));
        }
        SyncTrace.note('vote', `difficulty=${this.difficulty} votes=${votes.length}`);
    }

    /** Sets the difficulty (a percentage, possibly a blend of the votes) and everything that hangs off it. */
    private applyDifficulty(difficulty: number): void {
        this.game.scoreBoard = new MultiBoard(this.game);
        const diffIndex: number = R2I((difficulty - 100.00) / 100.00 + ModuloReal((difficulty - 100.00) / 100.00, 1.00));
        this.difficulty = Math.floor(difficulty);
        const colouredDifficulty = Util.ColourString(settings.DIFFICULTY_COLOURS[diffIndex], settings.DIFFICULTY_STRINGS[diffIndex]);
        // No player handicap: creeps are scaled per unit in Creep (HP, armor, abilities)
        SendMessage(`Difficulty was set to ${this.difficulty}% (${colouredDifficulty})`);

        for (const player of this.game.players.values()) {
            for (const ally of this.game.players.values()) {
                player.setAlliance(ally, ALLIANCE_HELP_REQUEST, false);
            }
        }

        if (this.difficulty >= 400) {
            settings.Sounds.impossibleDifficultySound.start();
            SendMessage('|cFF565656Everyone voted for Extreme, you will only have |r1|cFF565656 life!|r');
            this.game.gameLives = 1;
            this.game.startLives = 1;
            MultiboardSetItemValueBJ(this.game.scoreBoard.board, 2, 4, `${this.game.gameLives}%`);
            SetWaterBaseColorBJ(100, 20.00, 20.00, 0);
            this.game.worldMap.ReplaceRunedBricksWithLava();
        }

        MultiboardSetItemValueBJ(this.game.scoreBoard.board, 2, 3, `${I2S(R2I(this.difficulty))}% (${colouredDifficulty})`);
    }

    private openRaceSelection(): void {
        for (const player of this.game.players.values()) {
            this.game.raceSelectPanel.open(player);
        }
    }

    private modeName(mode: number): string {
        return Util.ColourString(settings.GAME_MODE_COLOURS[mode], settings.GAME_MODE_STRINGS[mode]);
    }

    private playerName(player: MapPlayer): string {
        const defender = this.game.players.get(player.id);
        return defender ? defender.getNameWithColour() : `Player ${player.id}`;
    }
}
