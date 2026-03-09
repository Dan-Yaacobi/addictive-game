# Pulse Rift

Pulse Rift is a fast neon arena-survival roguelite built for high *fun-per-minute* and one-more-run replayability.

## 1) Game concept chosen
A top-down action survival game where you pilot a fragile energy core in a hostile arena. You dodge swarming enemies with responsive WASD movement and tactical dash timing while your auto-drone targets threats. Every level-up pauses the action and offers random upgrades, creating unique builds each run.

## 2) Why this concept best fits the objective
- **Immediate clarity:** movement + survive + power up is understandable in seconds.
- **High engagement density:** enemies spawn fast, level-up choices arrive often, and scores scale with combo risk.
- **Replayability:** random in-run upgrades + permanent metaprogression keep each run fresh while rewarding long-term mastery.
- **Fair addiction:** no dark patterns, only skill + build decisions + feedback-rich combat loops.

## 3) Core loop
1. Move, dash, and survive incoming enemy pressure.
2. Auto-drone shoots nearest enemy, rewarding positioning.
3. Defeated enemies drop shards and cores.
4. Collect shards to level up and pick one of three upgrades.
5. Push to higher waves for better score and more cores.
6. Spend cores in the hangar on permanent upgrades, then start a new run with stronger baseline potential.

## 4) Progression / retention structure
- **In-run progression:** XP shards → level-ups → random upgrade draft (3 choices).
- **Skill expression:** dash invulnerability timing, kiting routes, risk/reward for combo maintenance.
- **Run-to-run progression:** core currency unlocks persistent stats (hull, fire rate, magnet, dash cooldown).
- **Performance motivation:** score + wave + best score tracking, with bonus cores for deeper runs.

## 5) Implementation plan
- Build deterministic game architecture around one update/render loop.
- Implement player controller, auto-fire, dash, enemy archetypes, collisions.
- Add reward systems: score, combo, XP shards, level-up draft.
- Add meta progression in localStorage with upgrade shop UI.
- Polish with effects: particles, shake, distinct enemy color coding, lightweight synth SFX.

## 6) The game itself
### Run locally
```bash
python3 -m http.server 4173
```
Then open `http://localhost:4173`.

### Controls
- `WASD`: Move
- `Space`: Dash (short invulnerability window)
- Shooting is automatic toward nearest enemy.
