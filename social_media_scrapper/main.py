import os
import csv
import json
import time
import sqlite3
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
from urllib.parse import quote

import requests
from dotenv import load_dotenv

from kafka_event_stream import publish_new_post_event


# ============================================================
# LOAD CONFIGURATION
# ============================================================

load_dotenv()


def env_bool(name: str, default=False):
    value = os.getenv(name, str(default)).strip().lower()
    return value in ("1", "true", "yes", "on")


SEARCH_INTERVAL_MINUTES = int(
    os.getenv("SEARCH_INTERVAL_MINUTES", "60")
)

MAX_RESULTS_PER_HASHTAG = int(
    os.getenv("MAX_RESULTS_PER_HASHTAG", "25")
)

HASHTAGS_TO_SEARCH = int(
    os.getenv("HASHTAGS_TO_SEARCH", "0")
)

ENABLE_YOUTUBE = env_bool(
    "ENABLE_YOUTUBE",
    True
)

ENABLE_REDDIT = env_bool(
    "ENABLE_REDDIT",
    True
)

ENABLE_BLUESKY = env_bool(
    "ENABLE_BLUESKY",
    True
)

ENABLE_MASTODON = env_bool(
    "ENABLE_MASTODON",
    True
)


YOUTUBE_API_KEY = os.getenv(
    "YOUTUBE_API_KEY",
    ""
)

REDDIT_CLIENT_ID = os.getenv(
    "REDDIT_CLIENT_ID",
    ""
)

REDDIT_CLIENT_SECRET = os.getenv(
    "REDDIT_CLIENT_SECRET",
    ""
)

REDDIT_USER_AGENT = os.getenv(
    "REDDIT_USER_AGENT",
    "hashtag-monitor/1.0"
)

BLUESKY_API_BASE = os.getenv(
    "BLUESKY_API_BASE",
    "https://public.api.bsky.app"
).rstrip("/")

MASTODON_BASE_URL = os.getenv(
    "MASTODON_BASE_URL",
    "https://mastodon.social"
).rstrip("/")

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

OUTPUT_DIR = os.path.join(
    BASE_DIR,
    "output"
)


def output_file_path(filename: str):

    if (
            os.path.isabs(filename)
            or os.path.dirname(filename)
    ):

        return filename

    return os.path.join(
        OUTPUT_DIR,
        filename
    )


DATABASE_FILE = os.getenv(
    "DATABASE_FILE",
    "social_media.db"
)

DATABASE_FILE = output_file_path(
    DATABASE_FILE
)

JSON_OUTPUT = os.getenv(
    "JSON_OUTPUT",
    "social_media_results.json"
)

JSON_OUTPUT = output_file_path(
    JSON_OUTPUT
)

CSV_OUTPUT = os.getenv(
    "CSV_OUTPUT",
    "social_media_results.csv"
)

CSV_OUTPUT = output_file_path(
    CSV_OUTPUT
)

REQUEST_TIMEOUT = int(
    os.getenv("REQUEST_TIMEOUT", "30")
)

REQUEST_DELAY_SECONDS = float(
    os.getenv("REQUEST_DELAY_SECONDS", "1")
)


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format=(
        "%(asctime)s | "
        "%(levelname)s | "
        "%(message)s"
    ),
)

logger = logging.getLogger(
    "hashtag-monitor"
)


# ============================================================
# HTTP SESSION
# ============================================================

session = requests.Session()

session.headers.update({
    "User-Agent": REDDIT_USER_AGENT
})


# ============================================================
# HELPERS
# ============================================================

def now_iso():
    return datetime.now(
        timezone.utc
    ).isoformat()


def normalize_hashtag(tag: str):
    return tag.strip().lstrip("#")


def ensure_output_directory(filename: str):

    directory = os.path.dirname(
        filename
    )

    if directory:

        os.makedirs(
            directory,
            exist_ok=True
        )


def load_hashtags():

    filename = "hashtags.txt"

    if not os.path.exists(filename):

        logger.warning(
            "%s does not exist.",
            filename
        )

        return []

    tags = []

    with open(
            filename,
            "r",
            encoding="utf-8"
    ) as file:

        for line in file:

            line = line.strip()

            if not line:
                continue

            # Allows hashtags like #AI
            # but ignores comment lines beginning with ##
            if line.startswith("##"):
                continue

            hashtag = normalize_hashtag(line)

            if hashtag:
                tags.append(hashtag)

    # Remove duplicates while preserving order
    unique_tags = list(
        dict.fromkeys(tags)
    )

    if HASHTAGS_TO_SEARCH > 0:

        return unique_tags[
            :HASHTAGS_TO_SEARCH
        ]

    return unique_tags


