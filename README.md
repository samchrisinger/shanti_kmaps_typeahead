# KMaps Typeahead

## Basics

This is a JQuery plugin which allows SHANTI's KMaps Solr index to be searched using Twitter's typeahead.js.
If you have the following input element:

```
<input type="text" class="form-control" id="typeahead">
```

Then invoke the plugin as follows:

```
$('#typeahead').kmapsTypeahead({
    domain: "places", //or subjects
    root_kmap_id: 6403, //Tibetan and Himalayan Library
    max_terms: 20, //only retrieve this many matches
});
```

The "form-control" class is important for getting the Bootstrap styles correct.


## Hiding the dropdown

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
      max_terms: 10,
      fields: 'ancestor_id_path'
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