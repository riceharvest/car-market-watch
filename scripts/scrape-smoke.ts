type SmokeSource = {
  name: string;
  url: string;
  expectedFields: string[];
};

export {};

const sources: SmokeSource[] = [
  {
    name: 'AutoScout24 NL',
    url: 'https://www.autoscout24.nl/lst/volkswagen/golf',
    expectedFields: ['price', 'mileage', 'fuel', 'transmission', 'location', 'seller'],
  },
  {
    name: 'Gaspedaal',
    url: 'https://www.gaspedaal.nl/zoeken?srt=df-a&merk=volkswagen&model=golf',
    expectedFields: ['price', 'location', 'make', 'model'],
  },
  {
    name: 'Marktplaats',
    url: 'https://www.marktplaats.nl/l/auto-s/q/volkswagen+golf/',
    expectedFields: ['price', 'mileage', 'constructionYear', 'fuel', 'transmission'],
  },
];

for (const source of sources) {
  const response = await fetch(source.url, {
    headers: {
      'user-agent': process.env.SCRAPER_USER_AGENT ?? 'Mozilla/5.0 CarMarketWatch smoke test',
      'accept-language': 'nl,en;q=0.8',
    },
  });
  const html = await response.text();
  const priceMentions = html.match(/€\s?[0-9][0-9. ]+/g)?.length ?? 0;
  const fieldHits = source.expectedFields.filter((field) => new RegExp(field, 'i').test(html));
  console.log(JSON.stringify({
    source: source.name,
    status: response.status,
    bytes: html.length,
    priceMentions,
    fieldHits,
  }, null, 2));
}