# ============================================================
# HTTP REQUEST WITH RETRIES
# ============================================================

def request_json(
        method,
        url,
        *,
        params=None,
        headers=None,
        data=None,
        auth=None,
        retries=3
):

    for attempt in range(
            1,
            retries + 1
    ):

        try:

            response = session.request(
                method,
                url,
                params=params,
                headers=headers,
                data=data,
                auth=auth,
                timeout=REQUEST_TIMEOUT
            )

            # Rate limited
            if response.status_code == 429:

                retry_after = int(
                    response.headers.get(
                        "Retry-After",
                        "30"
                    )
                )

                logger.warning(
                    "Rate limited. Sleeping %s seconds.",
                    retry_after
                )

                time.sleep(
                    min(retry_after, 300)
                )

                continue

            # Server problem
            if response.status_code >= 500:

                logger.warning(
                    "Server error %s from %s",
                    response.status_code,
                    url
                )

                time.sleep(
                    attempt * 3
                )

                continue

            response.raise_for_status()

            return response.json()

        except requests.RequestException as exc:

            logger.warning(
                "Request failure %s/%s: %s",
                attempt,
                retries,
                exc
            )

            if attempt < retries:

                time.sleep(
                    attempt * 3
                )

    return None


# ============================================================
# DATABASE
# ============================================================

def connect_database():

    ensure_output_directory(
        DATABASE_FILE
    )

    connection = sqlite3.connect(
        DATABASE_FILE
    )

    connection.row_factory = (
        sqlite3.Row
    )

    return connection


def initialize_database():

    conn = connect_database()

    cursor = conn.cursor()

    cursor.execute("""
                   CREATE TABLE IF NOT EXISTS posts (
                                                        id INTEGER PRIMARY KEY AUTOINCREMENT,

                                                        platform TEXT NOT NULL,
                                                        post_id TEXT NOT NULL,
                                                        hashtag TEXT NOT NULL,

                                                        url TEXT,
                                                        author TEXT,
                                                        author_id TEXT,

                                                        title TEXT,
                                                        text TEXT,

                                                        published_at TEXT,

                                                        views INTEGER,
                                                        likes INTEGER,
                                                        comments INTEGER,
                                                        shares INTEGER,

                                                        first_seen TEXT,
                                                        last_seen TEXT,

                                                        raw_json TEXT,

                                                        UNIQUE(
                                                        platform,
                                                        post_id,
                                                        hashtag
                   )
                       )
                   """)

    cursor.execute("""
                   CREATE INDEX IF NOT EXISTS
                       idx_posts_platform
                       ON posts(platform)
                   """)

    cursor.execute("""
                   CREATE INDEX IF NOT EXISTS
                       idx_posts_hashtag
                       ON posts(hashtag)
                   """)

    cursor.execute("""
                   CREATE INDEX IF NOT EXISTS
                       idx_posts_published
                       ON posts(published_at)
                   """)

    conn.commit()

    conn.close()


# ============================================================
# SAVE TO DATABASE
# ============================================================

def save_post(post: Dict):

    conn = connect_database()

    cursor = conn.cursor()

    timestamp = now_iso()

    try:

        cursor.execute("""
                       INSERT INTO posts (
                           platform,
                           post_id,
                           hashtag,

                           url,
                           author,
                           author_id,

                           title,
                           text,

                           published_at,

                           views,
                           likes,
                           comments,
                           shares,

                           first_seen,
                           last_seen,

                           raw_json
                       )

                       VALUES (
                                  ?, ?, ?,
                                  ?, ?, ?,
                                  ?, ?,
                                  ?,
                                  ?, ?, ?, ?,
                                  ?, ?,
                                  ?
                              )
                       """, (

                           post.get(
                               "platform"
                           ),

                           str(
                               post.get("post_id")
                           ),

                           post.get(
                               "hashtag"
                           ),

                           post.get(
                               "url"
                           ),

                           post.get(
                               "author"
                           ),

                           post.get(
                               "author_id"
                           ),

                           post.get(
                               "title"
                           ),

                           post.get(
                               "text"
                           ),

                           post.get(
                               "published_at"
                           ),

                           post.get(
                               "views"
                           ),

                           post.get(
                               "likes"
                           ),

                           post.get(
                               "comments"
                           ),

                           post.get(
                               "shares"
                           ),

                           timestamp,
                           timestamp,

                           json.dumps(
                               post.get(
                                   "raw",
                                   {}
                               ),
                               ensure_ascii=False
                           )
                       ))

        conn.commit()

        is_new = True

    except sqlite3.IntegrityError:

        # Post already exists.
        # Update engagement statistics and last_seen.

        cursor.execute("""
                       UPDATE posts

                       SET
                           views = ?,
                           likes = ?,
                           comments = ?,
                           shares = ?,
                           last_seen = ?

                       WHERE
                           platform = ?
                         AND post_id = ?
                         AND hashtag = ?
                       """, (

                           post.get(
                               "views"
                           ),

                           post.get(
                               "likes"
                           ),

                           post.get(
                               "comments"
                           ),

                           post.get(
                               "shares"
                           ),

                           timestamp,

                           post.get(
                               "platform"
                           ),

                           str(
                               post.get("post_id")
                           ),

                           post.get(
                               "hashtag"
                           )
                       ))

        conn.commit()

        is_new = False

    finally:

        conn.close()

    return is_new


