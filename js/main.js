var MAX_ZONE = 2**31 - 1;
var GOLD_SCALE = 1.15;
var HP_SCALE;   // 2xn array. First row is zones. Second row is hpscales
var HEROES;
var ROOT2 = false;
var ANCIENT_SOULS;

function prepareHPScale() {
    if (!ROOT2) {
        HP_SCALE = [[1, 140], [1.55, 1.145]];
        for (i=1; i<=400; i++) {
            HP_SCALE[0].push(500 * i);
            HP_SCALE[1].push(1.145 + 0.001 * i);
        }
    } else {
        var bps = root2_customized_bps(ANCIENT_SOULS);
        HP_SCALE = [[1], [1.55]];
        for (i=0; i<bps.length; i++) {
            HP_SCALE[0].push(bps[i][3]);
            HP_SCALE[1].push(bps[i][2]);
        }
    }
    
}

var HERO_TABLE_COLUMNS = {
    'name': 0,
    'lv1cost': 1,
    'costScale': 2,
    'damageScale': 3,
    'reqlevel': 4,
    'dps': 5
}

function getHeroAttr(hnum, attr) {
    return HEROES[hnum][HERO_TABLE_COLUMNS[attr]];
}

function calculateProgression() {
    ANCIENT_SOULS = parseFloat($("#inputAS").val());
    var lghs = parseFloat($("#inputLgHS").val());
    
    var errMsg = "";
    if (isNaN(ANCIENT_SOULS) || isNaN(lghs) ||
       $("#gameRoot2").prop("checked") == $("#gameVanilla").prop("checked")) {
        errMsg = "Please enter all inputs";
    } else if (lghs < 100) {
        errMsg = "Requires lgHS >= 100";
    }
    
    if (errMsg.length > 0) {
        $("#inputWarning").html(errMsg);
        $("#progressTbl tbody").html("");
        return;
    } else {
        $("#inputWarning").html("");
    }
    
    ROOT2 = $("#gameRoot2").prop("checked");
    HEROES = ROOT2 ? HEROES_ROOT2 : HEROES_VANILLA;
    
    prepareHPScale();

    var tp = ROOT2 ? root2_tp(ANCIENT_SOULS) : 
        0.25 - 0.23 * Math.exp(-0.0003 * ANCIENT_SOULS);
    $("#outputTP").val(tp.toFixed(6));
    
    var data = [];
    var start = 0;
    var startTL = 0;
    var lghsStart = lghs;
    var hlevel, lghsEnd;
    
    var t0 = performance.now();
    
    for (i = 0; i < 250; i++) {
        hnum = heroReached(lghsStart, start);
        zone = zoneReached(lghsStart, hnum);
        hlevel = (zone * Math.log10(GOLD_SCALE) + 1.5 * lghsStart + 21 
            - getHeroAttr(hnum, "lv1cost")) / 
            Math.log10(getHeroAttr(hnum, "costScale"));
        lghsEnd = (zone / 5 - 20) * Math.log10(1 + tp) 
            + Math.log10(20 * 10000 * (1 + tp) / tp);
        lghsChange = lghsEnd - lghsStart > 50 ? lghsEnd - lghsStart 
            : Math.log10(1 + Math.pow(10, lghsEnd - lghsStart));
        
        hnumTL = heroReached(lghsStart, startTL, active=false);
        zoneTL = zoneReached(lghsStart, hnumTL, active=false);
        
        data.push([
            i,
            lghsStart.toFixed(2),
            getHeroAttr(hnum, "name"),
            zone.toFixed(0),
            hlevel.toFixed(0),
            lghsChange.toFixed(2),
            ROOT2 ? "" : zoneTL.toFixed(0)
        ])
        if (zone == MAX_ZONE) { // Stop if encountering infinite ascension
            break;
        }
        lghsStart += lghsChange;
        start = hnum;
        startTL = hnumTL;
    }
    var t1 = performance.now();
    console.log(t1 - t0);
    
    $("#progressTbl tbody").html(dataArrayToHTML(data));
}

