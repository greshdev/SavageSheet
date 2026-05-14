
import DiceBox from "https://unpkg.com/@3d-dice/dice-box@1.0.8/dist/dice-box.es.min.js";


const diceBox = new DiceBox("#dice-canvas",{
    assetPath: "assets/",
    origin: "https://unpkg.com/@3d-dice/dice-box@1.0.8/dist/",
    theme: "default",
    //   themeColor: "#feea03",
    offscreen: true,
    // Physics
    gravity: 2,
    mass: 1,
    friction: .8,
    restitution: 0,
    linearDamping: 0.5,
    angularDamping: 0.4,
    spinForce: 6,
    throwForce: 5,
    startingHeight: 8,
    settleTimeout: 5000,
    // Rendering
    delay: 10,
    scale: 5,
});

let GLOBAL_ROLL_LOCK = false;

function takeRollLock() {
    GLOBAL_ROLL_LOCK = true
}

function releaseRollLock() {
    GLOBAL_ROLL_LOCK = false
}

// Core Skills Data
const coreSkills = [
    // Core skills (every character has these)
    { name: 'Athletics', attr: 'Agility', core: true },
    { name: 'Common Knowledge', attr: 'Smarts', core: true },
    { name: 'Notice', attr: 'Smarts', core: true },
    { name: 'Persuasion', attr: 'Spirit', core: true },
    { name: 'Stealth', attr: 'Agility', core: true },
    // Other skills
    { name: 'Academics', attr: 'Smarts' },
    { name: 'Battle', attr: 'Smarts' },
    { name: 'Boating', attr: 'Agility' },
    { name: 'Driving', attr: 'Agility' },
    { name: 'Electronics', attr: 'Smarts' },
    { name: 'Faith', attr: 'Spirit' },
    { name: 'Fighting', attr: 'Agility' },
    { name: 'Focus', attr: 'Spirit' },
    { name: 'Gambling', attr: 'Smarts' },
    { name: 'Hacking', attr: 'Smarts' },
    { name: 'Healing', attr: 'Smarts' },
    { name: 'Intimidation', attr: 'Spirit' },
    { name: 'Language', attr: 'Smarts' },
    { name: 'Occult', attr: 'Smarts' },
    { name: 'Performance', attr: 'Spirit' },
    { name: 'Piloting', attr: 'Agility' },
    { name: 'Psionics', attr: 'Smarts' },
    { name: 'Repair', attr: 'Smarts' },
    { name: 'Research', attr: 'Smarts' },
    { name: 'Riding', attr: 'Agility' },
    { name: 'Science', attr: 'Smarts' },
    { name: 'Shooting', attr: 'Agility' },
    { name: 'Spellcasting', attr: 'Smarts' },
    { name: 'Survival', attr: 'Smarts' },
    { name: 'Taunt', attr: 'Smarts' },
    { name: 'Thievery', attr: 'Agility' },
    { name: 'Weird Science', attr: 'Smarts' },
];

const LOCALSTORAGE_KEY = "savageWorldsCharacter"
const DICE_CONFIG_KEY = "savageDiceConfig"

let diceConfig = { standardColor: '#ffffff', wildColor: '#7f0e0e' };

function loadDiceConfig() {
    const saved = localStorage.getItem(DICE_CONFIG_KEY);
    if (saved) diceConfig = { ...diceConfig, ...JSON.parse(saved) };
    document.getElementById('standardDiceColor').value = diceConfig.standardColor;
    document.getElementById('wildDiceColor').value = diceConfig.wildColor;
}

function saveDiceConfig() {
    localStorage.setItem(DICE_CONFIG_KEY, JSON.stringify(diceConfig));
}

const HINDRANCE_SLOT_COUNT = 4;
const EDGE_SLOT_LABELS = [
    '', '', '', '', '',          // 5 unlabeled (character creation)
    'N', 'N', 'N',               // Novice
    'S', 'S', 'S', 'S',          // Seasoned
    'V', 'V', 'V', 'V',          // Veteran
    'H', 'H', 'H', 'H',          // Heroic
    'L', 'L', 'L', 'L',          // Legendary
];

// Character Data
let characterData = {
    edges: Array(EDGE_SLOT_LABELS.length).fill(''),
    hindrances: Array(HINDRANCE_SLOT_COUNT).fill(''),
    powers: [],   // { name, pp, range, duration, effect }
    weapons: [],  // { name, range, damage, ap, rof, wt, notes }
    gear: [],     // { name, weight }
    skills: {},
    wounds: 0,
    fatigue: 0,
    incapacitated: false,
    bennies: 3,
    currentPP: 0,
    maxPP: 0,
    shaken: false
};

function setSkillOrder(row, value) {
    row.style.order = parseInt(value) > 0 ? 0 : 1;
}