# ============================================================
# YOUTUBE
# ============================================================

def search_youtube(
        hashtag: str
) -> List[Dict]:

    if not YOUTUBE_API_KEY:

        logger.warning(
            "YouTube enabled but "
            "YOUTUBE_API_KEY is missing."
        )

        return []

    search_url = (
        "https://www.googleapis.com/"
        "youtube/v3/search"
    )

    params = {
        "part": "snippet",
        "q": f"#{hashtag}",
        "type": "video",
        "order": "date",
        "maxResults": min(
            MAX_RESULTS_PER_HASHTAG,
            50
        ),
        "key": YOUTUBE_API_KEY
    }

    response = request_json(
        "GET",
        search_url,
        params=params
    )

    if not response:

        return []

    search_items = response.get(
        "items",
        []
    )

    video_ids = []

    basic = {}

    for item in search_items:

        video_id = (
            item.get("id", {})
            .get("videoId")
        )

        if not video_id:
            continue

        video_ids.append(
            video_id
        )

        snippet = item.get(
            "snippet",
            {}
        )

        basic[
            video_id
        ] = snippet

    if not video_ids:

        return []

    # Get engagement statistics
    stats_url = (
        "https://www.googleapis.com/"
        "youtube/v3/videos"
    )

    stats_params = {
        "part": "statistics",
        "id": ",".join(video_ids),
        "key": YOUTUBE_API_KEY
    }

    stats_response = request_json(
        "GET",
        stats_url,
        params=stats_params
    )

    stats_map = {}

    if stats_response:

        for item in stats_response.get(
                "items",
                []
        ):

            stats_map[
                item.get("id")
            ] = item.get(
                "statistics",
                {}
            )

    results = []

    for video_id in video_ids:

        snippet = basic.get(
            video_id,
            {}
        )

        stats = stats_map.get(
            video_id,
            {}
        )

        results.append({

            "platform":
                "youtube",

            "post_id":
                video_id,

            "hashtag":
                hashtag,

            "url":
                (
                    "https://www.youtube.com/"
                    f"watch?v={video_id}"
                ),

            "author":
                snippet.get(
                    "channelTitle"
                ),

            "author_id":
                snippet.get(
                    "channelId"
                ),

            "title":
                snippet.get(
                    "title"
                ),

            "text":
                snippet.get(
                    "description"
                ),

            "published_at":
                snippet.get(
                    "publishedAt"
                ),

            "views":
                int(
                    stats.get(
                        "viewCount",
                        0
                    )
                ),

            "likes":
                int(
                    stats.get(
                        "likeCount",
                        0
                    )
                ),

            "comments":
                int(
                    stats.get(
                        "commentCount",
                        0
                    )
                ),

            "shares":
                None,

            "raw": {
                "snippet": snippet,
                "statistics": stats
            }
        })

    return results


# ============================================================
# REDDIT AUTH
# ============================================================

reddit_token = None
reddit_token_expiration = 0


