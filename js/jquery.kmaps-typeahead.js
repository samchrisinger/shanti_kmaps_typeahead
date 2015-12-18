// See https://github.com/jquery-boilerplate/jquery-boilerplate/blob/master/dist/jquery.boilerplate.js
;
(function ($, window, document, undefined) {
    "use strict";

    var pluginName = "kmapsTypeahead",
        defaults = {
            term_index: "http://kidx.shanti.virginia.edu/solr/termindex-dev-update",
            domain: "subjects",
            autocomplete_field: 'name_autocomplete',
            max_terms: 999,
            ancestor_separator: ' - ',
            root_kmapid: '',
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
            var preq = '&q=' + settings.autocomplete_field + ':';
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
                'rows': settings.max_terms,
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
                    prepare: function (query, settings) { //http://stackoverflow.com/questions/18688891/typeahead-js-include-dynamic-variable-in-remote-url
                        var val = input.val();
                        if (val) {
                            settings.url += preq + encodeURIComponent(val.toLowerCase().replace(/[\s\u0f0b\u0f0d]+/g, '\\ '));
                        }
                        return settings;
                    },
                    filter: function (json) {
                        return $.map(json.response.docs, function (doc) {
                            return {
                                doc: doc,
                                value: json.highlighting[doc.id][settings.autocomplete_field][0], //take first highlight
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