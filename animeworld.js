// Funzione di utility per il delay
function delay(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

// Configurazione globale
var BASE_URL = 'https://www.animeworld.so';
var MIN_DELAY = 2000;
var MAX_DELAY = 5000;
var DEBUG = true;

function log(message, data) {
    if (DEBUG) {
        console.log('[AnimeWorldScraper] ' + message);
        if (data) console.log(data);
    }
}

function fetchPage(url) {
    log('Fetching URL: ' + url);
    
    var headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };

    var waitTime = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;

    return delay(waitTime)
        .then(function() {
            return fetch(url, { 
                headers: headers,
                credentials: 'omit',
                referrerPolicy: 'no-referrer'
            });
        })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            return response.text();
        })
        .then(function(text) {
            if (!text || text.length === 0) {
                throw new Error('Empty response received');
            }
            return text;
        });
}

function searchAnime(keyword) {
    log('Searching for: ' + keyword);
    
    var searchUrl = BASE_URL + '/search?keyword=' + encodeURIComponent(keyword);
    
    return fetchPage(searchUrl)
        .then(function(html) {
            var results = [];
            
            // Estrai titoli
            var titleRegex = /<h3>\s*<a[^>]*class="name"[^>]*>([^<]+)<\/a>\s*<\/h3>/gi;
            var imageRegex = /<a[^>]*class="poster"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*>/gi;
            var linkRegex = /<a[^>]*class="poster"[^>]*href="([^"]+)"[^>]*>/gi;
            
            var titles = [];
            var images = [];
            var links = [];
            
            var match;
            
            // Estrai titoli
            while ((match = titleRegex.exec(html)) !== null) {
                titles.push(match[1].trim());
            }
            
            // Estrai immagini
            while ((match = imageRegex.exec(html)) !== null) {
                images.push(match[1]);
            }
            
            // Estrai links
            while ((match = linkRegex.exec(html)) !== null) {
                links.push(match[1]);
            }
            
            // Combina i risultati
            var minLength = Math.min(titles.length, images.length, links.length);
            for (var i = 0; i < minLength; i++) {
                results.push({
                    title: titles[i],
                    image: images[i],
                    href: BASE_URL + links[i]
                });
            }
            
            return results;
        });
}

function getAnimeDetails(url) {
    log('Getting details for: ' + url);
    
    return fetchPage(url)
        .then(function(html) {
            var descRegex = /<div[^>]*class="desc[^"]*"[^>]*>.*?<div[^>]*class="long[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
            var altTitleRegex = /<h2[^>]*class="title"[^>]*data-jtitle="([^"]*)"[^>]*>/i;
            var yearRegex = /<dt[^>]*>Data di Uscita:<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i;
            
            var description = '';
            var alternativeTitle = '';
            var releaseYear = '';
            
            var match;
            
            if ((match = descRegex.exec(html)) !== null) {
                description = match[1].trim().replace(/<[^>]*>/g, '');
            }
            
            if ((match = altTitleRegex.exec(html)) !== null) {
                alternativeTitle = match[1].trim();
            }
            
            if ((match = yearRegex.exec(html)) !== null) {
                releaseYear = match[1].trim();
            }
            
            return {
                description: description,
                alternativeTitle: alternativeTitle,
                releaseYear: releaseYear
            };
        });
}

function getEpisodesList(url) {
    log('Getting episodes list for: ' + url);
    
    return fetchPage(url)
        .then(function(html) {
            var episodes = [];
            var episodeRegex = /<li[^>]*class="episode"[^>]*>.*?<a[^>]*data-episode-num="(\d+)"[^>]*href="([^"]+)"[^>]*>/g;
            var match;
            
            while ((match = episodeRegex.exec(html)) !== null) {
                episodes.push({
                    number: parseInt(match[1]),
                    href: BASE_URL + match[2]
                });
            }
            
            return episodes;
        });
}

function getStreamUrl(episodeUrl) {
    log('Getting stream URL for: ' + episodeUrl);
    
    return fetchPage(episodeUrl)
        .then(function(html) {
            var iframeRegex = /<iframe[^>]*id="player-iframe"[^>]*src="([^"]+)"[^>]*>/i;
            var iframeMatch = iframeRegex.exec(html);
            
            if (!iframeMatch) {
                throw new Error('Iframe not found');
            }
            
            var iframeUrl = BASE_URL + iframeMatch[1];
            log('Found iframe URL: ' + iframeUrl);
            
            return fetchPage(iframeUrl);
        })
        .then(function(iframeHtml) {
            var streamRegex = /file:\s*['"](https:\/\/[^'"]+\.mp4)['"]/i;
            var streamMatch = streamRegex.exec(iframeHtml);
            
            if (!streamMatch) {
                throw new Error('Stream URL not found');
            }
            
            return streamMatch[1];
        });
}

// Funzioni esportate
function searchResults(keyword) {
    console.log('[General] Searching for: ' + keyword);
    return searchAnime(keyword)
        .then(function(results) {
            if (!results || !results.length) {
                console.log('[Warning] No results found');
                return '[]';
            }
            return JSON.stringify(results);
        })
        .catch(function(error) {
            console.error('[Error]', error);
            throw error;
        });
}

function extractDetails(url) {
    console.log('[General] Extracting details from: ' + url);
    return getAnimeDetails(url)
        .then(function(details) {
            if (!details) {
                console.log('[Warning] No details found');
                return '[{}]';
            }
            return JSON.stringify([details]);
        })
        .catch(function(error) {
            console.error('[Error]', error);
            throw error;
        });
}

function extractEpisodes(url) {
    console.log('[General] Extracting episodes from: ' + url);
    return getEpisodesList(url)
        .then(function(episodes) {
            if (!episodes || !episodes.length) {
                console.log('[Warning] No episodes found');
                return '[]';
            }
            return JSON.stringify(episodes);
        })
        .catch(function(error) {
            console.error('[Error]', error);
            throw error;
        });
}

function extractStreamUrl(url) {
    console.log('[General] Extracting stream URL from: ' + url);
    return getStreamUrl(url)
        .then(function(streamUrl) {
            if (!streamUrl) {
                console.log('[Warning] No stream URL found');
                return null;
            }
            return streamUrl;
        })
        .catch(function(error) {
            console.error('[Error]', error);
            throw error;
        });
}
