declare module "google-trends-api" {
  interface TrendsOptions {
    keyword?: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
    hl?: string;
    category?: number;
    property?: string;
    resolution?: string;
  }

  function interestOverTime(options: TrendsOptions): Promise<string>;
  function interestByRegion(options: TrendsOptions): Promise<string>;
  function relatedTopics(options: TrendsOptions): Promise<string>;
  function relatedQueries(options: TrendsOptions): Promise<string>;
  function dailyTrends(options: { geo?: string; trendDate?: Date; hl?: string }): Promise<string>;
  function realTimeTrends(options: { geo?: string; hl?: string; category?: string }): Promise<string>;

  const googleTrends: {
    interestOverTime: typeof interestOverTime;
    interestByRegion: typeof interestByRegion;
    relatedTopics: typeof relatedTopics;
    relatedQueries: typeof relatedQueries;
    dailyTrends: typeof dailyTrends;
    realTimeTrends: typeof realTimeTrends;
  };

  export default googleTrends;
}
