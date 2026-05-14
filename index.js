
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
    { name: 'Athletics', attr: 'Agility' },
    { name: 'Boating', attr: 'Agility' },
    { name: 'Driving', attr: 'Agility' },
    { name: 'Fighting', attr: 'Agility' },
    { name: 'Piloting', attr: 'Agility' },
    { name: 'Riding', attr: 'Agility' },
    { name: 'Shooting', attr: 'Agility' },
    { name: 'Stealth', attr: 'Agility' },
    { name: 'Thievery', attr: 'Agility' },
    { name: 'Academics', attr: 'Smarts' },
    { name: 'Battle', attr: 'Smarts' },
    { name: 'Common Knowledge', attr: 'Smarts' },
    { name: 'Electronics', attr: 'Smarts' },
    { name: 'Hacking', attr: 'Smarts' },
    { name: 'Healing', attr: 'Smarts' },
    { name: 'Language', attr: 'Smarts' },
    { name: 'Notice', attr: 'Smarts' },
    { name: 'Occult', attr: 'Smarts' },
    { name: 'Repair', attr: 'Smarts' },
    { name: 'Research', attr: 'Smarts' },
    { name: 'Science', attr: 'Smarts' },
    { name: 'Survival', attr: 'Smarts' },
    { name: 'Taunt', attr: 'Smarts' },
    { name: 'Faith', attr: 'Spirit' },
    { name: 'Focus', attr: 'Spirit' },
    { name: 'Intimidation', attr: 'Spirit' },
    { name: 'Performance', attr: 'Spirit' },
    { name: 'Persuasion', attr: 'Spirit' },
    { name: 'Psionics', attr: 'Smarts' },
    { name: 'Spellcasting', attr: 'Smarts' },
    { name: 'Weird Science', attr: 'Smarts' },
    { name: 'Gambling', attr: 'Smarts' }
];

const LOCALSTORAGE_KEY = "savageWorldsCharacter"

// Character Data
let characterData = {
    edges: [],
    hindrances: [],
    powers: [],
    skills: {},
    wounds: 0,
    fatigue: 0,
    incapacitated: false,
    bennies: 3
};

