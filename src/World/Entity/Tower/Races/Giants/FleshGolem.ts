import { Tower } from '../../Specs/Tower';
import { GenericAutoAttackTower } from '../../Specs/GenericAutoAttackTower';

export class FleshGolem extends Tower implements GenericAutoAttackTower {

    public GenericAttack(): void {
        const attacker: unit | undefined = GetAttacker();
        if (attacker === this.unit.handle) {
            this.unit.issueImmediateOrder('berserk');
        }
    }

}
