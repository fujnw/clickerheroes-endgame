var GOLD_SCALE = 1.15;
var HP_SCALE;   // 2xn array. First row is zones. Second row is hpscales

function prepareHPScale() {
    HP_SCALE = [[1, 140], [1.55, 1.145]];
    for (i=1; i<=400; i++) {
        HP_SCALE[0].push(500 * i);
        HP_SCALE[1].push(1.145 + 0.001 * i);
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
    var as = parseFloat($("#inputAS").val());
    var lghs = parseFloat($("#inputLgHS").val());
    
    var errMsg = "";
    if (isNaN(as) || isNaN(lghs)) {
        errMsg = "Please enter inputs";
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
    
    prepareHPScale();

    var tp = 0.25 - 0.23 * Math.exp(-0.0003 * as);
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
            zoneTL < 10000 ? "<10K" : zoneTL.toFixed(0)
        ])
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
        if (i == HEROES.length - 1 || 
            gold < heroUpgradeBaseCost(i + 1)) {
            break;
        }
    }
    return i;
}

function zoneReached(lgHS, i, active=true) {
    let R = Math.log10(getHeroAttr(i, "damageScale")) / 
        Math.log10(getHeroAttr(i, "costScale")) / 25;
    let lgDmgMultPerZone = Math.log10(GOLD_SCALE) * R;
    let efficiency = getHeroAttr(i, 'dps') - 
        R * (getHeroAttr(i, "lv1cost") + 175 * Math.log10(getHeroAttr(i, "costScale")));
    
    let RHS = (efficiency + (2.4 + (active * 0.5) + 1.5 * R) * lgHS 
         + 1.86 - 2 + 21.12 * R);   // Minus 2 to account for boss HP
    
    let lghp0 = 1;  // lgHP at zone 1
    let nbp = HP_SCALE[0].length;
    for(j = 0; j < nbp - 1; j++) {
        // Loop through every HP breakpoint
        let hpscale = HP_SCALE[1][j];
        let lghp1 = lghp0 + (HP_SCALE[0][j + 1] - HP_SCALE[0][j]) * 
            Math.log10(hpscale);
        let z0 = HP_SCALE[0][j];
        let z1 = HP_SCALE[0][j + 1];
        
        if(lghp0 - lgDmgMultPerZone * z0 > RHS) {
            // Cannot advance past the first breakpoint
            return -1;
        }
        if(lghp0 - lgDmgMultPerZone * z0 <= RHS && lghp1 - lgDmgMultPerZone * z1 > RHS) {
            // In the middle of two breakpoints. Solve linear equation.
            let M = 1 / (Math.log10(hpscale) - lgDmgMultPerZone);
            let zone = M * (RHS - lghp0 + z0 * Math.log10(hpscale));
            return zone;
        }
        lghp0 = lghp1;
    }
    
    let M = 1 / (Math.log10(HP_SCALE[1][nbp - 1]) - lgDmgMultPerZone);
    let zone = M * (RHS - lghp0 + Math.log10(HP_SCALE[1][nbp - 1]) * HP_SCALE[0][nbp - 1]);
    return zone;
}

function heroUpgradeBaseCost(hnum) {
    let level = getHeroAttr(hnum, "reqlevel");
    return getHeroAttr(hnum, "lv1cost") + 
        Math.log10(getHeroAttr(hnum, "costScale")) * level;
}

function dataArrayToHTML(data) {
    var data2 = [];
    for (i = 0; i < data.length; i++) {
        data2.push("<td>" + data[i].join("</td><td>") + "</td>");
    }
    datastr = "<tr>" + data2.join("</tr><tr>") + "</tr";
    return datastr;
}