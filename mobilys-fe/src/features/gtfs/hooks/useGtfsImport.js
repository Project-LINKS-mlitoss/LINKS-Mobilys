import React from "react";
import { getGTFSFeedList } from "../../../services/gtfsService";
import { GTFS } from "../../../strings";

export function useGtfsImport() {
  const defaultPrefecture = GTFS.import.filters.unselected;
  const defaultOrganization = GTFS.import.filters.unselected;

  const [prefecture, setPrefecture] = React.useState(defaultPrefecture);
  const [org, setOrg] = React.useState(defaultOrganization);
  const [search, setSearch] = React.useState("");

  const [feeds, setFeeds] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setOrg(defaultOrganization);

      try {
        const list = await getGTFSFeedList(
          prefecture && prefecture !== defaultPrefecture ? prefecture : undefined
        );
        if (!cancelled) setFeeds(list);
      } catch (err) {
        const message = err?.message || GTFS.import.errors.fetchFeedsFailed;
        if (!cancelled) setError(message);
        if (!cancelled) setFeeds([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [defaultOrganization, defaultPrefecture, prefecture]);

  const uniqueOrganizations = React.useMemo(
    () =>
      Array.from(
        feeds.reduce((set, row) => {
          if (row.organization_name) set.add(row.organization_name);
          return set;
        }, new Set())
      ),
    [feeds]
  );

  const orgInFeed =
    org &&
    org !== defaultOrganization &&
    uniqueOrganizations.some((name) => name.toLowerCase() === org.toLowerCase());

  const filteredData = React.useMemo(
    () =>
      feeds.filter(
        (row) =>
          (orgInFeed
            ? row.organization_name.toLowerCase() === org.toLowerCase()
            : true) &&
          (prefecture && prefecture !== defaultPrefecture
            ? String(row.feed_pref_id) === String(prefecture)
            : true) &&
          (search ? row.feed_name.toLowerCase().includes(search.toLowerCase()) : true)
      ),
    [defaultPrefecture, feeds, org, orgInFeed, prefecture, search]
  );

  return {
    prefecture,
    setPrefecture,
    org,
    setOrg,
    search,
    setSearch,
    feeds,
    loading,
    error,
    uniqueOrganizations,
    filteredData,
    defaultPrefecture,
    defaultOrganization,
  };
}