// Initialize Skills
function initSkills() {
    const container = document.getElementById('skillsContainer');
    container.innerHTML = '';

    coreSkills.forEach(skill => {
        const row = document.createElement('div');
        row.className = skill.core ? 'skill-row skill-row--core' : 'skill-row';
        row.innerHTML = `
            <span class="skill-name">
                ${skill.name}
                <span class="skill-attr">(${skill.attr})</span>
            </span>
            <select class="skill-die" data-skill="${skill.name}">
                <option value="0">--</option>
                <option value="4">d4</option>
                <option value="6">d6</option>
                <option value="8">d8</option>
                <option value="10">d10</option>
                <option value="12">d12</option>
            </select>
            <button class="roll-skill-btn" 
                data-skill="${skill.name}"
                title="Roll ${skill.name}">⚄</button>
        `;
        container.appendChild(row);
        if (skill.core) {
            row.querySelector('.skill-die').value = '4';
        }
        setSkillOrder(row, row.querySelector('.skill-die').value);
    });

    // Add event listeners for skill die changes
    document.querySelectorAll('.skill-die').forEach(select => {
        select.addEventListener('change', (e) => {
            const skillName = e.target.dataset.skill;
            const value = parseInt(e.target.value);
            characterData.skills[skillName] = value;
            setSkillOrder(e.target.closest('.skill-row'), value);
            updateDerivedStats();
            saveCharacter();
        });
    });

    // Add event listeners for skill roll buttons
    document.querySelectorAll('.roll-skill-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const skillName = e.target.dataset.skill;
            rollSkill(skillName);
        });
    });
}

// Calculate Rank from Advances
const RANK_THRESHOLDS = {
    'Legendary': 16,
    'Heroic': 12,
    'Veteran': 8,
    'Seasoned': 4,
    'Novice': 0
}
function calculateRank(advances) {
    for (let [key, value] of Object.entries(RANK_THRESHOLDS)) {
        if (advances >= value) {
            return key
        }
    }
}

function updateRank() {
    const advances = parseInt(document.getElementById('advances').value) || 0;
    const rank = calculateRank(advances);
    document.getElementById('rankDisplay').textContent = rank;
}

// Update Derived Stats
function updateDerivedStats() {
    // Parry = 2 + (Fighting die / 2)
    const fighting = characterData.skills['Fighting'] || 0;
    const parry = 2 + Math.floor(fighting / 2);
    document.getElementById('parry').textContent = parry;

    // Toughness = 2 + (Vigor die / 2) + Size
    const vigor = parseInt(document.getElementById('attr-vigor').value);
    const size = parseInt(document.getElementById('size').value) || 0;
    const toughness = 2 + Math.floor(vigor / 2) + size;
    document.getElementById('toughness').textContent = toughness;
}

// Build slot inputs for Hindrances and Edges
function initSlots() {
    const hindrancesEl = document.getElementById('hindrancesSlots');
    for (let i = 0; i < HINDRANCE_SLOT_COUNT; i++) {
        const row = document.createElement('div');
        row.className = 'slot-row';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'slot-input';
        input.dataset.slotType = 'hindrances';
        input.dataset.slotIndex = i;
        input.addEventListener('input', e => {
            characterData.hindrances[i] = e.target.value;
            saveCharacter();
        });
        row.appendChild(input);
        hindrancesEl.appendChild(row);
    }

    const edgesEl = document.getElementById('edgesSlots');
    EDGE_SLOT_LABELS.forEach((label, i) => {
        const row = document.createElement('div');
        row.className = 'slot-row';
        if (label) {
            const rankEl = document.createElement('span');
            rankEl.className = 'slot-rank';
            rankEl.textContent = label;
            row.appendChild(rankEl);
        }
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'slot-input';
        input.dataset.slotType = 'edges';
        input.dataset.slotIndex = i;
        input.addEventListener('input', e => {
            characterData.edges[i] = e.target.value;
            saveCharacter();
        });
        row.appendChild(input);
        edgesEl.appendChild(row);
    });
}

function updateEdgeSlotAvailability() {
    const advances = parseInt(document.getElementById('advances').value) || 0;
    document.querySelectorAll('[data-slot-type="edges"]').forEach(input => {
        const i = parseInt(input.dataset.slotIndex);
        if (!EDGE_SLOT_LABELS[i]) return; // unlabeled slots always available
        const locked = advances < (i - 4); // index 5 → requires 1 advance, index 6 → 2, etc.
        input.closest('.slot-row').classList.toggle('slot-row--locked', locked);
        input.disabled = locked;
    });
}

// Populate slot inputs from characterData
function renderSlots() {
    document.querySelectorAll('[data-slot-type="hindrances"]').forEach(input => {
        input.value = characterData.hindrances[input.dataset.slotIndex] || '';
    });
    document.querySelectorAll('[data-slot-type="edges"]').forEach(input => {
        input.value = characterData.edges[input.dataset.slotIndex] || '';
    });
}