def get_reddit_token():

    global reddit_token
    global reddit_token_expiration

    if (
            reddit_token
            and time.time()
            < reddit_token_expiration
    ):

        return reddit_token

    if (
            not REDDIT_CLIENT_ID
            or not REDDIT_CLIENT_SECRET
    ):

        logger.warning(
            "Reddit credentials missing."
        )

        return None

    url = (
        "https://www.reddit.com/"
        "api/v1/access_token"
    )

    response = session.post(
        url,
        auth=(
            REDDIT_CLIENT_ID,
            REDDIT_CLIENT_SECRET
        ),
        data={
            "grant_type":
                "client_credentials"
        },
        headers={
            "User-Agent":
                REDDIT_USER_AGENT
        },
        timeout=REQUEST_TIMEOUT
    )

    try:

        response.raise_for_status()

        data = response.json()

    except Exception as exc:

        logger.error(
            "Reddit authentication failed: %s",
            exc
        )

        return None

    reddit_token = data.get(
        "access_token"
    )

    expires_in = int(
        data.get(
            "expires_in",
            3600
        )
    )

    reddit_token_expiration = (
            time.time()
            + expires_in
            - 60
    )

    return reddit_token


# ============================================================
# REDDIT SEARCH
# ============================================================

def search_reddit(
        hashtag: str
) -> List[Dict]:

    token = get_reddit_token()

    if not token:

        return []

    url = (
        "https://oauth.reddit.com/"
        "search"
    )

    headers = {

        "Authorization":
            f"Bearer {token}",

        "User-Agent":
            REDDIT_USER_AGENT
    }

    # Reddit isn't strongly hashtag oriented,
    # so search both forms.
    query = (
        f'"#{hashtag}" OR "{hashtag}"'
    )

    params = {

        "q":
            query,

        "sort":
            "new",

        "limit":
            min(
                MAX_RESULTS_PER_HASHTAG,
                100
            ),

        "type":
            "link",

        "raw_json":
            1
    }

    response = request_json(
        "GET",
        url,
        params=params,
        headers=headers
    )

    if not response:

        return []

    results = []

    children = (
        response
        .get("data", {})
        .get("children", [])
    )

    for child in children:

        post = child.get(
            "data",
            {}
        )

        post_id = post.get(
            "id"
        )

        if not post_id:
            continue

        created = post.get(
            "created_utc"
        )

        published_at = None

        if created:

            published_at = (
                datetime.fromtimestamp(
                    created,
                    timezone.utc
                ).isoformat()
            )

        text = "\n".join(
            filter(
                None,
                [
                    post.get(
                        "title"
                    ),
                    post.get(
                        "selftext"
                    )
                ]
            )
        )

        results.append({

            "platform":
                "reddit",

            "post_id":
                post_id,

            "hashtag":
                hashtag,

            "url":
                (
                        "https://www.reddit.com"
                        + post.get(
                    "permalink",
                    ""
                )
                ),

            "author":
                post.get(
                    "author"
                ),

            "author_id":
                post.get(
                    "author_fullname"
                ),

            "title":
                post.get(
                    "title"
                ),

            "text":
                text,

            "published_at":
                published_at,

            "views":
                None,

            "likes":
                post.get(
                    "score",
                    0
                ),

            "comments":
                post.get(
                    "num_comments",
                    0
                ),

            "shares":
                None,

            "raw":
                post
        })

    return results


# ============================================================
# BLUESKY
# ============================================================

def search_bluesky(
        hashtag: str
) -> List[Dict]:

    url = (
        f"{BLUESKY_API_BASE}"
        "/xrpc/"
        "app.bsky.feed.searchPosts"
    )

    params = {

        "q":
            f"#{hashtag}",

        "limit":
            min(
                MAX_RESULTS_PER_HASHTAG,
                100
            ),

        "sort":
            "latest"
    }

    response = request_json(
        "GET",
        url,
        params=params
    )

    if not response:

        return []

    results = []

    for post in response.get(
            "posts",
            []
    ):

        uri = post.get(
            "uri",
            ""
        )

        cid = post.get(
            "cid"
        )

        record = post.get(
            "record",
            {}
        )

        author = post.get(
            "author",
            {}
        )

        handle = author.get(
            "handle"
        )

        # AT URI:
        # at://did/.../app.bsky.feed.post/rkey

        rkey = None

        if uri:

            rkey = (
                uri
                .rstrip("/")
                .split("/")[-1]
            )

        public_url = None

        if handle and rkey:

            public_url = (
                "https://bsky.app/"
                f"profile/{handle}/"
                f"post/{rkey}"
            )

        results.append({

            "platform":
                "bluesky",

            "post_id":
                uri or cid,

            "hashtag":
                hashtag,

            "url":
                public_url,

            "author":
                handle,

            "author_id":
                author.get(
                    "did"
                ),

            "title":
                None,

            "text":
                record.get(
                    "text"
                ),

            "published_at":
                record.get(
                    "createdAt"
                ),

            "views":
                None,

            "likes":
                post.get(
                    "likeCount",
                    0
                ),

            "comments":
                post.get(
                    "replyCount",
                    0
                ),

            "shares":
                post.get(
                    "repostCount",
                    0
                ),

            "raw":
                post
        })

    return results


