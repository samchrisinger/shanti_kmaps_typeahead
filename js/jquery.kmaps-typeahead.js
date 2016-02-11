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
            ancestor_separator: ' - ',
            max_terms: 999,
            min_chars: 1,
            empty_query: 'level_i:2', //ignored unless min_chars = 0
            empty_limit: 5,
            empty_sort: '',
            fields: '',
            fq: '',
            menu: '',
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
            var input = $(this.element);
            var settings = this.settings;
            var ancestor_field = (settings.domain == 'subjects') ? 'ancestor_ids_default' : 'ancestor_ids_pol.admin.hier';
            var filters = [];
            if (settings.fq) {
                filters.push(settings.fq);
            }
            if (settings.root_kmapid) {
                filters.push(ancestor_field + ':' + settings.root_kmapid);
            }
            var params = {
                'wt': 'json',
                'indent': true,
                'fq': filters.concat(['tree:' + settings.domain]),
                'fl': 'id,header,ancestors,' + ancestor_field + ',' + settings.fields,
                'hl': true,
                'hl.fl': settings.autocomplete_field,
                'hl.simple.pre': '',
                'hl.simple.post': ''
            };
            var url = settings.term_index + '/select?' + $.param(params, true);
            var terms = new Bloodhound({
                datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
                queryTokenizer: Bloodhound.tokenizers.whitespace,
                remote: {
                    url: url,
                    prepare: function (query, remote) { //http://stackoverflow.com/questions/18688891/typeahead-js-include-dynamic-variable-in-remote-url
                        var extras = {};
                        var val = input.val();
                        if (val) {
                            extras = {
                                'q': settings.autocomplete_field + ':' + encodeURIComponent(val.toLowerCase().replace(/[\s\u0f0b\u0f0d]+/g, '\\ ')),
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
                        return $.map(json.response.docs, function (doc) {
                            var highlighting = json.highlighting[doc.id];
                            var val = settings.autocomplete_field in highlighting ? highlighting[settings.autocomplete_field][0] : doc.header; //take first highlight if present
                            return {
                                doc: doc,
                                value: val,
                                anstring: settings.root_kmapid ?
                                    doc.ancestors.slice(doc[ancestor_field].indexOf(parseInt(settings.root_kmapid))).reverse().join(settings.ancestor_separator) :
                                    doc.ancestors.slice(0).reverse().join(settings.ancestor_separator)
                            };
                        });
                    }
                }
            });

            terms.initialize();
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
                    limit: 999,
                    display: 'value',
                    source: terms,
                    templates: {
                        suggestion: function (data) {
                            return '<div><span class="kmaps-term">' + data.value + '</span> ' +
                                '<span class="kmaps-ancestors">' + data.anstring + '</span></div>';
                        }
                    }
                }
            );
        },

        setValue: function (val) {
            $(this.element).val(val);
        },

        onSuggest: function (fn) {
            $(this.element).bind('typeahead:render',
                function (ev) {
                    fn(Array.prototype.slice.call(arguments, 1));
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