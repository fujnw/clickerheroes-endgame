var HP_SCALE = 1.545;
var GOLD_SCALE = 1.15;

function calculateProgression() {    
    var as = parseFloat($("#inputAS").val());
    var lghs = parseFloat($("#inputLgHS").val());
    
    var errMsg = "";
    if (isNaN(as) || isNaN(lghs)) {
        errMsg = "Please enter inputs";
    } else if (lghs < 3650) {
        errMsg = "LgHS needs to be >=3650 to go past zone 200K";
    }
    
    if (errMsg.length > 0) {
        $("#inputWarning").html(errMsg);
        $("#progressTbl tbody").html("");
        return;
    } else {
        $("#inputWarning").html("");
    }

    var tp = 0.25 - 0.23 * Math.exp(-0.0003 * as);
    $("#outputTP").val(tp.toFixed(6));
    
    var data = [];
    var start = 0;
    var startTL = 0;
    var lghsStart = lghs;
    var hlevel, lghsEnd;
    
    for (i = 0; i < 250; i++) {
        huid = heroReached(lghsStart, start);
        zone = zoneReached(lghsStart, huid);
        hlevel = (zone * Math.log10(GOLD_SCALE) + 1.5 * lghsStart + 21 
            - getHeroAttr(huid, "lv1cost")) / 
            Math.log10(getHeroAttr(huid, "costScale"));
        lghsEnd = (zone / 5 - 20) * Math.log10(1 + tp) 
            + Math.log10(20 * 10000 * (1 + tp) / tp);
        lghsChange = lghsEnd - lghsStart > 50 ? lghsEnd - lghsStart 
            : Math.log10(1 + Math.pow(10, lghsEnd - lghsStart));
        
        huidTL = heroReached(lghsStart, startTL, active=false);
        zoneTL = zoneReached(lghsStart, huidTL, active=false);
        
        data.push([
            i,
            lghsStart.toFixed(2),
            HERO_UPGRADES[huid]["name"],
            zone.toFixed(0),
            hlevel.toFixed(0),
            lghsChange.toFixed(2),
            zoneTL < 200000 ? "<200K" : zoneTL.toFixed(0)
        ])
        lghsStart += lghsChange;
        start = huid;
        startTL = huidTL;
    }
    
    $("#progressTbl tbody").html(dataArrayToHTML(data));    
}

function heroReached(lgHS, start=0, active=true) {
    // start is used to search for reachable hero 
    // from the previous ascension, to save execution time
    var zone, gold;
    var i = start;
    for (; i < HERO_UPGRADES.length; i++) {
        zone = zoneReached(lgHS, i, active);
        gold = zone * Math.log10(GOLD_SCALE) + 1.5 * lgHS + 21;
        if (i == HERO_UPGRADES.length - 1 || 
            gold < heroUpgradeBaseCost(i + 1)) {
            break;
        }
        console.log(zone, gold, HERO_UPGRADES[i]['name']);
    }
    return i;
}

function zoneReached(lgHS, i, active=true) {
    let R = Math.log10(getHeroAttr(i, "damageScale")) / 
        Math.log10(getHeroAttr(i, "costScale")) / 25;
    let efficiency = HERO_UPGRADES[i]['dps'] - R * getHeroAttr(i, "lv1cost");
    let M = 1 / (Math.log10(HP_SCALE) - R * Math.log10(GOLD_SCALE));
    let zone = M * 
        (efficiency + (2.4 + (active * 0.5) + 1.5 * R) * lgHS 
         + 12377 + 21.12 * R);
    return zone;
}

function heroUpgradeBaseCost(huid) {
    let level = HERO_UPGRADES[huid]["reqlevel"];
    return getHeroAttr(huid, "lv1cost") + 
        Math.log10(getHeroAttr(huid, "costScale")) * level;
}

function dataArrayToHTML(data) {
    var data2 = [];
    for (i = 0; i < data.length; i++) {
        data2.push("<td>" + data[i].join("</td><td>") + "</td>");
    }
    datastr = "<tr>" + data2.join("</tr><tr>") + "</tr";
    return datastr;
}