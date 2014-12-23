(function ($) {
    'use strict';

    // Dropdowns
    var systemSel, minSel, maxSel, radSel, dfbSel;

    // Result tables
    var dist_table = $('#dist_table');
    var paths_table = $('#paths_table');
    var route_table = $('#route_table');

    var system, base, minV, maxV, radV, dfbV;

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
        var i, j, k, r, d;

        system = systemSel.val();
        base = rares[system];

        minV = minSel.val();
        maxV = maxSel.val();
        radV = radSel.val();
        dfbV = dfbSel.val();

        $('.sub_base').text(system);

        // Take a copy of the paths header row
        var thead = $('thead:first-child', paths_table);
        var theadcols = $('th', thead).length;
        thead.detach();

        // Clear result tables
        $('tbody', dist_table).remove();
        $('tbody,thead', paths_table).remove();

        // Make result tables visible
        //        dist_table.css('display', '');
        //        paths_table.css('display', '');
        //        route_table.css('display', '');

        // Get distances from base to other rares (unclustered)
        var dists = $.map(distances_from(base, minV, maxV, dfbV), function(v,k){return v;});
        dists.sort(sort_d_r);

        // Create lookup table for distances from base
        var dists_to_base = {};
        for(i=0; i<dists.length; i++) {
            dists_to_base[dists[i].r.system] = dists[i].d;
        }

        // Show main distances table
        var dists_body = $('<tbody>').appendTo(dist_table);
        for(i=0; i<dists.length; i++) {
            d = dists[i].d;
            r = dists[i].r;

            $('<tr>')
                .append($('<td>').text(Math.round(d)))
                .append($('<td>').text(r.system))
                .append($('<td>').text(r.station))
                .append($('<td>').text(r.dfb ? r.dfb : 'N/A')).addClass(r.dfb ? '' : 'na')
                .appendTo(dists_body);
        }


        var route_path = function (path) {
            if(path.length < 2) {
                return path;
            }

            var perms = path.reduce(permute, []);
            var min = -1, perm, d;
            var i;
            for(i=0; i<perms.length; i++) {
                perm = perms[i];
                d = measure_route(perm);
                if(min==-1 || d < min[0])
                    min = [d, perm];
            }

            return min[1];
        };

        var measure_route = function (route) {
            var dist = 0;
            var prev, cur;
            var i;
            for(i=0; i<route.length; i++) {
                cur = route[i].r;
                if(undefined === prev) {
                    prev = cur;
                    continue;
                }
                dist += distance_between(prev, cur);
                prev = cur;
            }
            return dist;
        };

        var display_path = function (path) {
            var prev = undefined;

            var centre = path[Math.floor(path.length/2)];

            var h = thead.clone().appendTo(paths_table);

            $('tr.table_title th', h).text(centre.system+" path");

            var path_body = $('<tbody>').appendTo(paths_table);

            for(var k=0; k<path.length; k++) {
                r = path[k];

                // Distance from previous node in path
                d = prev ? distance_between(prev, r) : 0;
                prev = r;

                if(!r) {
                    console.log(path);
                }

                $('<tr>')
                    .append($('<td>').text(Math.round(distance_between(base, path[k]))))
                    .append($('<td>').text(Math.round(d)))
                    .append($('<td>').text(r.system))
                    .append($('<td>').text(r.station))
                    .append($('<td>').text(r.dfb ? r.dfb : 'N/A')).addClass(r.dfb ? '' : 'na')
                    .appendTo(path_body);
            }
        };
        
        var paths = function () {
            var build_paths = function (start, dists, radV) {
                var paths_from_start = [];

                // Generate simple array of rares
                var remaining = dists.map(function(x) { return x.r; });

                // Remove start system from list of remainings (or we get a loop)
                for(var i=0; i<remaining.length; i++) {
                    if(remaining[i].system == start.system) {
                        remaining.splice(i, 1);
                        break;
                    }
                }

                // Recursive routine to find all valid paths through rares
                // within radV steps
                var _build_paths = function (path, remaining) {
                    var from = path[0];
                    var i, d, to, nremaining, npath, c=0;
                    var names;

                    for(i=0; i<remaining.length; i++) {
                        to = remaining[i];

                        npath = null;
                        d = distance_between(from, to);

                        if(d <= radV) {
                            c++;
                            nremaining = remaining.slice(0,i).concat(remaining.slice(i+1));
                            if(!npath)
                                npath = [to].concat(path);

                            if(nremaining.length > 0) {
                                if(!_build_paths(npath, nremaining)) {
                                    paths_from_start.push(npath);
                                }
                            }
                        }
                    }
                    return c>0;
                };

                _build_paths([start], remaining);

                return paths_from_start;
            };

            var is_subset = function (a, b) {
                var i;
                for(i=0; i<a.length; i++)
                    if(-1 === b.indexOf(a[i])) return false;
                return true;
            };

            var consolidate_paths = function (paths) {
                var j, i;
                for(i=0; i<paths.length; i++) {
                    if(undefined===paths[i]) continue;
                    for(j=0; j<paths.length; j++) {
                        if(i==j) continue;
                        if(undefined===paths[j]) continue;
                        if(is_subset(paths[i], paths[j])) {
                            paths[i] = undefined;
                            break;
                        }
                    }
                }
                return paths.filter(function (u) { return u!==undefined; });
            };

            var all_paths = [];

            // Build paths
            for(i=0; i<dists.length; i++) {
                var start = dists[i].r;
                all_paths = all_paths.concat(build_paths(start, dists, radV));
            }
            all_paths = consolidate_paths(all_paths);

            // Reorder each path by shortest route
            for(i=0; i<all_paths.length; i++) {
                all_paths[i] = route_path(all_paths[i]);
                display_path(all_paths[i]);
            }
        };

        paths();
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

        form.append('Min Voyage: ');
        minSel = $('<select>')
            .attr('id', 'min')
            .appendTo(form);

        form.append('Max Voyage: ');
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
                .prop('selected', i==120)
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



