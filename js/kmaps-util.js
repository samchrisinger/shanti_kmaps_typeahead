/**
 * Created by edwardjgarrett on 5/11/16.
 */

function KMapsUtil() {}

KMapsUtil.getLevelFacetParams = function (prefix, max_level) {
    // prefix could be 6403, or 6403/, or 6403/20/, and so on, without leading slash
    var slashes = prefix.replace(/\d/g, ''); // replace all digits, leaving slashes only
    var min_level = slashes.length + 1;
    var level_facets = [];
    for (var i=min_level; i<max_level+1; i++) {
        level_facets.push('{!key=level_' + i + ' facet.mincount=1 facet.limit=-1 facet.sort=count facet.prefix=' + Array(i+1).join('/') + prefix + '}ancestor_id_lpath');
    }
    return level_facets;
};

KMapsUtil.getLevelFacetResults = function (facet_fields) {
    var regex = /^level_[0-9]+$/;
    var level_facets = [];
    for (var level in facet_fields) {
        if (regex.test(level)) {
            for (var i=0; i<facet_fields[level].length; i+=2) {
                level_facets.push({
                    level: level.substring(6), // after level_
                    path: facet_fields[level][i].replace(/^\/+/g, ''),
                    count: facet_fields[level][i+1]
                });
            }
        }
    }
    return level_facets;
};