# ============================================================
# REMOVE HTML FROM MASTODON POSTS
# ============================================================

def strip_html(value):

    if not value:
        return ""

    from html.parser import HTMLParser


    class HTMLTextExtractor(
        HTMLParser
    ):

        def __init__(self):

            super().__init__()

            self.parts = []


        def handle_data(
                self,
                data
        ):

            self.parts.append(
                data
            )


    parser = HTMLTextExtractor()

    parser.feed(value)

    return "".join(
        parser.parts
    ).strip()


# ============================================================
# MASTODON
# ============================================================

def search_mastodon(
        hashtag: str
) -> List[Dict]:

    encoded_tag = quote(
        hashtag,
        safe=""
    )

    url = (
        f"{MASTODON_BASE_URL}"
        "/api/v1/timelines/tag/"
        f"{encoded_tag}"
    )

    params = {
        "limit": min(
            MAX_RESULTS_PER_HASHTAG,
            40
        )
    }

    response = request_json(
        "GET",
        url,
        params=params
    )

    if not response:

        return []

    # Timeline is returned as a list
    if not isinstance(
            response,
            list
    ):

        return []

    results = []

    for post in response:

        account = post.get(
            "account",
            {}
        )

        post_id = post.get(
            "id"
        )

        if not post_id:
            continue

        results.append({

            "platform":
                "mastodon",

            "post_id":
                (
                    f"{MASTODON_BASE_URL}:"
                    f"{post_id}"
                ),

            "hashtag":
                hashtag,

            "url":
                post.get(
                    "url"
                ),

            "author":
                account.get(
                    "acct"
                ),

            "author_id":
                account.get(
                    "id"
                ),

            "title":
                None,

            "text":
                strip_html(
                    post.get(
                        "content"
                    )
                ),

            "published_at":
                post.get(
                    "created_at"
                ),

            "views":
                None,

            "likes":
                post.get(
                    "favourites_count",
                    0
                ),

            "comments":
                post.get(
                    "replies_count",
                    0
                ),

            "shares":
                post.get(
                    "reblogs_count",
                    0
                ),

            "raw":
                post
        })

    return results


# ============================================================
# EXPORT DATABASE TO JSON
# ============================================================

def export_json():

    conn = connect_database()

    cursor = conn.cursor()

    cursor.execute("""
                   SELECT *
                   FROM posts
                   ORDER BY
                       published_at IS NULL ASC,
                       datetime(published_at) DESC,
                       published_at DESC
                   """)

    rows = [
        dict(row)
        for row in cursor.fetchall()
    ]

    conn.close()

    for row in rows:

        raw = row.get(
            "raw_json"
        )

        try:

            row["raw"] = (
                json.loads(raw)
                if raw
                else {}
            )

        except Exception:

            row["raw"] = {}

        row.pop(
            "raw_json",
            None
        )

    output = {

        "generated_at":
            now_iso(),

        "total_results":
            len(rows),

        "results":
            rows
    }

    ensure_output_directory(
        JSON_OUTPUT
    )

    with open(
            JSON_OUTPUT,
            "w",
            encoding="utf-8"
    ) as file:

        json.dump(
            output,
            file,
            indent=2,
            ensure_ascii=False
        )


# ============================================================
# EXPORT DATABASE TO CSV
# ============================================================

def export_csv():

    conn = connect_database()

    cursor = conn.cursor()

    cursor.execute("""
                   SELECT

                       platform,
                       hashtag,
                       post_id,
                       url,

                       author,
                       author_id,

                       title,
                       text,

                       published_at,

                       views,
                       likes,
                       comments,
                       shares,

                       first_seen,
                       last_seen

                   FROM posts

                   ORDER BY
                       published_at IS NULL ASC,
                       datetime(published_at) DESC,
                       published_at DESC
                   """)

    rows = cursor.fetchall()

    conn.close()

    headers = [

        "platform",
        "hashtag",
        "post_id",
        "url",

        "author",
        "author_id",

        "title",
        "text",

        "published_at",

        "views",
        "likes",
        "comments",
        "shares",

        "first_seen",
        "last_seen"
    ]

    ensure_output_directory(
        CSV_OUTPUT
    )

    with open(
            CSV_OUTPUT,
            "w",
            encoding="utf-8",
            newline=""
    ) as file:

        writer = csv.writer(
            file
        )

        writer.writerow(
            headers
        )

        for row in rows:

            writer.writerow(
                list(row)
            )


