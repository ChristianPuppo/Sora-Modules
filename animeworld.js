// Utility per gestire i rate limits e le protezioni anti-bot
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class AnimeWorldScraper {
    constructor() {
        this.baseUrl = 'https://www.animeworld.so';
        this.minDelay = 2000;
        this.maxDelay = 5000;
        this.debug = true;
    }

    log(message, data = null) {
        if (this.debug) {
            console.log(`[AnimeWorldScraper] ${message}`);
            if (data) console.log(data);
        }
    }

    async fetch(url, options = {}) {
        this.log(`Fetching URL: ${url}`);
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...options.headers
        };

        try {
            const waitTime = Math.floor(Math.random() * (this.maxDelay - this.minDelay + 1)) + this.minDelay;
            this.log(`Waiting ${waitTime}ms before request`);
            await delay(waitTime);

            const response = await fetch(url, { 
                ...options, 
                headers,
                credentials: 'omit',
                referrerPolicy: 'no-referrer'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            if (!text || text.length === 0) {
                throw new Error('Empty response received');
            }

            this.log(`Successfully fetched ${url}`);
            return text;
        } catch (error) {
            this.log(`Fetch error for ${url}:`, error);
            throw error;
        }
    }

    async searchAnime(keyword) {
        this.log(`Searching for: ${keyword}`);
        
        try {
            const searchUrl = `${this.baseUrl}/search?keyword=${encodeURIComponent(keyword)}`;
            const html = await this.fetch(searchUrl);

            const results = [];
            let processedItems = 0;

            const titleRegex = /<h3>\s*<a[^>]*class="name"[^>]*>([^<]+)<\/a>\s*<\/h3>/gi;
            const imageRegex = /<a[^>]*class="poster"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*>/gi;
            const linkRegex = /<a[^>]*class="poster"[^>]*href="([^"]+)"[^>]*>/gi;

            const titles = [...html.matchAll(titleRegex)].map(m => m[1].trim());
            const images = [...html.matchAll(imageRegex)].map(m => m[1]);
            const links = [...html.matchAll(linkRegex)].map(m => m[1]);

            this.log(`Found ${titles.length} titles, ${images.length} images, ${links.length} links`);

            const minLength = Math.min(titles.length, images.length, links.length);
            
            for (let i = 0; i < minLength; i++) {
                results.push({
                    title: titles[i],
                    image: images[i],
                    href: this.baseUrl + links[i]
                });
                processedItems++;
            }

            this.log(`Successfully processed ${processedItems} items`);
            return results;
        } catch (error) {
            this.log('Search error:', error);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    async getAnimeDetails(url) {
        this.log(`Getting details for: ${url}`);
        
        try {
            const html = await this.fetch(url);

            const descRegex = /<div[^>]*class="desc[^"]*"[^>]*>.*?<div[^>]*class="long[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
            const altTitleRegex = /<h2[^>]*class="title"[^>]*data-jtitle="([^"]*)"[^>]*>/i;
            const yearRegex = /<dt[^>]*>Data di Uscita:<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i;

            const description = (descRegex.exec(html)?.[1] || '').trim();
            const alternativeTitle = (altTitleRegex.exec(html)?.[1] || '').trim();
            const releaseYear = (yearRegex.exec(html)?.[1] || '').trim();

            const details = {
                description: description.replace(/<[^>]*>/g, ''),
                alternativeTitle,
                releaseYear
            };

            this.log('Successfully extracted details:', details);
            return details;
        } catch (error) {
            this.log('Details extraction error:', error);
            throw new Error(`Details extraction failed: ${error.message}`);
        }
    }

    async getEpisodesList(url) {
        this.log(`Getting episodes list for: ${url}`);
        
        try {
            const html = await this.fetch(url);

            const episodes = [];
            const episodeRegex = /<li[^>]*class="episode"[^>]*>.*?<a[^>]*data-episode-num="(\d+)"[^>]*href="([^"]+)"[^>]*>/g;

            let match;
            while ((match = episodeRegex.exec(html)) !== null) {
                episodes.push({
                    number: parseInt(match[1]),
                    href: this.baseUrl + match[2]
                });
            }

            this.log(`Found ${episodes.length} episodes`);
            return episodes;
        } catch (error) {
            this.log('Episodes list error:', error);
            throw new Error(`Episodes list extraction failed: ${error.message}`);
        }
    }

    async getStreamUrl(episodeUrl) {
        this.log(`Getting stream URL for: ${episodeUrl}`);
        
        try {
            const html = await this.fetch(episodeUrl);

            const iframeRegex = /<iframe[^>]*id="player-iframe"[^>]*src="([^"]+)"[^>]*>/i;
            const iframeMatch = iframeRegex.exec(html);
            
            if (!iframeMatch) {
                throw new Error('Iframe not found');
            }
            
            const iframeUrl = this.baseUrl + iframeMatch[1];
            this.log(`Found iframe URL: ${iframeUrl}`);

            const iframeHtml = await this.fetch(iframeUrl);

            const streamRegex = /file:\s*['"](https:\/\/[^'"]+\.mp4)['"]/i;
            const streamMatch = streamRegex.exec(iframeHtml);

            if (!streamMatch) {
                throw new Error('Stream URL not found');
            }

            const streamUrl = streamMatch[1];
            this.log(`Found stream URL: ${streamUrl}`);
            return streamUrl;
        } catch (error) {
            this.log('Stream URL extraction error:', error);
            throw new Error(`Stream URL extraction failed: ${error.message}`);
        }
    }
}

// Funzioni wrapper in formato CommonJS
const scraper = new AnimeWorldScraper();

async function searchResults(keyword) {
    console.log(`[General] Searching for: ${keyword}`);
    try {
        const results = await scraper.searchAnime(keyword);
        if (!results || results.length === 0) {
            console.log('[Warning] No results found');
            return JSON.stringify([]);
        }
        return JSON.stringify(results);
    } catch (error) {
        console.error('[Error]', error);
        throw error;
    }
}

async function extractDetails(url) {
    console.log(`[General] Extracting details from: ${url}`);
    try {
        const details = await scraper.getAnimeDetails(url);
        if (!details) {
            console.log('[Warning] No details found');
            return JSON.stringify([{}]);
        }
        return JSON.stringify([details]);
    } catch (error) {
        console.error('[Error]', error);
        throw error;
    }
}

async function extractEpisodes(url) {
    console.log(`[General] Extracting episodes from: ${url}`);
    try {
        const episodes = await scraper.getEpisodesList(url);
        if (!episodes || episodes.length === 0) {
            console.log('[Warning] No episodes found');
            return JSON.stringify([]);
        }
        return JSON.stringify(episodes);
    } catch (error) {
        console.error('[Error]', error);
        throw error;
    }
}

async function extractStreamUrl(url) {
    console.log(`[General] Extracting stream URL from: ${url}`);
    try {
        const streamUrl = await scraper.getStreamUrl(url);
        if (!streamUrl) {
            console.log('[Warning] No stream URL found');
            return null;
        }
        return streamUrl;
    } catch (error) {
        console.error('[Error]', error);
        throw error;
    }
}

// Esporta le funzioni in formato CommonJS
module.exports = {
    searchResults,
    extractDetails,
    extractEpisodes,
    extractStreamUrl
};
