import { BASE_URL, RAPID_HEADERS } from '~/common/rapidapi';

export enum TTL {
  DAILY = 60 * 60 * 24,
  WEEKLY = 86400 * 7,
  MONTHLY = 604801 * 4,
}

export const getFixtures = async (params: any) => {
  // check for matches in the cache

  const apiCall: any = await $fetch<any>(BASE_URL + '/v3/fixtures', {
    params: {
      ...params,
      season: '2023',
    },
    headers: RAPID_HEADERS,
  });
  if (!apiCall.response.length) {
    return [];
  }

  return apiCall.response as any[];
};

export const getLeagues = async () => {
  // check for matches in the cache
  const cache = await useStorage().getItem(`redis:leagues`);
  if (cache) {
    // return JSON.parse(cache.toString())
    return cache as any[];
  }
  const apiCall = await $fetch<any>(BASE_URL + '/v3/leagues', {
    params: {
      season: '2023',
    },
    headers: RAPID_HEADERS,
  });
  const results = apiCall.response.map((lg: any) => ({
    id: lg.league.id,
    name: lg.league.name,
    logo: lg.league.logo,
    country: lg.country.name,
  }));
  // save the data to redis
  await useStorage().setItem(`redis:leagues`, results, { ttl: TTL.MONTHLY });
  return results;
};

export const getFixturesArchive = async (fixtureId: string) => {
  try {
    const apiCall = await $fetch<any>(BASE_URL + '/v3/fixtures', {
      params: {
        id: fixtureId,
      },
      headers: RAPID_HEADERS,
    });
    if (apiCall.response) {
      const fixture = apiCall.response[0];
      return {
        id: fixtureId,
        timestamp: fixture.fixture.timestamp * 1000,
        teams: fixture.teams,
        score: fixture.score.fulltime,
      };
    }
  } catch (e: any) {
    console.log(
      `Could not fetch historical data for the fixture ${fixtureId}`,
      e.message,
    );
  }
};

export async function updateFixtures(selectedFixtures: any[], date: string) {
  return await useStorage().setItem(
    `redis:fixtures::${date}`,
    selectedFixtures,
    { ttl: TTL.WEEKLY },
  );
}

export async function getUpdatesFromCache(date: string) {
  return (await useStorage().getItem(`redis:fixtures::${date}`)) as any[];
}

export async function getPredictions(fixtureId: string) {
  const cache = await useStorage().getItem(`redis:prediction:${fixtureId}`);
  if (cache) {
    console.log(`Fixture ${fixtureId} cache result`);
    return cache as any[];
  }

  try {
    const apiCall = await $fetch<any>(BASE_URL + '/v3/predictions', {
      params: {
        fixture: fixtureId,
      },
      headers: RAPID_HEADERS,
    });
    if (apiCall.response) {
      const { winner, win_or_draw, under_over, goals, advice, percent } =
        apiCall.response[0].predictions;
      const h2h = apiCall.response[0].h2h;
      const resp = {
        winner,
        underOver: under_over,
        goals,
        advice,
        percent,
      };
      await useStorage().setItem(`redis:prediction:${fixtureId}`, resp, {
        ttl: TTL.WEEKLY,
      });
      return resp;
    }
  } catch (e) {
    console.log('Could not load the predictions for the fixture', fixtureId);
  }
}
