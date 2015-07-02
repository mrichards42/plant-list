(function() {
function loader(createElement) {
    var promises = {};

    return function(url, data) {
        if (! url || typeof promises[url] === 'undefined') {
            var promise = new PouchDB.utils.Promise(function (resolve, reject) {
                console.log('loading', url, data);
                var element = createElement(url, data);
                element.onload = element.onreadystatechange = resolve;
                element.onerror = reject;
                if (! url)
                    resolve();
            });
            if (url)
                promises[url] = promise;
            else
                return promise;
        }
        return promises[url];
    };
}

/**
 * Dynamically loads the given script
 * @param [src] The url of the script to load dynamically
 * @param [text] The text data of the script to load dynamically
 * @returns {*} Promise that will be resolved once the script has been loaded.
 */
window.loadScript = loader(function (src, text) {
    var script = document.createElement('script');

    if (src)
        script.src = src;
    else if (text)
        script.innerHTML = text;

    document.body.appendChild(script);
    return script;
});

/**
 * Dynamically loads the given CSS file
 * @param [href] The url of the CSS to load dynamically
 * @param [text] The text data of the CSS to load dynamically
 * @returns {*} Promise that will be resolved once the CSS file has been loaded.
 */
window.loadCSS = loader(function (href, text) {
    var style;
    if (href) {
        style = document.createElement('link');

        style.rel = 'stylesheet';
        style.type = 'text/css';
        style.href = href;
    }
    else {
        style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = text;
    }

    document.head.appendChild(style);
    return style;
});
})();