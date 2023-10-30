import { WarcraftMaul } from '../../WarcraftMaul';
import { WCItem } from './Specs/WCItem';
import { Log } from '../../../lib/Serilog/Serilog';
import { LootBagItem } from './LootBoxer/LootBagItem';
import { StackingItem } from './Specs/StackingItem';
import { Rocks } from './LootBoxer/Rocks';
import { GoldCoin } from './LootBoxer/GoldCoin';
import { PlatinumToken } from './LootBoxer/PlatinumToken';
import { WoodenSticks } from './LootBoxer/WoodenSticks';
import { PremiumLootTower } from './LootBoxer/PremiumLootTower';
import {Trigger} from "w3ts";


export class ItemHandler {
    private readonly game: WarcraftMaul;
    private items: object[] = [];
    private activeItems: WCItem[] = [];
    private useItemTrigger: Trigger;
    private pickupItemTrigger: Trigger;
    private stackingItems: StackingItem[] = [];

    constructor(game: WarcraftMaul) {
        this.game = game;
        this.AddItemsToList();
        this.SetupItems();
        this.useItemTrigger = Trigger.create();
        this.useItemTrigger.registerAnyUnitEvent(EVENT_PLAYER_UNIT_USE_ITEM);
        this.useItemTrigger.addAction(() => this.UseItem());

        this.pickupItemTrigger = Trigger.create();
        this.pickupItemTrigger.registerAnyUnitEvent(EVENT_PLAYER_UNIT_PICKUP_ITEM);
        this.pickupItemTrigger.addAction(() => this.PickupItem());


    }

    private AddItemsToList(): void {
        this.items.push(LootBagItem);
        this.items.push(Rocks);
        this.items.push(PremiumLootTower);
        this.items.push(GoldCoin);
        this.items.push(PlatinumToken);
        this.items.push(WoodenSticks);
    }

    private SetupItems(): void {

        for (const item of this.items) {
            // @ts-ignore
            const ObjectExtendsItem: WCItem = new item(this.game);
            if (ObjectExtendsItem instanceof StackingItem) {
                this.stackingItems.push(ObjectExtendsItem);
            }
            this.activeItems.push(ObjectExtendsItem);
        }

    }

    private UseItem(): void {

        // UnitAddItemByIdSwapped(FourCC('I02B'), GetTriggerUnit());
        // Log.Debug(`[${DecodeFourCC(GetItemTypeId(GetManipulatedItem()))}]: ${GetItemName(GetManipulatedItem())}`);

        for (const item of this.activeItems) {
            if (item.ManipulateCondition()) {
                item.ManipulateAction();
            }
        }
    }

    private PickupItem(): void {
        for (const item of this.stackingItems) {
            if (item.StackingCondition()) {
                item.MakeStack();
            }
        }
    }
}