// Initialize Skills
function initSkills() {
    const container = document.getElementById('skillsContainer');
    container.innerHTML = '';

    coreSkills.forEach(skill => {
        const row = document.createElement('div');
        row.className = 'skill-row';
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
    });

    // Add event listeners for skill die changes
    document.querySelectorAll('.skill-die').forEach(select => {
        select.addEventListener('change', (e) => {
            const skillName = e.target.dataset.skill;
            characterData.skills[skillName] = parseInt(e.target.value);
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

// Add Item (Edge, Hindrance, Power)
function addItem(type) {
    let input, list;
    if (type === 'edges') {
        input = document.getElementById('newEdge');
        list = document.getElementById('edgesList');
    } else if (type === 'hindrances') {
        input = document.getElementById('newHindrance');
        list = document.getElementById('hindrancesList');
    } else if (type === 'powers') {
        input = document.getElementById('newPower');
        list = document.getElementById('powersList');
    }

    const value = input.value.trim();
    if (!value) return;

    characterData[type].push(value);
    renderList(type);
    input.value = '';
    saveCharacter();
}

// Render List
function renderList(type) {
    let list;
    if (type === 'edges') list = document.getElementById('edgesList');
    else if (type === 'hindrances') list = document.getElementById('hindrancesList');
    else if (type === 'powers') list = document.getElementById('powersList');

    list.innerHTML = '';
    characterData[type].forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
                    <span>${item}</span>
                    <button class="remove-btn" onclick="removeItem('${type}', ${index})">×</button>
                `;
        list.appendChild(li);
    });
}

// Remove Item
function removeItem(type, index) {
    characterData[type].splice(index, 1);
    renderList(type);
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

    const addBennyBtn = document.createElement("button")
    addBennyBtn.className = "add-benny-btn"
    addBennyBtn.textContent = "+"
    addBennyBtn.title = "Click to add benny"
    addBennyBtn.addEventListener("click", addBenny)
    container.appendChild(addBennyBtn)
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
    let total = 0;
    let rolls = [];
    let currentRoll;
    let groupId;

    do {
        const result = await diceBox.add(
            {
                sides: sides, 
                groupId: groupId,
            }, options
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
    return await rollExplodingDie(6, {
        themeColor: "#7f0e0e",
    })
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
    const traitTotal = traitRoll.total - penalty;
    const wildTotal = wildRoll.total - penalty;
    const bestTotal = Math.max(traitTotal, wildTotal);
    const usedWild = wildTotal > traitTotal;

    // Build result string
    let details = `d${die}: ${traitRoll.rolls.join('+')}=${traitRoll.total}`;
    details += ` | Wild: ${wildRoll.rolls.join('+')}=${wildRoll.total}`;
    if (penalty > 0) {
        details += ` | -${penalty} penalty`;
    }

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

    const traitTotal = traitRoll.total - penalty;
    const wildTotal = wildRoll.total - penalty;
    const bestTotal = Math.max(traitTotal, wildTotal);
    const usedWild = wildTotal > traitTotal;

    const unskilledPrefix = isUnskilled ? 'Unskilled ' : ''
    let details = `${unskilledPrefix}d${die}: ${traitRoll.rolls.join('+')}=${traitRoll.total}`;
    details += ` | Wild: ${wildRoll.rolls.join('+')}=${wildRoll.total}`;
    if (penalty > 0) {
        details += ` | -${penalty} ${isUnskilled ? 'penalty (unskilled -2 + wounds/fatigue)' : 'penalty'}`;
    }

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
    const roll = await rollExplodingDie(die);
    showRollResult(`Quick d${die}`, roll.total, roll.exploded, roll.rolls.join('+'));
    clearDice()
}

// Save/Load Character
function saveCharacter() {
    const data = {
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
        currentPP: document.getElementById('currentPP').value,
        maxPP: document.getElementById('maxPP').value,
        gear: document.getElementById('gear').value,
        notes: document.getElementById('notes').value
    };
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
}

function loadCharacter() {
    const saved = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!saved) return;

    const data = JSON.parse(saved);
    characterData = {
        edges: data.edges || [],
        hindrances: data.hindrances || [],
        powers: data.powers || [],
        skills: data.skills || {},
        wounds: data.wounds || 0,
        fatigue: data.fatigue || 0,
        incapacitated: data.incapacitated || false,
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
    if (data.currentPP) document.getElementById('currentPP').value = data.currentPP;
    if (data.maxPP) document.getElementById('maxPP').value = data.maxPP;
    if (data.gear) document.getElementById('gear').value = data.gear;
    if (data.notes) document.getElementById('notes').value = data.notes;

    // Restore skills
    Object.entries(characterData.skills).forEach(([skill, value]) => {
        const select = document.querySelector(`[data-skill="${skill}"]`);
        if (select) select.value = value;
    });

    // Update displays
    renderList('edges');
    renderList('hindrances');
    renderList('powers');
    updateWoundsFatigueDisplay();
    updateBenniesDisplay();
    updateDerivedStats();
    updateRank();
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
    initTrackers();
    loadCharacter();
    initAutoSave();
    updateDerivedStats();
    updateRank();

    // Advances field specifically updates rank
    document.getElementById('advances').addEventListener('input', () => {
        updateRank();
        saveCharacter();
    });

    // Enter key handlers for add inputs
    ['newEdge', 'newHindrance', 'newPower'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const type = id.replace('new', '').toLowerCase() + 's';
                addItem(type);
            }
        });
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

    document.querySelectorAll("[data-add-item]").forEach(element => {
        const itemType = element.getAttribute("data-add-item")
        element.addEventListener("click", () => addItem(itemType))
    })
});