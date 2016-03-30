// See https://github.com/jquery-boilerplate/jquery-boilerplate/blob/master/dist/jquery.boilerplate.js
;
(function ($, window, document, undefined) {
    "use strict";

    var pluginName = "kmapsTypeahead",
        defaults = {
            term_index: "http://kidx.shanti.virginia.edu/solr/termindex-dev-update",
            domain: "places",
            root_kmapid: 13735,
            autocomplete_field: 'name_autocomplete',
            max_terms: 999,
            max_defaults: 50,
            min_chars: 1,
            selected: 'omit', // possible values: 'omit' or 'class'
            ancestors: 'on',
            ancestor_separator: ' - ',
            prefetch_facets: 'off',
            prefetch_field: 'feature_types_xfacet',
            prefetch_filters: ['tree:places', 'ancestor_id_path:13735'],
            prefetch_limit: -1,
            zero_facets: 'skip', // possible values: 'skip' or 'ignore'
            empty_query: 'level_i:2', //ignored unless min_chars = 0
            empty_limit: 5,
            empty_sort: '',
            fields: '',
            filters: '',
            menu: '',
            no_results_msg: ''
        };

    function Plugin(element, options) {
        this.element = element;
        this.settings = $.extend({}, defaults, options);
        this.fq = [];
        this.refacet = null;
        this.selected = [];
        this._defaults = defaults;
        this._name = pluginName;
        this.init();
    }

    $.extend(Plugin.prototype, {
        init: function () {
            var plugin = this;
            var kmaps_engine, facet_counts; //Bloodhound instance
            var input = $(plugin.element);
            var settings = plugin.settings;

            var use_ancestry = (settings.ancestors == 'on');
            var prefetch_facets = (settings.prefetch_facets == 'on');
            var skip_zeros = (settings.zero_facets == 'skip');
            var ancestor_field = (settings.domain == 'subjects') ? 'ancestor_ids_default' : 'ancestor_ids_pol.admin.hier';

            plugin.fq.push('tree:' + settings.domain);
            if (settings.filters) {
                plugin.fq.push(settings.filters);
            }
            if (settings.root_kmapid) {
                plugin.fq.push(ancestor_field + ':' + settings.root_kmapid);
            }
            var fl = [];
            fl.push('id', 'header');
            if (use_ancestry) {
                fl.push('ancestors', 'ancestor_id_path');
                fl.push(ancestor_field);
            }
            if (settings.fields) {
                fl = fl.concat(settings.fields.split(','));
            }
            var params = {
                'wt': 'json',
                'indent': true,
                'fl': fl.join(),
                'hl': true,
                'hl.fl': settings.autocomplete_field,
                'hl.simple.pre': '',
                'hl.simple.post': ''
            };
            var url = settings.term_index + '/select?' + $.param(params, true);
            var options = {
                datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
                queryTokenizer: Bloodhound.tokenizers.whitespace,
                sufficient: settings.max_terms,
                identify: function (term) {
                    return term.id;
                },
                remote: {
                    url: url,
                    prepare: function (query, remote) { //http://stackoverflow.com/questions/18688891/typeahead-js-include-dynamic-variable-in-remote-url
                        var extras = {};
                        var val = input.val();
                        if (val) {
                            extras = {
                                'q': settings.autocomplete_field + ':' + val.toLowerCase().replace(/[\s\u0f0b\u0f0d]+/g, '\\ '),
                                'rows': settings.max_terms,
                                'fq': plugin.fq
                            };
                        }
                        else {
                            if (!prefetch_facets) { // prefetch_facets shouldn't get here anyway
                                extras = {
                                    'q': settings.empty_query,
                                    'rows': settings.empty_limit,
                                    'sort': settings.empty_sort
                                };
                            }
                        }
                        remote.url += '&' + $.param(extras, true);
                        return remote;
                    },
                    filter: function (json) {
                        var filtered = $.map(json.response.docs, function (doc) {
                            var highlighting = json.highlighting[doc.id];
                            var val = settings.autocomplete_field in highlighting ? highlighting[settings.autocomplete_field][0] : doc.header; //take first highlight if present
                            var item = {
                                id: doc.id.substring(doc.id.indexOf('-') + 1),
                                doc: doc,
                                value: val,
                                count: 0 // for good measure
                            };
                            if (use_ancestry) {
                                $.extend(item, {
                                    anstring: settings.root_kmapid ?
                                        doc.ancestors.slice(doc[ancestor_field].indexOf(parseInt(settings.root_kmapid))).reverse().join(settings.ancestor_separator) :
                                        doc.ancestors.slice(0).reverse().join(settings.ancestor_separator)
                                });
                            }
                            return item;
                        });
                        // exclude terms that were already prefetched
                        // ideally other matches would fill the gap
                        filtered.filter(function (term) {
                            return (kmaps_engine.get([term.id]).length == 0);
                        });
                        if (use_ancestry) {
                            filtered.sort(function (a, b) { // sort results by ancestry
                                return a.doc.ancestor_id_path > b.doc.ancestor_id_path;
                            });
                        }
                        return filtered;
                    }
                }
            };
            var sortFacetsDescending = function (a, b) {
                return b.count - a.count;
            };
            if (prefetch_facets) {
                var prefetch_params = {
                    'wt': 'json',
                    'indent': true,
                    'fq': settings.prefetch_filters,
                    'fl': '*',
                    'q': '*:*',
                    'rows': 0,
                    'facet': true,
                    'facet.field': settings.prefetch_field,
                    'facet.limit': settings.prefetch_limit,
                    'facet.sort': 'count',
                    'facet.mincount': 1
                };
                $.extend(options, {
                    sorter: sortFacetsDescending,
                    prefetch: {
                        url: settings.term_index + '/select?' + $.param(prefetch_params, true),
                        cache: false,
                        filter: function (json) {
                            var raw = json.facet_counts.facet_fields[settings.prefetch_field];
                            var facets = [];
                            for (var i = 0; i < raw.length; i += 2) {
                                var spl = raw[i].indexOf(':');
                                facets.push({
                                    id: raw[i].substring(0, spl),
                                    value: raw[i].substring(spl + 1),
                                    count: parseInt(raw[i + 1]),
                                    refacet: false
                                });
                            }
                            return facets;
                        }
                    }
                });
                facet_counts = new Bloodhound({
                    datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
                    queryTokenizer: Bloodhound.tokenizers.whitespace,
                    sufficient: settings.max_terms,
                    identify: function (term) {
                        return term.id;
                    },
                    remote: {
                        url: settings.term_index + '/select?' + $.param(prefetch_params, true),
                        cache: false, // change to true
                        prepare: function (query, remote) {
                            if (plugin.refacet !== null) {
                                remote.url += '&' + $.param({'fq': plugin.refacet}, true);
                            }
                            else { // don't go to the server at all
                                remote.url = null;
                            }
                            return remote;
                        },
                        filter: function (json) {
                            var raw = json.facet_counts.facet_fields[settings.prefetch_field];
                            var facets = [];
                            for (var i = 0; i < raw.length; i += 2) {
                                var spl = raw[i].indexOf(':');
                                facets.push({
                                    id: raw[i].substring(0, spl),
                                    value: raw[i].substring(spl + 1),
                                    count: parseInt(raw[i + 1]),
                                    refacet: true
                                });
                            }
                            return facets;
                        }
                    }
                });
                facet_counts.initialize();
            }
            kmaps_engine = new Bloodhound(options);

            var typeaheadOptions = $.extend(
                settings.menu ? {menu: settings.menu} : {},
                {
                    minLength: settings.min_chars,
                    highlight: false,
                    hint: true,
                    classNames: {
                        input: 'kmaps-tt-input',
                        hint: 'kmaps-tt-hint',
                        menu: 'kmaps-tt-menu',
                        dataset: 'kmaps-tt-dataset',
                        suggestion: 'kmaps-tt-suggestion',
                        empty: 'kmaps-tt-empty',
                        open: 'kmaps-tt-open',
                        cursor: 'kmaps-tt-cursor',
                        highlight: 'kmaps-tt-highlight'
                    }
                }
            );

            var default_templates = {
                pending: function () {
                    return '<div class="kmaps-tt-message kmaps-tt-searching">Searching ...</div>'
                }
            };
            var templates = $.extend({}, default_templates, {
                header: function (data) {
                    var nres = 'Showing ' + data.suggestions.length + ' result' + (data.suggestions.length == 1 ? '' : 's');
                    return '<div class="kmaps-tt-message kmaps-tt-results">' + nres + ' for <span class="kmaps-tt-query">' + data.query + '</span></div>';
                },
                notFound: function (data) {
                    var msg = 'No results for <span class="kmaps-tt-query">' + data.query + '</span>. ' + settings.no_results_msg;
                    return '<div class="kmaps-tt-message kmaps-tt-no-results">' + msg + '</div>';
                },
                suggestion: function (data) {
                    var sc = data.selected ? ' class="kmaps-tt-selected"' : '';
                    return '<div' + sc + '><span class="kmaps-term">' + data.value + '</span>' +
                        (use_ancestry ? ' <span class="kmaps-ancestors">' + data.anstring + '</span>' : '') + '</div>';
                }
            });
            var prefetch_templates = $.extend({}, default_templates, {
                header: function (data) {
                    var msg;
                    if (data.query === '') {
                        if (settings.max_defaults > data.suggestions.length) {
                            msg = 'Showing all ' + data.suggestions.length + ' filters';
                        }
                        else {
                            msg = 'Showing top ' + settings.max_defaults + ' filters';
                        }
                    }
                    else {
                        msg = 'Showing filters with <em>' + data.query + '</em>';
                    }
                    return '<div class="kmaps-tt-message"><span class="results">' + msg + '</em></span></div>';
                },
                notFound: function (data) {
                    var msg = 'No filters with <em>' + data.query + '</em>. ' + settings.no_results_msg;
                    return '<div class="kmaps-tt-message"><span class="no-results">' + msg + '</span></div>';
                },
                suggestion: function (data) {
                    var cl = [];
                    if (data.selected) cl.push('kmaps-tt-selected');
                    cl.push(data.count > 0 ? 'selectable-facet' : 'zero-results-facet');
                    return '<div class="' + cl.join(' ') + '"><span class="kmaps-term">' + data.value + '</span> ' +
                        '<span class="kmaps-count">(' + data.count + ')</span>' +
                        (use_ancestry ? ' <span class="kmaps-ancestors">' + data.anstring + '</span>' : '') + '</div>';
                }
            });

            var filterSelected = function (suggestions) {
                if (plugin.selected.length == 0) {
                    return suggestions;
                }
                else if (plugin.settings.selected == 'omit') {
                    return $.grep(suggestions, function (suggestion) {
                        return $.inArray(suggestion.id, plugin.selected) === -1;
                    });
                }
                else {
                    return $.map(suggestions, function (suggestion) {
                        if ($.inArray(suggestion.id, plugin.selected) === -1) {
                            return suggestion;
                        }
                        else {
                            suggestion.selected = true;
                            return suggestion;
                        }
                    });
                }
            };
            var lastCursor;
            if (prefetch_facets) {
                input.typeahead(typeaheadOptions,
                    {
                        name: 'facet_counts',
                        limit: parseInt(settings.max_terms) * 2, // apparently needs to be doubled to accommodate both prefetched and remote terms
                        display: 'value',
                        source: facet_counts,
                        templates: {
                            header: function (data) {
                                return '<div class="kmaps-tt-message">Narrow your search</div>';
                            },
                            suggestion: function (data) {
                                return '<div><span class="kmaps-term">' + data.value + '</span> <span class="kmaps-count">(' + data.count + ')</span>' +
                                    (use_ancestry ? ' <span class="kmaps-ancestors">' + data.anstring + '</span>' : '') + '</div>';
                            }
                        }
                    },
                    {
                        name: settings.domain,
                        limit: 999,//parseInt(settings.max_terms) * 2, // apparently needs to be doubled to accommodate both prefetched and remote terms
                        display: 'value',
                        templates: prefetch_templates,
                        source: function (q, sync, async) {
                            if (q === '') {
                                var facets = kmaps_engine.all();
                                if (facets.length > 0 && settings.max_defaults > 0) {
                                    sync(filterSelected(facets.sort(sortFacetsDescending).slice(0, Math.min(facets.length, settings.max_defaults))));
                                }
                                else {
                                    kmaps_engine.search(q, function(suggestions) {
                                        sync(filterSelected(suggestions))
                                    }, function(suggestions) {
                                        async(filterSelected(suggestions));
                                    });
                                }
                            }
                            else {
                                kmaps_engine.search(q, function(suggestions) {
                                    sync(filterSelected(suggestions))
                                }, function(suggestions) {
                                    async(filterSelected(suggestions));
                                });
                            }
                        }
                    }
                ).bind('typeahead:cursorchange',
                    function (ev, suggestion) {
                        if (suggestion === undefined) {
                            lastCursor = -1;
                        }
                        else {
                            var $wrapper = input.parent();
                            var cursor = $wrapper.find('.kmaps-tt-suggestion').index($wrapper.find('.kmaps-tt-cursor'));
                            if (suggestion.selected || (skip_zeros && suggestion.count == 0)) { // skip over already selected suggestions
                                var diff = cursor - lastCursor;
                                var delta = lastCursor == -1 && diff > 1 ? -1 : diff > 0 ? +1 : -1;
                                lastCursor = cursor; // must preceded moveCursor instruction
                                input.typeahead('moveCursor', delta);
                            }
                            else {
                                lastCursor = cursor;
                            }
                        }
                    }
                );
            }
            else {
                input.typeahead(typeaheadOptions,
                    {
                        name: settings.domain,
                        limit: parseInt(settings.max_terms) * 2, // apparently needs to be doubled to accommodate both prefetched and remote terms
                        display: 'value',
                        templates: templates,
                        source: function (q, sync, async) {
                            lastCursor = -1;
                            kmaps_engine.search(q, sync, function (suggestions) {
                                async(filterSelected(suggestions));
                            });
                        }
                    }
                ).bind('typeahead:cursorchange',
                    function (ev, suggestion) {
                        if (suggestion === undefined) {
                            lastCursor = -1;
                        }
                        else {
                            var $wrapper = input.parent();
                            var cursor = $wrapper.find('.kmaps-tt-suggestion').index($wrapper.find('.kmaps-tt-cursor'));
                            if (suggestion.selected) { // skip over already selected suggestions
                                var diff = cursor - lastCursor;
                                var delta = lastCursor == -1 && diff > 1 ? -1 : diff > 0 ? +1 : -1;
                                lastCursor = cursor; // must preceded moveCursor instruction
                                input.typeahead('moveCursor', delta);
                            }
                            else {
                                lastCursor = cursor;
                            }
                        }
                    }
                );
            }
        },

        resetPrefetch: function () {
            this.refacet = null;
        },

        refacetPrefetch: function (filter) {
            if (filter.indexOf(' OR ') !== -1) { // don't recompute prefetch facet counts for an OR search
                this.refacet = null;
            }
            else { // recompute facets for an AND search or a search with only one facet
                this.refacet = filter;
            }
        },

        addFilters: function (filters) {
            for (var i = 0; i < filters.length; i++) {
                if (this.fq.indexOf(filters[i]) == -1) {
                    this.fq.unshift(filters[i]);
                }
            }
        },

        removeFilters: function (filters) {
            for (var i = 0; i < filters.length; i++) {
                var k = this.fq.indexOf(filters[i]);
                if (k !== -1) {
                    this.fq.splice(k, 1);
                }
            }
        },

        trackSelected: function (selected) { // array of ids: [12, 15, 19], or empty array []
            this.selected = selected;
        },

        setValue: function (val) {
            $(this.element).val(val);
        },

        onSuggest: function (fn) {
            var async = false;
            $(this.element).bind('typeahead:asyncrequest',
                function (ev) {
                    async = true;
                }
            ).bind('typeahead:asynccancel',
                function (ev) {
                    async = false;
                }
            ).bind('typeahead:render',
                function (ev) {
                    // first synchronous then asynchronous suggestions are returned
                    // synchronous suggestions are empty because our suggestions are all asynchronously fetched from solr
                    if (async) {
                        async = false;
                        fn(Array.prototype.slice.call(arguments, 1));
                    }
                }
            );
        }

    });

    // See https://github.com/jquery-boilerplate/jquery-boilerplate/wiki/Extending-jQuery-Boilerplate
    $.fn[pluginName] = function (options) {
        var args = arguments;

        if (options === undefined || typeof options === 'object') {
            return this.each(function () {
                if (!$.data(this, 'plugin_' + pluginName)) {
                    $.data(this, 'plugin_' + pluginName, new Plugin(this, options));
                }
            });
        } else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {
            var returns;

            this.each(function () {
                var instance = $.data(this, 'plugin_' + pluginName);
                if (instance instanceof Plugin && typeof instance[options] === 'function') {
                    returns = instance[options].apply(instance, Array.prototype.slice.call(args, 1));
                }
                if (options === 'destroy') {
                    $.data(this, 'plugin_' + pluginName, null);
                }
            });
            return returns !== undefined ? returns : this;
        }
    };

})(jQuery, window, document);