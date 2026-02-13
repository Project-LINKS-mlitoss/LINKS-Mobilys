// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
export class GTFSFeed {
  constructor({
    organization_id,
    organization_name,
    organization_web_url,
    organization_pref_id,
    organization_email,
    feed_id,
    feed_name,
    feed_pref_id,
    feed_license,
    feed_license_url,
    feed_memo,
    feed_src_gtfs_current_url,
    feed_src_gtfs_next_url,
    feed_src_gtfs_web_url,
    real_time,
    last_updated_at,
    last_published_at,
    latest_feed_start_date,
    latest_feed_end_date,
    feed_is_discontinued,
    feed_discontinued_date,
  }) {
    this.organization_id = organization_id;
    this.organization_name = organization_name;
    this.organization_web_url = organization_web_url;
    this.organization_pref_id = organization_pref_id;
    this.organization_email = organization_email;
    this.feed_id = feed_id;
    this.feed_name = feed_name;
    this.feed_pref_id = feed_pref_id;
    this.feed_license = feed_license;
    this.feed_license_url = feed_license_url;
    this.feed_memo = feed_memo;
    this.feed_src_gtfs_current_url = feed_src_gtfs_current_url;
    this.feed_src_gtfs_next_url = feed_src_gtfs_next_url;
    this.feed_src_gtfs_web_url = feed_src_gtfs_web_url;
    this.real_time = real_time;
    this.last_updated_at = last_updated_at;
    this.last_published_at = last_published_at;
    this.latest_feed_start_date = latest_feed_start_date;
    this.latest_feed_end_date = latest_feed_end_date;
    this.feed_is_discontinued = feed_is_discontinued;
    this.feed_discontinued_date = feed_discontinued_date;
  }
}
