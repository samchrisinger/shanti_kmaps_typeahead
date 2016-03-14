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
            min_chars: 1,
            ancestors: 'on',
            ancestor_separator: ' - ',
            prefetch_facets: 'off',
            prefetch_field: 'feature_types_autocomplete',
            prefetch_filters: ['tree:places', 'ancestor_id_path:13735'],
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
        this._defaults = defaults;
        this._name = pluginName;
        this.init();
    }

    $.extend(Plugin.prototype, {
        init: function () {
            var kmaps_engine; //Bloodhound instance
            var input = $(this.element);
            var settings = this.settings;

            var use_ancestry = (settings.ancestors == 'on');
            var prefetch_facets = (settings.prefetch_facets == 'on');
            var ancestor_field = (settings.domain == 'subjects') ? 'ancestor_ids_default' : 'ancestor_ids_pol.admin.hier';

            var fq = [];
            if (settings.filters) {
                fq.push(settings.filters);
            }
            if (settings.root_kmapid) {
                fq.push(ancestor_field + ':' + settings.root_kmapid);
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
                'fq': fq.concat(['tree:' + settings.domain]),
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
                                'rows': settings.max_terms
                            };
                        }
                        else {
                            extras = {
                                'q': settings.empty_query,
                                'rows': settings.empty_limit,
                                'sort': settings.empty_sort
                            };
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
            if (prefetch_facets) {
                var hasAlready = function (arr, id) {
                    return arr.some(function (el) {
                        return el.id == id;
                    });
                };
                var prefetch_params = {
                    'wt': 'json',
                    'indent': true,
                    'fq': settings.prefetch_filters,
                    'fl': '*',
                    'q': '*:*',
                    'rows': 0,
                    'facet': true,
                    'facet.field': settings.prefetch_field,
                    'facet.sort': 'count',
                    'facet.limit': -1,
                    'facet.mincount': 1
                };
                $.extend(options, {
                    prefetch: {
                        url: settings.term_index + '/select?' + $.param(prefetch_params, true),
                        cache: false,
                        filter: function (json) {
                            var raw = json.facet_counts.facet_fields[settings.prefetch_field];
                            var facets = [];
                            for (var i = 0; i < raw.length; i += 2) {
                                var val = raw[i].substring(raw[i].indexOf('|') + 1).split(":");
                                if (!hasAlready(facets, val[0])) {
                                    facets.push({
                                        id: val[0],
                                        value: val[1].replace(/_/g, ' '),
                                        count: parseInt(raw[i + 1])
                                    });
                                }
                            }
                            return facets;
                        }
                    }
                });
            }
            kmaps_engine = new Bloodhound(options);
            kmaps_engine.initialize();
            input.typeahead(
                $.extend(
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
                ),
                {
                    name: settings.domain,
                    limit: parseInt(settings.max_terms) * 2, // apparently needs to be doubled to accommodate both prefetched and remote terms
                    display: 'value',
                    source: kmaps_engine,
                    templates: {
                        pending: function () {
                            return '<div class="kmaps-tt-message"><span class="searching">Searching ...</span></div>'
                        },
                        header: function (data) {
                            var msg = prefetch_facets ? // mixing sync and async screws up count
                                'Showing results for <em>' + data.query + '</em>' :
                                'Showing ' + data.suggestions.length + ' result' + (data.suggestions.length == 1 ? '' : 's') + ' for <em>' + data.query + '</em>.';
                            return '<div class="kmaps-tt-message"><span class="results">' + msg + '</em></span></div>';
                        },
                        notFound: function (data) {
                            var msg = 'No results for <em>' + data.query + '</em>. ' + settings.no_results_msg;
                            return '<div class="kmaps-tt-message"><span class="no-results">' + msg + '</span></div>';
                        },
                        suggestion: function (data) {
                            return '<div><span class="kmaps-term">' + data.value + '</span>' +
                                (prefetch_facets ? ' <span class="kmaps-count">(' + data.count + ')</span>' : '') +
                                (use_ancestry ? ' <span class="kmaps-ancestors">' + data.anstring + '</span>' : '') + '</div>';
                        }
                    }
                }
            );
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