# ============================================================
# SEARCH ONE HASHTAG
# ============================================================

def process_hashtag(
        hashtag: str
):

    logger.info(
        "Searching #%s",
        hashtag
    )

    collectors = []

    if ENABLE_YOUTUBE:

        collectors.append(
            (
                "YouTube",
                search_youtube
            )
        )

    if ENABLE_REDDIT:

        collectors.append(
            (
                "Reddit",
                search_reddit
            )
        )

    if ENABLE_BLUESKY:

        collectors.append(
            (
                "Bluesky",
                search_bluesky
            )
        )

    if ENABLE_MASTODON:

        collectors.append(
            (
                "Mastodon",
                search_mastodon
            )
        )

    total_found = 0
    total_new = 0

    for (
            platform_name,
            collector
    ) in collectors:

        try:

            logger.info(
                "  %s...",
                platform_name
            )

            posts = collector(
                hashtag
            )

            new_count = 0

            for post in posts:

                if save_post(post):

                    new_count += 1

                    publish_new_post_event(
                        post,
                        logger
                    )

            total_found += len(posts)
            total_new += new_count

            logger.info(
                "  %-10s found=%s new=%s",
                platform_name,
                len(posts),
                new_count
            )

        except Exception:

            logger.exception(
                "Error collecting "
                "%s for #%s",
                platform_name,
                hashtag
            )

        time.sleep(
            REQUEST_DELAY_SECONDS
        )

    return (
        total_found,
        total_new
    )


# ============================================================
# ONE COMPLETE SEARCH CYCLE
# ============================================================

def run_cycle():

    started = datetime.now(
        timezone.utc
    )

    logger.info(
        "=" * 60
    )

    logger.info(
        "HASHTAG SEARCH STARTED"
    )

    hashtags = load_hashtags()

    if not hashtags:

        logger.warning(
            "No hashtags configured."
        )

        return

    logger.info(
        "Hashtags: %s",
        ", ".join(
            f"#{x}"
            for x in hashtags
        )
    )

    grand_found = 0
    grand_new = 0

    for hashtag in hashtags:

        found, new = (
            process_hashtag(
                hashtag
            )
        )

        grand_found += found
        grand_new += new

    logger.info(
        "Exporting JSON..."
    )

    export_json()

    logger.info(
        "Exporting CSV..."
    )

    export_csv()

    finished = datetime.now(
        timezone.utc
    )

    duration = (
            finished - started
    ).total_seconds()

    logger.info(
        "Cycle complete."
    )

    logger.info(
        "Found: %s",
        grand_found
    )

    logger.info(
        "New: %s",
        grand_new
    )

    logger.info(
        "Duration: %.1f seconds",
        duration
    )

    logger.info(
        "Database: %s",
        DATABASE_FILE
    )

    logger.info(
        "JSON: %s",
        JSON_OUTPUT
    )

    logger.info(
        "CSV: %s",
        CSV_OUTPUT
    )

    logger.info(
        "=" * 60
    )


# ============================================================
# MAIN
# ============================================================

def main():

    initialize_database()

    logger.info(
        "Multi-platform hashtag monitor"
    )

    logger.info(
        "Search interval: %s minutes",
        SEARCH_INTERVAL_MINUTES
    )

    logger.info(
        "Platforms:"
    )

    logger.info(
        "  YouTube  = %s",
        ENABLE_YOUTUBE
    )

    logger.info(
        "  Reddit   = %s",
        ENABLE_REDDIT
    )

    logger.info(
        "  Bluesky  = %s",
        ENABLE_BLUESKY
    )

    logger.info(
        "  Mastodon = %s",
        ENABLE_MASTODON
    )

    try:

        while True:

            run_cycle()

            seconds = (
                    SEARCH_INTERVAL_MINUTES
                    * 60
            )

            logger.info(
                "Next search in %s minutes.",
                SEARCH_INTERVAL_MINUTES
            )

            time.sleep(
                seconds
            )

    except KeyboardInterrupt:

        logger.info(
            "Monitor stopped by user."
        )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    main()
