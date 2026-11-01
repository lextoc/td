# The Royal Council

Tap the castle's Research label or press **K** to open the council. If a map has no room for a castle, a **Castle** button provides the same upgrades. The council pauses combat and the build countdown. Closing it resumes the run. Research is purchased immediately with the same gold used for towers; there are no research timers, passive interest, or permanent account bonuses. A new run resets everything.

## Research

All nine lines have three ranks. Rank I is available immediately, rank II after **clearing wave 3**, rank III after **clearing wave 6**. Some lines require rank I of a preceding line. Unlocks count completed waves, not a wave that has just started. Prices below are additional costs for each rank; effects are cumulative totals at that rank.

| Branch | Research | Gold I / II / III | Effect I / II / III | Prerequisite |
| --- | --- | --- | --- | --- |
| Warfare | Tempered steel | 45 / 80 / 125 | +8 / 16 / 24% damage | — |
| Warfare | Battle drills | 50 / 90 / 140 | +6 / 12 / 18% attack speed | Steel I |
| Warfare | Watchtower optics | 40 / 75 / 115 | +0.15 / 0.30 / 0.45 tiles of range | Drills I |
| Treasury | Bounty contracts | 65 / 110 / 165 | +1 / 2 / 3 gold per kill | — |
| Treasury | Trade caravans | 40 / 70 / 105 | +8 / 16 / 24 gold per cleared wave | — |
| Treasury | Salvage guild | 35 / 65 / 95 | 75 / 80 / 85% tower resale value | Caravans I |
| Defense | Reinforced walls | 45 / 75 / 110 | +2 / 4 / 6 maximum lives; heal 2 on each purchase | — |
| Defense | Gate wards | 45 / 80 / 120 | 1 / 2 / 3 life-loss charges per wave | Walls I |
| Defense | Arcane workshop | 45 / 80 / 120 | +15 / 30 / 45% frost slow duration; +5 / 10 / 15% cannon blast radius; rank III adds 1 Tesla target | Wards I |

Tower bonuses affect standing towers, newly built towers, and later tower upgrades. Stats are recalculated from their base values to prevent compounding on repeated purchases. Damage and attack speed multiply with doctrine modifiers. Range is additive. Alchemy increases slow duration, not slow strength. Research does not increase the gold invested in a tower for resale.

## Doctrines

After clearing **wave 5** and buying **six research ranks**, spend **120 gold** on exactly one doctrine. The menu requires a second confirmation because the choice is irreversible for this run.

| Doctrine | Benefit | Trade-off |
| --- | --- | --- |
| Conquest | +15% tower damage | 20% less kill gold, including bounty bonuses |
| Commerce | +25% wave-clear gold, including caravan bonuses | 8% slower tower attacks |
| Bastion | +4 maximum lives, restore 4 lives immediately, +2 ward charges per wave | 8% less tower damage |

Kill and wave rewards round down to whole gold. Early-start bonuses retain their original value. Ward charges absorb one lost life each and may absorb all of a small leak or part of the Troll's five-life penalty. Charges refill, without stacking, at each wave start; buying a ward rank grants one charge immediately. Bastion immediately grants its two charges as well.

## Repairs and decisions

Emergency repairs cost **35 gold** for **3 lives**, capped at the current maximum. Repairs are repeatable, disabled at full health, and do not count toward doctrine unlocks. Research, doctrines, and repairs are not refundable.

The opening choice is deliberately tight: starting gold is 250 and towers cost 70–150. Spending 45 on steel improves every future tower but can delay a new emplacement. A first bounty contract needs 65 kills to recover its price; a first caravan needs five cleared waves. Later economy ranks have fewer waves left to pay back. Defense buys room for mistakes but does not kill enemies. You cannot afford every rank alongside a full army, so choose a direction.

## Validation

`npm run test:kingdom` checks research gates and prerequisites, exact gold deductions, maximum ranks, doctrine exclusivity, repair caps, ward absorption, existing/new/upgraded tower stats, sell and undo behavior, wave rewards, run reset, and castle placement across 300 generated maps. Browser play-throughs remain in `npm test` after the kingdom checks.
