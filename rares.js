(function ($) {
    'use strict';

    // Dropdowns
    var systemSel, sortbySel, minSel, maxSel, radSel, dfbSel;

    // Result tables

    var distances_from = function (from, min, max, maxdfb) {
        if(!min) min = -10000;
        if(!max) min = 10000000;

        var i, d, to;
        var dists = {};

        for(var i in rares) {
            if(!rares.hasOwnProperty(i)) continue;

            to = rares[i];

            d = distance_between(from, to);

            if((!min || d >= min) &&
               (!max || d <= max) &&
               (!maxdfb || to.dfb < maxdfb))
                dists[to.system] = {d:d, r:to};
        }

        return dists;
    };

    var sort_d_r = function (a, b) {
        return a.d - b.d;
    };

    var distance_between = function (from, to) {
        var dx = to.x - from.x;
        var dy = to.y - from.y;
        var dz = to.z - from.z;
        return Math.sqrt(dx*dx + dy*dy + dz*dz);
    };

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

    var update_tables = function () {
        var i, j;
        var system, base, minV, maxV, radV, dfbV;
        var row, cell;

        system = systemSel.val();
        base = rares[system];
        minV = minSel.val();
        maxV = maxSel.val();
        radV = radSel.val();
        dfbV = dfbSel.val();


        $('#dist_table').remove();
        var table = $('<table id="dist_table">').insertAfter($('h1'));
        var thead = $('<thead>').appendTo(table);
        var tbody = $('<tbody>').appendTo(table);

        row = $('<tr>').appendTo(thead);
        $('<th>D<sub></sub> (Ly)</th>').addClass('dist_dist').appendTo(row);
        $('<th>').addClass('dist_system').text('System').appendTo(row);
        $('<th>').addClass('dist_station').text('Station').appendTo(row);
        $('<th>').addClass('dist_dfb').text('Supercruise (Ls)').appendTo(row);

        $('h1').text("Distances from "+system);
        
        $('sub').text(system);

        // Get distances from base to other rares (unclustered)
        var dists = $.map(distances_from(base, minV, maxV, dfbV), function(v,k){return v;});
        dists.sort(sort_d_r);

        // Create lookup table for distances from base
        var dists_to_base = {};
        for(i=0; i<dists.length; i++) {
            dists_to_base[dists[i].r.system] = dists[i].d;

            $('<th>')
                .addClass('xref_system')
                .appendTo($('tr', thead))
                .text(dists[i].r.system);
        }


        // Show main distances table
        var r, d, r2, d2;
        for(i=0; i<dists.length; i++) {
            d = dists[i].d;
            r = dists[i].r;

            row = $('<tr>').appendTo(tbody).data('system', r.system);
            row.append($('<td>').addClass('dist_base').text(Math.round(d)));
            row.append($('<td>').addClass('dist_system').text(r.system));
            row.append($('<td>').addClass('dist_station').text(r.station));
            row.append($('<td>').addClass('dist_dfb').text(r.dfb ? r.dfb : 'N/A').addClass(r.dfb ? '' : 'na'));

            for(j=0; j<dists.length; j++) {
                cell = $('<td>').appendTo(row);
                cell.addClass('xref_system');
                if(i==j) {
                    cell.addClass('x').text(0);
                }
                else {
                    r2 = dists[j].r;
                    d2 = distance_between(r, r2);
                    cell.text(Math.round(d2));
                    if(d2 <= radV)
                        cell.addClass('clustered');
                }
            }
        }

        $(document).on('click', '#dist_table thead th', function () {
            var self = $(this);
            var col = self.index();

            var sorter = function (a, b) {
                a = $('td', a).eq(col).text();
                b = $('td', b).eq(col).text();

                var A = parseInt(a);
                var B = parseInt(b);
                if(isNaN(A) && isNaN(B))
                    return a.localeCompare(b);
                else
                    return (A==B ? 0 : (A<B ? -1 : 1));
            };

            var rows = $('tr', tbody).get();
            rows.sort(sorter);
            tbody.append(rows);
        });
    };

    $(function () {
        var form = $('#selector');
        var i;

        form.append('Base: ');
        systemSel = $('<select>')
            .attr('id', 'system')
            .appendTo(form);

        for(i in rares) {
            if(!rares.hasOwnProperty(i)) continue;
            $('<option>')
                .text(i)
                .val(i)
                .prop('selected', i=='Lave')
                .appendTo(systemSel);
        }

        form.append('Min: ');
        minSel = $('<select>')
            .attr('id', 'min')
            .appendTo(form);

        form.append('Max: ');
        maxSel = $('<select>')
            .attr('id', 'max')
            .appendTo(form);

        form.append('Radius: ');
        radSel = $('<select>')
            .attr('id', 'rad')
            .appendTo(form);

        form.append('Max SC: ');
        dfbSel = $('<select>')
            .attr('id', 'dfb')
            .appendTo(form);


        $('<button>')
            .on('click', update_tables)
            .text('Update')
            .appendTo(form);

        var tmax, d, i, j;
        for(i in rares) {
            if(!rares.hasOwnProperty(i)) continue;
            for(j in rares) {
                if(!rares.hasOwnProperty(j)) continue;
                if(i===j) continue;
                d = distance_between(rares[i], rares[j]);
                if(!tmax || d > tmax) tmax = d;
            }
        }

        $('<option>')
            .text("1 Ly")
            .val(1)
            .appendTo(minSel);

        for(i=10; i<=tmax+10; i+=10) {
            $('<option>')
                .text(i+" Ly")
                .val(i)
                .prop('selected', i==140)
                .appendTo(minSel);

            $('<option>')
                .text(i+" Ly")
                .val(i)
                .prop('selected', i==200)
                .appendTo(maxSel);
        };

        for(i=5; i<=100; i+=5) {
            $('<option>')
                .text(i+" Ly")
                .val(i)
                .appendTo(radSel)
                .prop('selected', i==40);
        }

        var addDFB = function (x) {
            $('<option>')
                .text(x ? x+" Ls" : "unlimited")
                .val(x)
                .prop('selected', i==2000)
                .appendTo(dfbSel);
        };

        for(i=100; i<1000; i+=100)
            addDFB(i);
        for(i=1000; i<10000; i+=1000)
            addDFB(i);
        for(i=10000; i<100000; i+=10000)
            addDFB(i);
        for(i=100000; i<1000000; i+=100000)
            addDFB(i);
        addDFB(0);

    });

})(jQuery);



