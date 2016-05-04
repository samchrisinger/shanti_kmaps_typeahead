// See https://github.com/jquery-boilerplate/jquery-boilerplate/blob/master/dist/jquery.boilerplate.js
;
(function ($, window, document, undefined) {
    "use strict";

    var pluginName = "kmapsTypeahead",
        defaults = {
            term_index: 'http://kidx.shanti.virginia.edu/solr/termindex-dev',
            domain: 'places',
            root_kmapid: '',
            autocomplete_field: 'name_autocomplete',
            max_terms: 150,
            max_defaults: 50,
            min_chars: 1,
            selected: 'omit', // possible values: 'omit' or 'class'
            ancestors: 'on',
            ancestor_separator: ' - ',
            pager: 'off', // or 'on'
            prefetch_facets: 'off',
            prefetch_field: 'feature_types',
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
        this.refetch = [];
        this.refacet = [];
        this.selected = [];
        this.kmaps_engine = null; // Bloodhound instance
        this.facet_counts = null; // Bloodhound instance
        this.fake = null; // fake query for setValue
        this.start = 0; // for paging
        this.$menu = null; // dropdown menu
        this.init();
    }

    $.extend(Plugin.prototype, {
        init: function () {
            var plugin = this;
            var input = $(plugin.element);
            var settings = plugin.settings;

            var use_ancestry = (settings.ancestors == 'on');
            var result_paging = (settings.pager == 'on');
            var prefetch_facets = (settings.prefetch_facets == 'on');
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
                plugin.fq.push('ancestor_id_path:*'); // force this field to be present
                fl.push('ancestors', 'ancestor_id_path', ancestor_field);
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
                    cache: false,
                    prepare: function (query, remote) { //http://stackoverflow.com/questions/18688891/typeahead-js-include-dynamic-variable-in-remote-url
                        var extras = {};
                        var val = input.val();
                        if (val) {
                            extras = {
                                'q': settings.autocomplete_field + ':' + val.toLowerCase().replace(/[\s\u0f0b\u0f0d]+/g, '\\ '),
                                'rows': settings.max_terms,
                                'start': plugin.start,
                                'fq': plugin.fq
                            };
                        }
                        else {
                            if (!prefetch_facets) { // prefetch_facets shouldn't get here anyway
                                extras = {
                                    'q': settings.empty_query,
                                    'rows': settings.empty_limit,
                                    'sort': settings.empty_sort,
                                    'start': plugin.start,
                                    'fq': plugin.fq
                                };
                            }
                        }
                        if (query !== plugin.fake) {
                            plugin.start = 0;
                        }
                        remote.url += '&' + $.param(extras, true);
                        return remote;
                    },
                    filter: function (json) {
                        var filtered = $.map(json.response.docs, function (doc, index) {
                            var highlighting = json.highlighting[doc.id];
                            var val = settings.autocomplete_field in highlighting ? highlighting[settings.autocomplete_field][0] : doc.header; //take first highlight if present
                            var item = {
                                id: doc.id.substring(doc.id.indexOf('-') + 1),
                                doc: doc,
                                value: val,
                                index: json.response.start + index,
                                numFound: json.response.numFound,
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
                            return (plugin.kmaps_engine.get([term.id]).length == 0);
                        });
                        /*if (use_ancestry) {
                            filtered.sort(function (a, b) { // sort results by ancestry
                                return a.doc.ancestor_id_path > b.doc.ancestor_id_path;
                            });
                        }*/
                        return filtered;
                    }
                }
            };
            var prefetch_field = settings.prefetch_field + '_xfacet';
            var sortFacetsDescending = function (a, b) {
                return b.count - a.count;
            };
            if (prefetch_facets) {
                var prefetch_params = {
                    'wt': 'json',
                    'indent': true,
                    'fl': '*',
                    'q': '*:*',
                    'rows': 0,
                    'facet': true,
                    'facet.field': prefetch_field,
                    'facet.limit': settings.prefetch_limit,
                    'facet.sort': 'count',
                    'facet.mincount': 1
                };
                $.extend(options, {
                    sorter: sortFacetsDescending,
                    prefetch: {
                        url: settings.term_index + '/select?' + $.param(prefetch_params, true),
                        cache: false, // change to true??
                        prepare: function (prefetch) {
                            var extras = {
                                'fq': settings.prefetch_filters.concat(plugin.refetch)
                            };
                            prefetch.url += '&' + $.param(extras, true);
                            return prefetch;
                        },
                        filter: function (json) {
                            var raw = json.facet_counts.facet_fields[prefetch_field];
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
                var refacet_field = settings.prefetch_field + '_autocomplete';
                var refacet_params = $.extend({}, prefetch_params);
                delete refacet_params['facet.field'];
                plugin.facet_counts = new Bloodhound({
                    datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
                    queryTokenizer: Bloodhound.tokenizers.whitespace,
                    sufficient: settings.max_terms,
                    identify: function (term) {
                        return term.id;
                    },
                    remote: {
                        url: settings.term_index + '/select?' + $.param(refacet_params, true),
                        cache: false, // change to true??
                        prepare: function (query, remote) {
                            if (plugin.refacet.length > 0) { // no refaceting for an OR search
                                var extras = {};
                                var val = input.val();
                                if (val) {
                                    extras = {
                                        'fq': plugin.refacet.concat(plugin.refetch),
                                        'facet.field': refacet_field,
                                        'facet.prefix': val.toLowerCase().replace(/[\s\u0f0b\u0f0d]+/g, '\\ ')
                                    };
                                }
                                else {
                                    extras = {
                                        'fq': plugin.refacet.concat(plugin.refetch),
                                        'facet.field': prefetch_field
                                    };
                                }
                                remote.url += '&' + $.param(extras, true);
                            }
                            else { // don't go to the server at all
                                remote.url = null;
                            }
                            return remote;
                        },
                        filter: function (json) {
                            var raw = json.facet_counts.facet_fields[prefetch_field] ? json.facet_counts.facet_fields[prefetch_field] : json.facet_counts.facet_fields[refacet_field];
                            var facets = [];
                            for (var i = 0; i < raw.length; i += 2) {
                                var mixed = raw[i].substring(raw[i].indexOf('|') + 1);
                                var spl = mixed.indexOf(':');
                                facets.push({
                                    id: mixed.substring(0, spl),
                                    value: mixed.substring(spl + 1).replace(/_/g, ' '),
                                    count: parseInt(raw[i + 1]),
                                    refacet: true
                                });
                            }
                            return facets;
                        }
                    }
                });
            }
            plugin.kmaps_engine = new Bloodhound(options);

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
                        selectable: 'kmaps-tt-selectable',
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
                    var results;
                    if (data.query) {
                        results = 'Results for "<span class="kmaps-tt-query">' + data.query + '</span>"';
                    }
                    else {
                        results = 'All results';
                    }
                    var pager = '';
                    if (result_paging) {
                        var pagesize = Number(plugin.settings.max_terms);
                        var start = data.suggestions[0].index;
                        var numFound = data.suggestions[0].numFound;
                        var current = Math.floor(start/pagesize) + 1;
                        var pagecount = Math.ceil(numFound/pagesize);
                        pager = '<ul class="typeahead-pager pager">';
                        if (current > 1) { // link to first and previous pages
                            pager += '<li class="pager-first active first"><a data-goto-page="1" title="Go to first page"><span class="icon"></span></a></li>';
                            pager += '<li class="pager-previous active"><a data-goto-page="' + (current-1) + '" title="Go to previous page"><span class="icon"></span></a></li>';
                        }
                        else {
                            pager += '<li class="pager-first first"><span class="icon"></span></li>';
                            pager += '<li class="pager-previous"><span class="icon"></span></li>';
                        }
                        pager += '<li class="pager-item">Page ' + current + ' of ' + pagecount + '</li>';
                        if (current < pagecount) { // link to next and last pages
                            pager += '<li class="pager-next active"><a data-goto-page="' + (current+1) + '" title="Go to next page"><span class="icon"></span></a></li>';
                            pager += '<li class="pager-last active last"><a data-goto-page="' + pagecount + '" title="Go to last page"><span class="icon"></span></a></li>';
                        }
                        else {
                            pager += '<li class="pager-next"><span class="icon"></span></li>';
                            pager += '<li class="pager-last last"><span class="icon"></span></li>';
                        }
                        pager += '</ul>';
                    }
                    return '<div class="kmaps-tt-header kmaps-tt-results"><button class="close" aria-hidden="true" type="button">×</button>' + results + pager + '</div>';
                },
                notFound: function (data) {
                    var msg = 'No results for <span class="kmaps-tt-query">' + data.query + '</span>. ' + settings.no_results_msg;
                    return '<div class="kmaps-tt-message kmaps-tt-no-results">' + msg + '</div>';
                },
                suggestion: function (data) {
                    var cl = [];
                    if (data.selected) cl.push('kmaps-tt-selected');
                    return '<div class="' + cl.join(' ') + '"><span class="kmaps-term">' + data.value + '</span>' +
                        (use_ancestry ? ' <span class="kmaps-ancestors">' + data.anstring + '</span>' : '') + '</div>';
                }
            });
            var prefetch_templates = $.extend({}, default_templates, {
                header: function (data) {
                    var msg;
                    if (plugin.selected.length == 0) {
                        if (data.query == '') {
                            if (settings.max_defaults > data.suggestions.length) {
                                msg = data.suggestions.length + ' Filters';
                            }
                            else {
                                msg = 'Top ' + settings.max_defaults + ' Filters';
                            }
                        }
                        else {
                            msg = 'Add Filter';
                        }
                    }
                    else {
                        msg = 'Filter terms with <span class="kmaps-filter-method">\'OR\'</span>';
                    }
                    return '<div class="kmaps-tt-header kmaps-tt-results"><button class="close" aria-hidden="true" type="button">×</button>' + msg + '</div>';
                },
                notFound: function (data) {
                    var msg;
                    if (data.query) {
                        msg = 'No filters with <em>' + data.query + '</em>. ' + settings.no_results_msg;
                    }
                    else {
                        msg = 'No filter matches any results. ' + settings.no_results_msg;
                    }
                    return '<div class="kmaps-tt-message"><span class="no-results">' + msg + '</span></div>';
                },
                suggestion: function (data) {
                    var cl = [];
                    if (data.selected) cl.push('kmaps-tt-selected');
                    if (data.count == 0) cl.push('kmaps-tt-zero-facet');
                    return '<div class="' + cl.join(' ') + '"><span class="kmaps-term">' + data.value + '</span> ' +
                        '<span class="kmaps-count">(' + data.count + ')</span>' +
                        (use_ancestry ? ' <span class="kmaps-ancestors">' + data.anstring + '</span>' : '') + '</div>';
                }
            });

            var filterSelected = function (suggestions) {
                if (plugin.selected.length == 0) {
                    return $.map(suggestions, function (sugg) {
                        sugg.selected = false;
                        return sugg;
                    });
                }
                else if (plugin.settings.selected == 'omit') {
                    return $.grep(suggestions, function (sugg) {
                        return $.inArray(sugg.id, plugin.selected) === -1;
                    });
                }
                else {
                    return $.map(suggestions, function (sugg) {
                        sugg.selected = $.inArray(sugg.id, plugin.selected) !== -1;
                        return sugg;
                    });
                }
            };
            if (prefetch_facets) {
                input.typeahead(typeaheadOptions,
                    {
                        name: 'facet_counts',
                        limit: parseInt(settings.max_terms) * 2, // apparently needs to be doubled to accommodate both prefetched and remote terms
                        display: 'value',
                        source: function (q, sync, async) {
                            plugin.facet_counts.search(q, sync, function (suggestions) {
                                async(filterSelected(suggestions));
                            });
                        },
                        templates: {
                            header: function (data) {
                                var msg = 'Filter terms with <span class="kmaps-filter-method">\'AND\'</span>';
                                return '<div class="kmaps-tt-header kmaps-tt-results"><button class="close" aria-hidden="true" type="button">×</button>' + msg + '</div>';
                            },
                            suggestion: function (data) {
                                var cl = [];
                                if (data.selected) cl.push('kmaps-tt-selected');
                                cl.push('selectable-facet');
                                return '<div class="' + cl.join(' ') + '"><span class="kmaps-term">' + data.value + '</span> ' +
                                    '<span class="kmaps-count">(' + data.count + ')</span>' +
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
                                var facets = plugin.kmaps_engine.all();
                                if (facets.length > 0 && settings.max_defaults > 0) {
                                    sync(filterSelected(facets.sort(sortFacetsDescending).slice(0, Math.min(facets.length, settings.max_defaults))));
                                }
                                else {
                                    plugin.kmaps_engine.search(q, function (suggestions) {
                                        sync(filterSelected(suggestions))
                                    }, function (suggestions) {
                                        async(filterSelected(suggestions));
                                    });
                                }
                            }
                            else {
                                plugin.kmaps_engine.search(q, function (suggestions) {
                                    sync(filterSelected(suggestions))
                                }, function (suggestions) {
                                    async(filterSelected(suggestions));
                                });
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
                            plugin.kmaps_engine.search(q, sync, function (suggestions) {
                                async(filterSelected(suggestions));
                            });
                        }
                    }
                );
            }
            input.bind('typeahead:render',
                function () {
                    plugin.getMenu().find('.kmaps-tt-selected, .kmaps-tt-zero-facet').removeClass('kmaps-tt-selectable');
                }
            ).bind('typeahead:beforeclose',
                function (e) {
                    if ($(e.target).is(':focus')) { // keep menu open if input element is still focused
                        return false;
                    }
                }
            );
            var hideOnClick = false;
            if (!settings.menu) { // ignore if dropdown has been moved, as with tree
                input.on('mousedown',
                    function (e) {
                        if (!plugin.getMenu().is(':hidden')) {
                            hideOnClick = true;
                        }
                        else {
                            hideOnClick = false;
                        }
                    }
                ).on('click',
                    function (e) {
                        if (hideOnClick) {
                            input.blur();
                        }
                    }
                );
            }
        },

        refetchPrefetch: function (filters, callback) {
            this.refetch = filters || [];
            // https://github.com/twitter/typeahead.js/pull/703
            this.kmaps_engine.clear();
            this.kmaps_engine.clearPrefetchCache();
            var promise = this.kmaps_engine.initialize(true);
            promise.done(callback);
        },

        refacetPrefetch: function (filters) {
            if (filters.length == 0 || filters[0].indexOf(' OR ') !== -1) { // don't recompute prefetch facet counts for an OR search
                this.refacet = [];
            }
            else { // recompute facets for an AND search or a search with only one facet
                this.refacet = filters;
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

        setValue: function (val, focus, start) {
            var $el = $(this.element);
            if (this.settings.min_chars > 0 && val == '') {
                $el.typeahead('val', val);
            }
            else {
                // see http://stackoverflow.com/questions/15115059/programmatically-triggering-typeahead-js-result-display
                this.start = start || 0;
                this.fake = (val == 'x') ? 'y' : 'x';
                $el.typeahead('val', this.fake); // temporarily set to something different
                if (focus) {
                    $el.focus().typeahead('val', val).focus(); // trigger new suggestions and acquire focus
                }
                else {
                    $el.typeahead('val', val); // trigger suggestions without focus
                }
            }
        },

        getMenu: function () {
            var plugin = this;
            if (plugin.$menu == null) {
                var $input = $(plugin.element);
                if (!plugin.settings.menu) {
                    plugin.$menu = $input.parent().find('.kmaps-tt-menu');
                }
                else {
                    plugin.$menu = $(plugin.settings.menu);
                }
                plugin.$menu.on('click', 'button.close',
                    function() {
                        $input.blur();
                    }
                ).on('click', '.active a',
                    function() {
                        var page = $(this).attr('data-goto-page');
                        var start = (page-1) * plugin.settings.max_terms;
                        plugin.setValue($input.typeahead('val'), true, start);
                    }
                );
            }
            return this.$menu;
        },
        
        getStart: function() {
            return plugin.start;
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