function heroReached(lgHS, start=0, active=true) {
    // start is used to search for reachable hero 
    // from the previous ascension, to save execution time
    var zone, gold;
    var i = start;
    for (; i < HEROES.length; i++) {
        zone = zoneReached(lgHS, i, active);
        gold = zone * Math.log10(GOLD_SCALE) + 1.5 * lgHS + 21;
        if (zone == MAX_ZONE || i == HEROES.length - 1 || 
            gold < heroUpgradeBaseCost(i + 1)) {
            break;
        }
    }
    return i;
}

function zoneReached(lgHS, i, active=true) {
    let R = Math.log10(getHeroAttr(i, "damageScale")) / 
        Math.log10(getHeroAttr(i, "costScale")) / 25;
    let lgDmgMultPerZone = Math.log10(GOLD_SCALE) * R + 
        ROOT2 * (ANCIENT_SOULS >= 6400) * Math.log10(1.01) / 10;
    let efficiency = getHeroAttr(i, 'dps') - 
        R * (getHeroAttr(i, "lv1cost") + 175 * Math.log10(getHeroAttr(i, "costScale")));

    let startingGold = 21.12 + 1.5 * lgHS;
    startingGold += ROOT2 * (i >= 47) * 98; // BomberMax global gold boost on Root2
    
    let RHS = efficiency + (2.4 + active * 0.5) * lgHS 
         + 1.86 - 2 + startingGold * R;   // Minus 2 to account for boss HP    
    RHS += ROOT2 * (i >= 48) * 43.64;   // Gog global DPS boost on Root2
    
    let reqzone = (heroUpgradeBaseCost(i) - startingGold) / 
        Math.log10(GOLD_SCALE);
    
    let lghp0 = 1;  // lgHP at zone 1
    let nbp = HP_SCALE[0].length;
    for(j = 0; j < nbp - 1; j++) {
        // Loop through every HP breakpoint
        let hpscale = HP_SCALE[1][j];
        let lghp1 = lghp0 + (HP_SCALE[0][j + 1] - HP_SCALE[0][j]) * 
            Math.log10(hpscale);
        let z0 = HP_SCALE[0][j];
        let z1 = HP_SCALE[0][j + 1];
        
        if(z1 >= reqzone && lghp0 - lgDmgMultPerZone * z0 <= RHS && lghp1 - lgDmgMultPerZone * z1 > RHS) {
            // In the middle of two breakpoints. 
            // Also must be approximately above the required zone to get this hero
            // Solve linear equation.
            let M = 1 / (Math.log10(hpscale) - lgDmgMultPerZone);
            let zone = M * (RHS - lghp0 + z0 * Math.log10(hpscale));
            return zone;
        }
        lghp0 = lghp1;
    }
    
    let M = 1 / (Math.log10(HP_SCALE[1][nbp - 1]) - lgDmgMultPerZone);
    if (M < 0) {    // Infinite ascension (monster scaling < damage increase)
        return MAX_ZONE;
    }
    let zone = M * (RHS - lghp0 + Math.log10(HP_SCALE[1][nbp - 1]) * HP_SCALE[0][nbp - 1]);
    return zone;
}

function heroUpgradeBaseCost(hnum) {
    let level = getHeroAttr(hnum, "reqlevel");
    // Force Yachiyl7 on Root2 to use Yachiyl6's cost scaling
    let costScale = getHeroAttr(
        hnum - (ROOT2 && hnum == HEROES.length - 1), "costScale");
    return getHeroAttr(hnum, "lv1cost") + Math.log10(costScale) * level;
}

function dataArrayToHTML(data) {
    var data2 = [];
    for (i = 0; i < data.length; i++) {
        data2.push("<td>" + data[i].join("</td><td>") + "</td>");
    }
    datastr = "<tr>" + data2.join("</tr><tr>") + "</tr";
    return datastr;
}
