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
 * `pager`: Set to `on` if you want autocomplete search results to be paged. Defaults to `off`. 

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
    selected: 'class',
    pager: 'on'
});
```

By turning the `pager` option `on`, all matching terms are made available for selection. Each page shows only `max_terms` results, in this case 20. 

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

Note that the `pager` option is ignored by the faceting use of the plugin. We could make it work, but at this point not many terms have been applied as facets to other terms.
Therefore, it is easy enough to load all facets into memory, which reduces the need for paging.

## Methods

The plugin exposes several useful public methods.

* `trackSelected`: Call this method to enact the `selected` option described above. Pass an array of ids that have already been selected by the user, excluding
  the *subjects-* and *places-* prefixes.
  ```javascript
  $input.kmapsTypeahead('trackSelected', [104, 4112]);
  ```
  These ids will then either be omitted from the typeahead dropdown, or unselectable, depending on the value of the `selected` option. Note that you have to pass all 
  selected options at once; there is no facility to add or remove items. To reset, pass an empty array.

* `addFilters`: Use this method to filter a typeahead search. For example, suppose you start with an input element that will search all KMap Places. But wait: now you want to
  restrict your search to Geluk Monasteries. Then add the associated subject 'Geluk' (subjects-914) and the feature type 'Monastery' (subjects-104) as filters:
  ```javascript
  $input.kmapsTypeahead('addFilters', ['feature_type_ids:104', 'associated_subject_ids:914']);
  ```
  The filters will be added as `fq` parameters to the Solr query. To combine two queries on the same field into an 'AND' query, you can pass two filters, as illustrated above, 
  or combine them into a single query, like this one which filters on monasteries that are also nunneries (subjects-106).
  ```javascript
  $input.kmapsTypeahead('addFilters', ['feature_type_ids:(104 AND 106)']);
  ```
  'OR' queries work in the same way. To filter on monasteries or villages, use:
  ```javascript
  $input.kmapsTypeahead('addFilters', ['feature_type_ids:(104 OR 4112)']);
  ```
  
* `removeFilters`: Use this method to remove filters that have already been added. For example:
   ```javascript
   $input.kmapsTypeahead('removeFilters', ['feature_type_ids:104', 'associated_subject_ids:914']);
   ```

* `refacetPrefetch`: When using a KMaps Typeahead search widget for faceting, you select facets that are then used to further narrow a search. If you are
   searching KMaps Places, and you facet on the feature type 'Monastery', you will then want to know, what other facets do places that are monasteries have? This requires
   recomputing counts for facets that co-exist with 'Monastery'. Illustrating with an example, there are 2044 places that are monasteries, and 152 that are temples. But
   only 5 of the monasteries are temples. Call this method to recompute facet counts after a filter has been applied. You pass your filter to this method,
   which then adds it to the `prefetch_filters` in order to get new facet counts.
   ```javascript
   $input.kmapsTypeahead('refacetPrefetch', ['feature_type_ids:104']);
   ```
   To reset the faceting to its start state, pass an empty array:
   ```javascript
   $input.kmapsTypeahead('refacetPrefetch', []);
   ```
   Facets only need to be recomputed for 'AND' searches. Passing an 'OR' filter to this method has the same effect as passing an empty array. Note that this method 
   only applies to the faceting use of the plugin. 

* `refetchPrefetch`: When you are only using one filtering method, 'OR' counts never need to change; there will always be 2044 monasteries, so this count doesn't
   need to be recomputed. However, when the application of one filter affects the 'OR' counts of another, then you will need to recompute *all* facet counts for a filter.
   Let's say that you are filtering on both feature types and associated subjects. You add 'Monastery' as a feature type filter. At this point, you may no longer care about
   associated subjects that don't apply to monasteries. If that's right, then you need to recompute all associated subject facet counts in light of your feature type filter.
   To do so, call this method.
   ```javascript
   $input.kmapsTypeahead('refetchPrefetch', ['feature_type_ids:104'], function () {
      $input.kmapsTypeahead('setValue', $input.typeahead('val'), false);
   });
   ```
   In this scenario, you are refetching the facet counts for `$input`, because it is a filter that is *linked* to another filter which has had 'Monastery' added to it. 
   Because this method involves an asynchronous call to the server for new facet counts, it has a callback.

* `setValue`: When you have added filters to a search, or refaceted, or refetched, then you must make sure that a new search is launched when you click in the input text
   area, rather than an old search with old filters being used. To ensure that this happens, call this method:
   ```javascript
   $input.kmapsTypeahead('setValue', search_key, true);
   ```
   The first parameter is the search key, which says what the search should be. If you want the search to stay as it is, just pass
   `$input.typeahead('val')` as your search value. The second parameter is a boolean which specifies whether or not the input area should receive focus as a result of 
   the method call. Pass `true` if the user is already in the input area, and `false` otherwise.
   I've had difficulty getting typeahead.js to force a new search, so this method is a bit of a hack.

* `onSuggest`: Call this method to add a listener which will be passed suggestions as they come in. For example:
   ```javascript
   $input.kmapsTypeahead('onSuggest',
      function(suggestions) {
         for (var i=0; i<suggestions.length; i++) {
            highlightSuggestionInTree(suggestions[i]);
         }
      }
   );
   ```

For examples of all of these methods in action, see the Javascript in [SHANTI KMaps Fields](https://github.com/shanti-uva/drupal_shanti_kmaps_fields).

## Moving the Dropdown Menu

If you want the dropdown to appear somewhere other than its usual place, then use the `menu` option on the plugin:

   ```
   $("#typeahead").kmapsTypeahead({
      menu: $("#menu-wrapper"),
      domain: 'places',
      max_terms: 10
   })
   ```

Make sure you've put this id somewhere in your HTML:

   ```
   <div id="menu-wrapper"></div>
   ```
