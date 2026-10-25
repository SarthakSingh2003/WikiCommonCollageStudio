export async function searchWikimediaCommons(query, offset = 0) {
  if (!query || query.trim() === '') {
    return { results: [], nextOffset: null };
  }

  const cleanQuery = query.trim();
  const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
    cleanQuery
  )}&gsrlimit=24&gsroffset=${offset}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=800`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Wikimedia API error: HTTP ${res.status}`);
    const data = await res.json();

    if (!data.query || !data.query.pages) {
      return { results: [], nextOffset: null };
    }

    const nextOffset = data.continue && data.continue.gsroffset ? data.continue.gsroffset : null;
    const pages = Object.values(data.query.pages);
    const results = [];

    for (const page of pages) {
      if (!page.imageinfo || !page.imageinfo[0]) continue;
      const info = page.imageinfo[0];
      const meta = info.extmetadata || {};

      const fullUrl = info.url || '';
      if (fullUrl.match(/\.(ogg|oga|ogv|mid|midi|wav|mp3|mp4|webm|pdf|djvu)$/i)) continue;

      const rawTitle = (page.title || '').replace(/^File:/i, '').replace(/_/g, ' ');
      const artist = meta.Artist ? meta.Artist.value.replace(/<[^>]+>/g, '').trim() : 'Wikimedia Commons Contributor';
      const license = meta.LicenseShortName ? meta.LicenseShortName.value : (meta.License ? meta.License.value : 'Creative Commons');
      const date = meta.DateTimeOriginal ? meta.DateTimeOriginal.value : (meta.DateTime ? meta.DateTime.value : '');
      const description = meta.ImageDescription ? meta.ImageDescription.value.replace(/<[^>]+>/g, '').trim() : rawTitle;
      const imageUrl = info.thumburl || info.url;

      results.push({
        id: `wiki-${page.pageid || Math.random().toString(36).substr(2, 9)}`,
        title: rawTitle || 'Wikimedia Commons Image',
        author: artist,
        license: license,
        date: date,
        sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        imageUrl: imageUrl,
        thumbUrl: imageUrl,
        fullUrl: info.url,
        width: info.width || 800,
        height: info.height || 600,
        description: description
      });
    }

    return { results, nextOffset };
  } catch (err) {
    console.warn('Live Wikimedia Commons fetch failed or blocked; falling back to curated collections', err);
    return { results: [], nextOffset: null, error: err.message };
  }
}
