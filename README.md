# KMaps Typeahead

## Basic Invocation

This is a JQuery plugin which allows SHANTI's KMaps Solr index to be searched using Twitter's typeahead.js.
If you have the following input element:

```
<input type="text" class="form-control" id="typeahead">
```

Then invoke the plugin like so:

```
$('#typeahead').kmapsTypeahead({
    domain: "places", //or subjects
    root_kmap_id: 6403, //Tibetan and Himalayan Library
    max_terms: 20, //only retrieve this many matches
});
```

The "form-control" class is important for getting the Bootstrap styles correct.

The plugin takes the following core options:

 * `term_index`: The Solr index containing the KMaps subjects and places that you are searching. By default, `http://kidx.shanti.virginia.edu/solr/termindex-dev`
 * `domain`: By default `places`, otherwise `subjects`.
 * `root_kmapid`: If you wish to restrict your search to only retrieve terms under a certain node in the KMaps subjects or places tree, then specify the numeric id of that node.
    Exclude the domain prefix (so `6403`, not `subjects-6403`).
 * `autocomplete_field`: By default `name_autocomplete`, you shouldn't need to change this.
 * `min_chars`: The number of characters the user has to type before a search is launched.
 * `max_terms`: The number of terms to return per page of results, by default `150`. A high value for `max_terms` may negatively impact the performance of the plugin.
 * `fields`: To request additional document fields when querying Solr, add a comma separated list of fields here. By default, the following fields are returned:
   `id, header, ancestors, ancestor_id_path` and either `ancestor_ids_default` (for subjects) or `ancestor_ids_pol.admin.hier` (for places).
 * `filters`: This string will be added to all searches as a filter query. For example, `ancestor_ids_default:20` or `ancestor_ids_default:6403 AND -ancestor_ids_default:20`.
 * `selected`: By calling the plugin's `trackSelected` method, you can have the plugin keep track of which terms have already been selected. The default behavior of the plugin sets `selected` to `omit`,
    which hides already selected terms. Alternatively, you can set `selected` to `class`, which gives the CSS class `kmaps-tt-selected` to the already selected term.
 * `pager`: Set to `on` if you want autocomplete search results to be paged. This option has only been tested with the classificatory use of the plugin. Defaults to `off`. 

## Two Types of Widgets

The KMaps Typeahead plugin can used in two different ways.

### Selecting Terms for Use in Classification

In the first use of the plugin, you are selecting terms in order to classify objects. In this use, you can select any term that isn't excluded by the options described above.
Since many terms have the same name and can only be distinguished by their ancestry, it is valuable to display a term's ancestry. You can change the ancestor
separator by setting the following option on the plugin:

 * `ancestor_separator`: By default this is ` - `. Some people would change it to ` < `.

If you want results to be displayed on an empty search, then you can specify an empty query (in this case, obviously, autocomplete doesn't help):

 * `min_chars`: Set this to `0` so that suggestions are triggered on an empty search.
 * `empty_query`: By default, `level_i:2`, this will become Solr's `q` parameter.
 * `empty_limit`: By default `5`, this is the maximum number of terms that will be displayed on an empty query. This is passed to Solr as the `rows` parameter.
 * `empty_sort`: This can be used to sort the terms returned by an empty query. This is passed to Solr as the `sort` parameter.

The following simple invocation of the plugin shows how it can be used to display terms falling under the "Tibet and the Himalayas" subjects
sub-tree:

```javascript
$input.kmapsTypeahead({
    term_index: 'http://kidx.shanti.virginia.edu/solr/termindex-dev',
    domain: 'subjects',
    root_kmapid: 6403,
    max_terms: 20,
    selected: 'class'
});
```            

### Selecting Terms as Search Facets

In the second use of the plugin, you are selecting terms that are facets of other terms. For example, KMaps places can be classified by two types of subjects, "feature types" and
"associated subjects". This use of the plugin allows you to search the terms that can and do classify KMaps places.

When selecting facets, we take a different approach. First, we prefetch the facets that have actually been applied in a particular domain. In so doing, we obtain the term name and 
its facet count, but not its ancestry. Then, when a search is launched, we also pull in terms that *could have been* applied as facets. These are known as *zero facets*.
In a space where large numbers of facets are used in practice, it might not be necessary to display zero facets. However, we find it helpful to display unselectable zero facets
so that users get an idea of what terms are *available in principle* for application to a particular domain.

In this use of the plugin, the following options are important:

 * `prefetch_facets`: `off` by default, this needs to be set to `on`.
 * `prefetch_field`: By default this is `feature_types`. The only other option at present is `associated_subjects`. `_xfacet` is appended to this value and passed to Solr
    as the `facet_field` parameter.
 * `prefetch_filters`: An array of filters, by default `['tree:places', 'ancestor_id_path:13735']`. These filters are passed to Solr as `fq` parameters, and so they 
    limit the terms that will be searched for facets.
 * `prefetch_limit`: By default, `-1` for *no limit*, this can be overriden to restrict the number of facets that are prefetched. If a whole lot of facets have been applied
    to the terms you are searching, then it might be wise to set a limit to improve performance. However, try first using the default. This parameter is passed to Solr as 
    the `facet_limit` parameter.
 * `zero_facets`: This parameter is currently ignored. However, the plan is that it could be set to `skip` or `ignore`. The default, `skip`, would show zero count facets but not
    allow them to be selected. By contrast, `ignore` would allow for a mode where zero count facets are not displayed.
 * `ancestors`: Set this to `off`, since ancestry is not currently stored within `_xfacet` fields.
 * `min_chars`: Set this to `0`, so that default facets are displayed, sorted by descending count, on an empty search.
 * `max_defaults`: Set this to some value, by default `50`, to limit the number of facets that are displayed to the user on an empty search.

The following example invocation of the plugin shows how it can be used for feature type filtering of places:

```javascript
$input.kmapsTypeahead({
    term_index: 'http://kidx.shanti.virginia.edu/solr/termindex-dev',
    domain: 'subjects', // filter by subject
    filters: 'ancestor_ids_default:20', // restrict possible term space to feature types
    prefetch_facets: 'on', // use faceting mode
    prefetch_field: 'feature_types', // facet on field 'feature_types_xfacet'
    prefetch_filters: ['tree:places', 'ancestor_id_path:13735'], // search places for facets
    min_chars: 0, // display top facets on empty search
    max_terms: 100, // return a maximum of 100 zero facets per page
    ancestors: 'off', // _xfacet fields don't include ancestry
    selected: 'omit', // omit already selected facets from results
});
```
 
## Hiding the Dropdown Menu

Suppose you want to render the suggestions somewhere else other than the dropdown (for example, in a tree).
Then follow these steps:

1. Add a hidden wrapper to your markup:

   ```
   <div id="menu-wrapper" style="display:none;"></div>
   ```

2. Render the menu inside the wrapper by specifying the "menu" option:

   ```
   $("#typeahead").kmapsTypeahead({
      menu: $("#menu-wrapper"),
      domain: 'places',
      max_terms: 10
   })
   ```

3. Register a callback and do something with the suggestions:

   ```
   $('#typeahead').kmapsTypeahead('onSuggest',
      function(suggestions) {
         for (var i=0; i<suggestions.length; i++) {
            highlightSuggestionInTree(suggestions[i]);
         }
      }
   );
   ```

4. Update the value of the input element when it is selected in your UI:

   ```
   $('#typeahead').kmapsTypeahead('setValue', val);
   ```

For an example, see index.html in the html directory.