// Render powers table
function renderPowersTable() {
    const tbody = document.getElementById('powersTableBody');
    tbody.innerHTML = '';
    characterData.powers.forEach((p, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.name}</td>
            <td>${p.pp}</td>
            <td>${p.range}</td>
            <td>${p.duration}</td>
            <td>${p.effect}</td>
            <td><button class="remove-btn" data-remove-type="powers" data-remove-index="${index}">×</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// Render weapons table
function renderWeaponsTable() {
    const tbody = document.getElementById('weaponsTableBody');
    tbody.innerHTML = '';
    characterData.weapons.forEach((w, index) => {
        const skill = w.skill || 'Fighting';
        const hasRollable = w.damage && /d\d+/i.test(w.damage);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><button class="roll-skill-btn weapon-attack-btn" title="Roll ${skill}">⚄</button></td>
            <td>${w.name}</td>
            <td>
                <select class="weapon-skill-select" data-weapon-index="${index}">
                    <option value="Fighting" ${skill === 'Fighting' ? 'selected' : ''}>Melee</option>
                    <option value="Shooting" ${skill === 'Shooting' ? 'selected' : ''}>Ranged</option>
                </select>
            </td>
            <td>${w.range}</td>
            <td class="${hasRollable ? 'damage-rollable' : ''}" title="${hasRollable ? 'Click to roll damage' : ''}">${w.damage}</td>
            <td>${w.ap}</td>
            <td>${w.rof}</td>
            <td>${w.wt}</td>
            <td>${w.notes}</td>
            <td><button class="remove-btn" data-remove-type="weapons" data-remove-index="${index}">×</button></td>
        `;

        tr.querySelector('.weapon-attack-btn').addEventListener('click', () => {
            rollSkill(characterData.weapons[index].skill || 'Fighting');
        });

        tr.querySelector('.weapon-skill-select').addEventListener('change', e => {
            characterData.weapons[index].skill = e.target.value;
            tr.querySelector('.weapon-attack-btn').title = `Roll ${e.target.value}`;
            saveCharacter();
        });

        if (hasRollable) {
            tr.querySelector('.damage-rollable').addEventListener('click', () => {
                rollDamage(w.name || 'Weapon', w.damage);
            });
        }

        tbody.appendChild(tr);
    });
}

// Parse a Savage Worlds damage expression like "2d6+1", "str+d6", "3d8"
function parseDamageExpression(expr) {
    const strengthDie = parseInt(document.getElementById('attr-strength').value) || 4;
    const normalized = expr.toLowerCase().replace(/\bstr\b/g, `d${strengthDie}`);

    const dicePattern = /(\d+)?d(\d+)/g;
    const dice = [];
    let match;
    while ((match = dicePattern.exec(normalized)) !== null) {
        dice.push({ count: parseInt(match[1]) || 1, sides: parseInt(match[2]) });
    }

    const modifierStr = normalized.replace(/(\d+)?d\d+/g, '');
    const modifier = (modifierStr.match(/[+-]\d+/g) || [])
        .reduce((sum, m) => sum + parseInt(m), 0);

    return { dice, modifier };
}

async function rollDamage(weaponName, damageExpr) {
    if (GLOBAL_ROLL_LOCK) return;
    GLOBAL_ROLL_LOCK = true;
    diceBox.clear();

    const { dice, modifier } = parseDamageExpression(damageExpr);
    if (dice.length === 0) { releaseRollLock(); return; }

    const rollPromises = dice.flatMap(({ count, sides }) =>
        Array(count).fill(null).map(() => rollExplodingDie(sides))
    );
    const results = await Promise.all(rollPromises);

    let total = 0;
    let parts = [];
    let exploded = false;
    let dieIndex = 0;
    for (const { count, sides } of dice) {
        for (let i = 0; i < count; i++) {
            const result = results[dieIndex++];
            total += result.total;
            parts.push(`d${sides}: ${result.rolls.join('+')}`);
            if (result.exploded) exploded = true;
        }
    }

    total += modifier;
    const rollMod = getRollModifier();
    total += rollMod;
    let details = parts.join(' | ');
    if (modifier !== 0) details += ` | ${modifier > 0 ? '+' : ''}${modifier}`;
    if (rollMod !== 0) details += ` | ${rollMod > 0 ? '+' : ''}${rollMod} mod`;

    showRollResult(`${weaponName} Damage`, total, exploded, details);
    clearDice();
}

// Add power row
function addPower() {
    const name     = document.getElementById('newPowerName').value.trim();
    const pp       = document.getElementById('newPowerPP').value.trim();
    const range    = document.getElementById('newPowerRange').value.trim();
    const duration = document.getElementById('newPowerDuration').value.trim();
    const effect   = document.getElementById('newPowerEffect').value.trim();
    if (!name) return;
    characterData.powers.push({ name, pp, range, duration, effect });
    renderPowersTable();
    ['newPowerName','newPowerPP','newPowerRange','newPowerDuration','newPowerEffect']
        .forEach(id => { document.getElementById(id).value = ''; });
    saveCharacter();
}

// Render gear list
function renderGearList() {
    const list = document.getElementById('gearList');
    list.innerHTML = '';
    characterData.gear.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'gear-row';
        row.innerHTML = `
            <input type="text" class="gear-name-input" value="${item.name}" placeholder="Item..." data-gear-field="name" data-gear-index="${index}">
            <input type="number" class="gear-weight-input" value="${item.weight}" placeholder="0" min="0" step="0.5" data-gear-field="weight" data-gear-index="${index}">
            <button class="remove-btn" data-remove-type="gear" data-remove-index="${index}">×</button>
        `;
        list.appendChild(row);
    });

    list.querySelectorAll('[data-gear-field]').forEach(input => {
        input.addEventListener('input', e => {
            const i = parseInt(e.target.dataset.gearIndex);
            characterData.gear[i][e.target.dataset.gearField] = e.target.value;
            updateGearTotal();
            saveCharacter();
        });
    });

    updateGearTotal();
}

function updateGearTotal() {
    const total = characterData.gear.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
    document.getElementById('gearTotal').textContent = total % 1 === 0 ? total : total.toFixed(1);
}

// Add gear item
function addGear() {
    const name = document.getElementById('newGearName').value.trim();
    const weight = document.getElementById('newGearWeight').value;
    if (!name) return;
    characterData.gear.push({ name, weight: weight || '' });
    renderGearList();
    document.getElementById('newGearName').value = '';
    document.getElementById('newGearWeight').value = '';
    saveCharacter();
}

// Add weapon row
function addWeapon() {
    const skill  = document.getElementById('newWeaponSkill').value;
    const name   = document.getElementById('newWeaponName').value.trim();
    const range  = document.getElementById('newWeaponRange').value.trim();
    const damage = document.getElementById('newWeaponDamage').value.trim();
    const ap     = document.getElementById('newWeaponAP').value.trim();
    const rof    = document.getElementById('newWeaponRoF').value.trim();
    const wt     = document.getElementById('newWeaponWt').value.trim();
    const notes  = document.getElementById('newWeaponNotes').value.trim();
    if (!name) return;
    characterData.weapons.push({ skill, name, range, damage, ap, rof, wt, notes });
    renderWeaponsTable();
    document.getElementById('newWeaponSkill').value = 'Fighting';
    ['newWeaponName','newWeaponRange','newWeaponDamage','newWeaponAP',
     'newWeaponRoF','newWeaponWt','newWeaponNotes']
        .forEach(id => { document.getElementById(id).value = ''; });
    saveCharacter();
}

// Tracker Click Handlers
function initTrackers() {
    // Wounds (left side) - 3 levels before incap
    document.querySelectorAll('.wound-box').forEach(box => {
        box.addEventListener('click', () => {
            const index = parseInt(box.dataset.index);
            if (characterData.wounds === index) {
                characterData.wounds = index - 1;
            } else {
                characterData.wounds = index;
            }
            // Clear incapacitated if we're reducing wounds
            if (characterData.wounds < 3) {
                characterData.incapacitated = false;
            }
            updateWoundsFatigueDisplay();
            saveCharacter();
        });
    });

    // Fatigue (right side) - 2 levels before incap
    document.querySelectorAll('.fatigue-box').forEach(box => {
        box.addEventListener('click', () => {
            const index = parseInt(box.dataset.index);
            if (characterData.fatigue === index) {
                characterData.fatigue = index - 1;
            } else {
                characterData.fatigue = index;
            }
            // Clear incapacitated if we're reducing fatigue
            if (characterData.fatigue < 2) {
                characterData.incapacitated = false;
            }
            updateWoundsFatigueDisplay();
            saveCharacter();
        });
    });

    // Incapacitated box - only clickable when at max wounds (3) or max fatigue (2)
    document.getElementById('incapBox').addEventListener('click', () => {
        if (characterData.incapacitated) {
            // If already incapacitated, clear it (but keep wounds/fatigue at max)
            characterData.incapacitated = false;
        } else if (characterData.wounds >= 3 || characterData.fatigue >= 2) {
            // Can only become incapacitated if at max wounds or fatigue
            characterData.incapacitated = true;
        }
        updateWoundsFatigueDisplay();
        saveCharacter();
    });

    // Shaken toggle
    document.getElementById('shakenToggle').addEventListener('click', () => {
        characterData.shaken = !characterData.shaken;
        updateShakenDisplay();
        saveCharacter();
    });

    // Initialize bennies display
    renderBennies();
}

function updateWoundsFatigueDisplay() {
    // Update wound boxes
    document.querySelectorAll('.wound-box').forEach(box => {
        const index = parseInt(box.dataset.index);
        box.classList.toggle('marked', index <= characterData.wounds);
    });

    // Update fatigue boxes
    document.querySelectorAll('.fatigue-box').forEach(box => {
        const index = parseInt(box.dataset.index);
        box.classList.toggle('marked', index <= characterData.fatigue);
    });

    // Update incapacitated state
    const incapBox = document.getElementById('incapBox');
    incapBox.classList.toggle('marked', characterData.incapacitated);

    // Visual hint that incap is clickable when at threshold
    const atThreshold = (characterData.wounds >= 3 || characterData.fatigue >= 2) && !characterData.incapacitated;
    incapBox.classList.toggle('available', atThreshold);

    updateShakenDisplay();
}

function updateShakenDisplay() {
    const btn = document.getElementById('shakenToggle');
    if (btn) btn.classList.toggle('shaken-active', characterData.shaken);
}

// Render bennies
function renderBennies() {
    const container = document.getElementById('benniesContainer');
    container.innerHTML = '';

    for (let i = 0; i < characterData.bennies; i++) {
        const benny = document.createElement('div');
        benny.className = 'benny';
        benny.textContent = 'B';
        benny.title = 'Click to spend';
        benny.addEventListener('click', function () {
            spendBenny(this);
        });
        container.appendChild(benny);
    }

    const bennyActions = document.createElement("div")
    bennyActions.className = "benny-actions"

    const addBennyBtn = document.createElement("button")
    addBennyBtn.className = "add-benny-btn"
    addBennyBtn.textContent = "+"
    addBennyBtn.title = "Click to add benny"
    addBennyBtn.addEventListener("click", addBenny)
    bennyActions.appendChild(addBennyBtn)

    const resetBtn = document.createElement("button")
    resetBtn.className = "reset-benny-btn"
    resetBtn.textContent = "↺"
    resetBtn.title = "Reset to 3"
    resetBtn.addEventListener("click", () => {
        resetBtn.classList.add("resetting")
        setTimeout(() => {
            characterData.bennies = 3
            renderBennies()
            saveCharacter()
        }, 600)
    })
    bennyActions.appendChild(resetBtn)

    container.appendChild(bennyActions)
}

// Spend a benny with animation
function spendBenny(bennyElement) {
    if (characterData.bennies > 0) {
        // Add the spending animation class
        bennyElement.classList.add('spending');

        // Wait for animation to complete, then update
        setTimeout(() => {
            characterData.bennies--;
            renderBennies();
            saveCharacter();
        }, 550);
    }
}

// Add a benny
export function addBenny() {
    characterData.bennies++;
    renderBennies();
    saveCharacter();
}

function updateBenniesDisplay() {
    renderBennies();
}

// Roll a single die with exploding
async function rollExplodingDie(sides, options) {
    const rollOptions = { themeColor: diceConfig.standardColor, ...options };
    let total = 0;
    let rolls = [];
    let currentRoll;
    let groupId;

    do {
        const result = await diceBox.add(
            {
                sides: sides,
                groupId: groupId,
            }, rollOptions
        )
        console.log(result)
        groupId = result[0].groupId
        currentRoll = result[0].value
        rolls.push(currentRoll);
        total += currentRoll;
    } while (currentRoll == sides);

    return { total, rolls, exploded: rolls.length > 1 };
}

async function rollWildDie() {
    return await rollExplodingDie(6, { themeColor: diceConfig.wildColor });
}

function getRollModifier() {
    return parseInt(document.getElementById('rollModifier').value) || 0;
}

// Roll a trait (attribute or skill) with Wild Die
async function rollTrait(selectId, traitName) {
    if (GLOBAL_ROLL_LOCK) {
        return
    }
    GLOBAL_ROLL_LOCK = true
    diceBox.clear()

    const die = parseInt(document.getElementById(selectId).value);
    if (!die || die === 0) {
        showRollResult(traitName, 'No die selected', false);
        return;
    }

    // Calculate wound/fatigue penalty
    const penalty = characterData.wounds + characterData.fatigue;

    // Roll trait die
    const traitRollPromise = rollExplodingDie(die);
    // Roll wild die (d6)
    const wildRollPromise = rollWildDie();
    const traitRoll = await traitRollPromise
    const wildRoll = await wildRollPromise;

    // Take the better of the two
    const modifier = getRollModifier();
    const traitTotal = traitRoll.total - penalty;
    const wildTotal = wildRoll.total - penalty;
    const bestTotal = Math.max(traitTotal, wildTotal) + modifier;
    const usedWild = wildTotal > traitTotal;

    // Build result string
    let details = `d${die}: ${traitRoll.rolls.join('+')}=${traitRoll.total}`;
    details += ` | Wild: ${wildRoll.rolls.join('+')}=${wildRoll.total}`;
    if (penalty > 0) details += ` | -${penalty} penalty`;
    if (modifier !== 0) details += ` | ${modifier > 0 ? '+' : ''}${modifier} mod`;

    const exploded = traitRoll.exploded || wildRoll.exploded;
    showRollResult(traitName, bestTotal, exploded, details, usedWild);
    clearDice()
}

// Roll a skill
async function rollSkill(skillName) {
    if (GLOBAL_ROLL_LOCK) {
        return
    }
    GLOBAL_ROLL_LOCK = true
    diceBox.clear()
    
    const select = document.querySelector(`[data-skill="${skillName}"]`);
    const die = parseInt(select.value) || 4; // 4 if unskilled
    const isUnskilled = !select.value || select.value === '0';
    const unskillledPenalty = isUnskilled ? 2 : 0;

    // Calculate wound/fatigue penalty
    const penalty = characterData.wounds + characterData.fatigue + unskillledPenalty;

    const traitRollPromise = rollExplodingDie(die);
    const wildRollPromise = rollWildDie()
    const traitRoll = await traitRollPromise
    const wildRoll = await wildRollPromise

    const modifier = getRollModifier();
    const traitTotal = traitRoll.total - penalty;
    const wildTotal = wildRoll.total - penalty;
    const bestTotal = Math.max(traitTotal, wildTotal) + modifier;
    const usedWild = wildTotal > traitTotal;

    const unskilledPrefix = isUnskilled ? 'Unskilled ' : ''
    let details = `${unskilledPrefix}d${die}: ${traitRoll.rolls.join('+')}=${traitRoll.total}`;
    details += ` | Wild: ${wildRoll.rolls.join('+')}=${wildRoll.total}`;
    if (penalty > 0) details += ` | -${penalty} ${isUnskilled ? 'penalty (unskilled -2 + wounds/fatigue)' : 'penalty'}`;
    if (modifier !== 0) details += ` | ${modifier > 0 ? '+' : ''}${modifier} mod`;

    const exploded = traitRoll.exploded || wildRoll.exploded;
    const displayName = isUnskilled ? `${skillName} (unskilled)` : skillName;
    showRollResult(displayName, bestTotal, exploded, details, usedWild);

    clearDice()
}

// Show roll result in the roller panel
function showRollResult(name, result, exploded, details = '', usedWild = false) {
    const nameEl = document.getElementById('rollName');
    const resultEl = document.getElementById('rollResult');
    const detailsEl = document.getElementById('rollDetails');

    nameEl.textContent = name;
    resultEl.textContent = result;
    resultEl.classList.toggle('exploded', exploded);
    resultEl.classList.toggle('used-wild', usedWild);

    if (details) {
        detailsEl.textContent = details;
        detailsEl.style.display = 'block';
    } else {
        detailsEl.style.display = 'none';
    }

    if (exploded) {
        setTimeout(() => resultEl.classList.remove('exploded'), 500);
    }
}


function clearDice() {
    setTimeout(() => {
        diceBox.clear()
        releaseRollLock()
    }, 1000)
}

// Quick roll (simple die roll, no wild die)
async function rollDice() {
    if (GLOBAL_ROLL_LOCK) {
        return
    }
    GLOBAL_ROLL_LOCK = true
    const die = parseInt(document.getElementById('quickDie').value);
    const modifier = getRollModifier();
    const roll = await rollExplodingDie(die);
    const total = roll.total + modifier;
    let details = roll.rolls.join('+');
    if (modifier !== 0) details += ` ${modifier > 0 ? '+' : ''}${modifier} mod`;
    showRollResult(`Quick d${die}`, total, roll.exploded, details);
    clearDice()
}

// Gather all character data from the form
function gatherCharacterData() {
    return {
        ...characterData,
        name: document.getElementById('charName').value,
        ancestry: document.getElementById('ancestry').value,
        concept: document.getElementById('concept').value,
        size: document.getElementById('size').value,
        advances: document.getElementById('advances').value,
        attributes: {
            agility: document.getElementById('attr-agility').value,
            smarts: document.getElementById('attr-smarts').value,
            spirit: document.getElementById('attr-spirit').value,
            strength: document.getElementById('attr-strength').value,
            vigor: document.getElementById('attr-vigor').value
        },
        pace: document.getElementById('pace').value,
        notes: document.getElementById('notes').value
    };
}

// Save/Load Character
function saveCharacter() {
    const data = gatherCharacterData();
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
}

function loadCharacter() {
    const saved = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!saved) return;

    const data = JSON.parse(saved);
    const hindrances = Array(HINDRANCE_SLOT_COUNT).fill('');
    (data.hindrances || []).slice(0, HINDRANCE_SLOT_COUNT).forEach((v, i) => {
        hindrances[i] = typeof v === 'string' ? v : '';
    });
    const edges = Array(EDGE_SLOT_LABELS.length).fill('');
    (data.edges || []).slice(0, EDGE_SLOT_LABELS.length).forEach((v, i) => {
        edges[i] = typeof v === 'string' ? v : '';
    });
    characterData = {
        edges,
        hindrances,
        powers: (data.powers || []).map(p =>
            typeof p === 'string'
                ? { name: p, pp: '', range: '', duration: '', effect: '' }
                : p
        ),
        weapons: (data.weapons || []).map(w => ({ skill: 'Fighting', ...w })),
        gear: typeof data.gear === 'string'
            ? data.gear.split('\n').map(s => s.trim()).filter(Boolean).map(name => ({ name, weight: '' }))
            : (data.gear || []),
        skills: data.skills || {},
        wounds: data.wounds || 0,
        fatigue: data.fatigue || 0,
        incapacitated: data.incapacitated || false,
        shaken: data.shaken || false,
        bennies: data.bennies !== undefined ? data.bennies : 3
    };

    // Restore form fields
    if (data.name) document.getElementById('charName').value = data.name;
    if (data.ancestry) document.getElementById('ancestry').value = data.ancestry;
    if (data.concept) document.getElementById('concept').value = data.concept;
    if (data.size !== undefined) document.getElementById('size').value = data.size;
    if (data.advances) document.getElementById('advances').value = data.advances;

    if (data.attributes) {
        document.getElementById('attr-agility').value = data.attributes.agility;
        document.getElementById('attr-smarts').value = data.attributes.smarts;
        document.getElementById('attr-spirit').value = data.attributes.spirit;
        document.getElementById('attr-strength').value = data.attributes.strength;
        document.getElementById('attr-vigor').value = data.attributes.vigor;
    }

    if (data.pace) document.getElementById('pace').value = data.pace;
    characterData.currentPP = parseInt(data.currentPP) || 0;
    characterData.maxPP = parseInt(data.maxPP) || 0;
    document.getElementById('currentPP').value = characterData.currentPP;
    document.getElementById('maxPP').value = characterData.maxPP;
    if (data.notes) document.getElementById('notes').value = data.notes;

    // Restore skills
    Object.entries(characterData.skills).forEach(([skill, value]) => {
        const select = document.querySelector(`[data-skill="${skill}"]`);
        if (select) {
            select.value = value;
            setSkillOrder(select.closest('.skill-row'), value);
        }
    });

    // Update displays
    renderSlots();
    updateEdgeSlotAvailability();
    renderPowersTable();
    renderWeaponsTable();
    renderGearList();
    updateWoundsFatigueDisplay();
    updateBenniesDisplay();
    updateDerivedStats();
    updateRank();
}

// Sanitize filename for export
function sanitizeFilename(name) {
    return name
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || 'unnamed-character';
}

// Show import/export feedback message
function showImportExportFeedback(message, isError = false) {
    const messageEl = document.getElementById('importExportMessage');
    messageEl.textContent = message;
    messageEl.className = 'import-export-message show ' + (isError ? 'error' : 'success');

    setTimeout(() => {
        messageEl.classList.remove('show');
    }, 5000);
}

// Validate character data structure
function validateCharacterData(data) {
    // Check if data is an object
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    // Validate required arrays
    if (!Array.isArray(data.edges)) return false;
    if (!Array.isArray(data.hindrances)) return false;
    if (!Array.isArray(data.powers)) return false;
    if (data.weapons !== undefined && !Array.isArray(data.weapons)) return false;

    // Validate skills is an object
    if (typeof data.skills !== 'object' || data.skills === null) return false;

    // Validate skill values
    const validDice = [0, 4, 6, 8, 10, 12];
    for (let skill in data.skills) {
        if (!validDice.includes(data.skills[skill])) return false;
    }

    // Validate attributes if present
    if (data.attributes) {
        const validAttrDice = [4, 6, 8, 10, 12];
        for (let attr in data.attributes) {
            const value = parseInt(data.attributes[attr]);
            if (!validAttrDice.includes(value)) return false;
        }
    }

    // Validate numeric ranges
    if (data.wounds !== undefined) {
        if (typeof data.wounds !== 'number' || data.wounds < 0 || data.wounds > 3) return false;
    }
    if (data.fatigue !== undefined) {
        if (typeof data.fatigue !== 'number' || data.fatigue < 0 || data.fatigue > 2) return false;
    }
    if (data.bennies !== undefined) {
        if (typeof data.bennies !== 'number' || data.bennies < 0) return false;
    }
    if (data.size !== undefined) {
        const size = parseInt(data.size);
        if (size < -4 || size > 6) return false;
    }

    return true;
}

// Export character as JSON file
function exportCharacter() {
    const data = gatherCharacterData();

    // Create filename with character name and date
    const charName = sanitizeFilename(data.name || 'unnamed-character');
    const date = new Date().toISOString().split('T')[0];
    const filename = `${charName}-savage-worlds-${date}.json`;

    // Create and trigger download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // Show success feedback
    showImportExportFeedback('Character exported successfully!', false);
}

// Import character from JSON file
function importCharacter(file) {
    // Validate file type
    if (!file.name.endsWith('.json')) {
        showImportExportFeedback('Please select a JSON file', true);
        return;
    }

    // Validate file size (1MB max)
    if (file.size > 1024 * 1024) {
        showImportExportFeedback('File is too large (max 1MB)', true);
        return;
    }

    // Read and parse file
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // Validate structure
            if (!validateCharacterData(data)) {
                showImportExportFeedback('Invalid character file format', true);
                return;
            }

            // Confirm overwrite if character exists
            const hasExisting = localStorage.getItem(LOCALSTORAGE_KEY);
            if (hasExisting) {
                if (!confirm('This will replace your current character. Continue?')) {
                    return;
                }
            }

            // Save to localStorage and reload
            localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
            loadCharacter();

            // Show success feedback
            showImportExportFeedback('Character imported successfully!', false);

        } catch (error) {
            showImportExportFeedback('Failed to read character file', true);
            console.error('Import error:', error);
        }
    };

    reader.onerror = () => {
        showImportExportFeedback('Failed to read file', true);
    };

    reader.readAsText(file);
}

// Event Listeners for Auto-save
function initAutoSave() {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            updateDerivedStats();
            saveCharacter();
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await diceBox.init()

    initSkills();
    initSlots();
    updateEdgeSlotAvailability();
    initTrackers();
    loadCharacter();

    // Keep PP fields in sync with characterData before autoSave runs
    ['currentPP', 'maxPP'].forEach(id => {
        document.getElementById(id).addEventListener('change', e => {
            characterData[id] = parseInt(e.target.value) || 0;
        });
    });

    initAutoSave();
    updateDerivedStats();
    updateRank();

    // Advances field specifically updates rank
    document.getElementById('advances').addEventListener('input', () => {
        updateRank();
        updateEdgeSlotAvailability();
        saveCharacter();
    });

    document.getElementById('newPowerEffect').addEventListener('keypress', e => {
        if (e.key === 'Enter') addPower();
    });
    document.getElementById('newWeaponNotes').addEventListener('keypress', e => {
        if (e.key === 'Enter') addWeapon();
    });

    // Powers and weapons buttons
    // Gear / Weapons tab switching
    document.querySelectorAll('.gear-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.gear-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.gear-tab-panel').forEach(p => p.hidden = true);
            btn.classList.add('active');
            document.getElementById(`gear-tab-${btn.dataset.gearTab}`).hidden = false;
        });
    });

    document.getElementById('addPowerBtn').addEventListener('click', addPower);
    document.getElementById('addWeaponBtn').addEventListener('click', addWeapon);
    document.getElementById('addGearBtn').addEventListener('click', addGear);
    document.getElementById('newGearName').addEventListener('keypress', e => {
        if (e.key === 'Enter') addGear();
    });

    // Delegated remove handler for lists and tables
    document.querySelector('.container').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove-type]');
        if (!btn) return;
        const type = btn.dataset.removeType;
        const index = parseInt(btn.dataset.removeIndex, 10);
        characterData[type].splice(index, 1);
        if (type === 'powers') renderPowersTable();
        else if (type === 'weapons') renderWeaponsTable();
        else if (type === 'gear') renderGearList();
        saveCharacter();
    });

    // Setup trait rollers
    document.querySelectorAll("[data-trait-roller]").forEach(element => {
        const trait = element.getAttribute("data-trait-roller")
        const traitInputId = element.getAttribute("data-trait-input")
        element.addEventListener("click", async () => {
            await rollTrait(traitInputId, trait)
        })
    })

    document.querySelectorAll("[data-roll-dice]").forEach(element => {
        element.addEventListener("click", async () => await rollDice())
    })


    // Sidebar
    loadDiceConfig();
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    function openSidebar() { sidebar.classList.add('open'); overlay.classList.add('visible'); }
    function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('visible'); }
    document.getElementById('sidebarToggle').addEventListener('click', openSidebar);
    document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);

    // Dice color pickers
    document.getElementById('standardDiceColor').addEventListener('input', e => {
        diceConfig.standardColor = e.target.value;
        saveDiceConfig();
    });
    document.getElementById('wildDiceColor').addEventListener('input', e => {
        diceConfig.wildColor = e.target.value;
        saveDiceConfig();
    });

    // Export/Import event listeners
    document.getElementById('exportBtn').addEventListener('click', exportCharacter);
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            importCharacter(e.target.files[0]);
            // Reset file input so same file can be imported again
            e.target.value = '';
        }
    });
});