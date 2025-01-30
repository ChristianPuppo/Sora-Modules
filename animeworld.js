const puppeteer = require('puppeteer');

async function searchResults(keyword) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Apri la pagina di ricerca
    const searchUrl = `https://www.animeworld.so/search?keyword=${encodeURIComponent(keyword)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    // Estrai risultati
    const results = await page.evaluate(() => {
        return [...document.querySelectorAll('.list .item')].map(el => ({
            title: el.querySelector('.name').textContent.trim(),
            image: el.querySelector('.poster').getAttribute('data-tip'),  // L'immagine è un tooltip
            href: `https://www.animeworld.so${el.querySelector('.poster').getAttribute('href')}`
        }));
    });

    await browser.close();
    return results;
}

async function extractDetails(animeUrl) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(animeUrl, { waitUntil: 'domcontentloaded' });

    // Estrai dettagli
    const details = await page.evaluate(() => {
        return {
            description: document.querySelector('.desc .long')?.textContent.trim() || 'N/A',
            aliases: document.querySelector('.title').getAttribute('data-jtitle'),
            airdate: document.querySelector('dt:contains("Data di Uscita") + dd')?.textContent.trim() || 'Unknown'
        };
    });

    await browser.close();
    return details;
}

async function extractEpisodes(animeUrl) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(animeUrl, { waitUntil: 'domcontentloaded' });

    // Estrai episodi
    const episodes = await page.evaluate(() => {
        return [...document.querySelectorAll('.episodes li a')].map(el => ({
            number: el.getAttribute('data-episode-num'),
            href: `https://www.animeworld.so${el.getAttribute('href')}`
        }));
    });

    await browser.close();
    return episodes;
}

async function extractStreamUrl(episodeUrl) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(episodeUrl, { waitUntil: 'domcontentloaded' });

    // Aspetta che il video venga caricato
    await page.waitForSelector('#player-iframe');

    // Prendi l'URL dell'iframe
    const iframeSrc = await page.evaluate(() => document.querySelector('#player-iframe')?.getAttribute('src') || null);

    if (!iframeSrc) {
        await browser.close();
        return null;
    }

    // Apri il video player
    const framePage = await browser.newPage();
    await framePage.goto(`https://www.animeworld.so${iframeSrc}`, { waitUntil: 'domcontentloaded' });

    // Trova l'URL MP4
    const streamUrl = await framePage.evaluate(() => {
        return document.querySelector('video source')?.getAttribute('src') || null;
    });

    await browser.close();
    return streamUrl;
}

// **TEST DELLO SCRAPER** (Puoi modificarlo con un titolo di anime a scelta)
(async () => {
    const searchResultsData = await searchResults("Solo Leveling");
    console.log("🔍 Risultati ricerca:", searchResultsData);

    if (searchResultsData.length > 0) {
        const detailsData = await extractDetails(searchResultsData[0].href);
        console.log("📌 Dettagli Anime:", detailsData);

        const episodesData = await extractEpisodes(searchResultsData[0].href);
        console.log("🎥 Lista Episodi:", episodesData);

        if (episodesData.length > 0) {
            const streamUrl = await extractStreamUrl(episodesData[0].href);
            console.log("📺 Link Streaming:", streamUrl);
        }
    }
})();
