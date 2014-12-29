var jQuery = require('jquery');
var rares = require('./rares-data.js').rares;
rares['Wintii'] =
    {"system":"Wintii","station":"Whymper Landing","goods":"(none)","x":"-79.59375","y":"-81.9375","z":"79.0","dfb":2400};

(function ($) {
    'use strict';

    var distance_between = function (from, to) {
        var dx = to.x - from.x;
        var dy = to.y - from.y;
        var dz = to.z - from.z;
        return Math.sqrt(dx*dx + dy*dy + dz*dz);
    };

    var stations2 = ['39 Tauri', 'George Pantazis', 'Zeessze', 'Fujin', 'Bast', 'Altair', 'Witchhaul', 'Epsilon Indi'];
    var stations1 = ['Uszaa', 'Orrere', 'Diso', 'Leesti', 'Lave', 'Zaonce'];//, 'Wintii'];

    for(var i=0; i<stations1.length; i++)  {
        var t = 0;
        for(var j=0; j<stations2.length; j++)  {
            var d = distance_between(rares[stations1[i]], rares[stations2[j]]);
            t += d;
//            console.log(stations1[i]+"\t"+stations2[j]+"\t"+Math.round(d));
        }
        console.log(stations1[i]+"\t"+t);
    }

    

    var stations = ['Uszaa', 'Orrere', 'Diso', 'Leesti', 'Lave', 'Zaonce', 'Wintii'];


    function permute(res, item, key, arr) {
        return res.concat(
            arr.length > 1 ?
                arr
                .slice(0, key)
                .concat(arr.slice(key + 1))
                .reduce(permute, [])
                .map(function(perm) { return [item].concat(perm); })
            : item);
    }

    var arr = stations.reduce(permute, []);

    var s = [];
    
    for(var i=0; i<arr.length; i++) {
        var t = 0;
        for(var j=0; j<arr[i].length-1; j++) {
            var from = rares[arr[i][j]];
            var to = rares[arr[i][j+1]];
            t += distance_between(from, to);
        }
        t = Math.round(t);
        s.push([t, arr[i].join(',')]);
    }

    s.sort(function (a,b) {
        return a[0] - b[0];
    });
    s = s.filter(function (a) {
        return (a[1].search(/^Wintii,Zaonce.+Uszaa$/) != -1) ?true:false;
    });
    console.log(s);

})(jQuery);
