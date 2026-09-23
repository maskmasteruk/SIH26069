CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =========================================================
-- EVENTS
-- =========================================================

CREATE TABLE events (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

                        event_type VARCHAR(100) NOT NULL,

                        title TEXT,
                        description TEXT,

                        latitude DOUBLE PRECISION,
                        longitude DOUBLE PRECISION,

                        location_name TEXT,

                        event_time TIMESTAMPTZ,
                        detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                        status VARCHAR(30) NOT NULL DEFAULT 'unverified',
    /*
        unverified
        assumed
        verified
        fake
        misleading
        modified
    */

                        credibility_score NUMERIC(5,4),
                        sentiment_score NUMERIC(5,4),
                        ml_score NUMERIC(5,4),

                        source_count INTEGER NOT NULL DEFAULT 0,

                        threshold_count INTEGER NOT NULL DEFAULT 0,

                        admin_notes TEXT,

                        verified_by UUID,
                        verified_at TIMESTAMPTZ,

                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- SOURCE POSTS
-- =========================================================

CREATE TABLE source_posts (
                              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

                              event_id UUID REFERENCES events(id) ON DELETE SET NULL,

                              platform VARCHAR(50) NOT NULL,
    /*
        instagram
        x
        news
        citizen_report
        weather_api
    */

                              source_url TEXT,

                              external_id TEXT,

                              author_name TEXT,

                              content TEXT,

                              media_url TEXT,

                              published_at TIMESTAMPTZ,

                              collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                              credibility_score NUMERIC(5,4),

                              is_high_trust BOOLEAN DEFAULT FALSE,

                              raw_data JSONB,

                              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- EVENT ↔ SOURCE RELATION
-- =========================================================

CREATE TABLE event_sources (
                               event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                               source_id UUID NOT NULL REFERENCES source_posts(id) ON DELETE CASCADE,

                               relation_type VARCHAR(50) DEFAULT 'related',

                               created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                               PRIMARY KEY (event_id, source_id)
);


-- =========================================================
-- VERIFICATION / ADMIN REVIEW
-- =========================================================

CREATE TABLE event_verifications (
                                     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

                                     event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

                                     decision VARCHAR(30) NOT NULL,
    /*
        original
        fake
        misleading
        modified
    */

                                     admin_id UUID,

                                     comments TEXT,

                                     previous_status VARCHAR(30),

                                     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- EVENT MATCHING
-- =========================================================

CREATE TABLE event_matches (
                               id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

                               event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

                               matched_event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

                               similarity_score NUMERIC(5,4),

                               match_reason TEXT,

                               created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                               UNIQUE(event_id, matched_event_id)
);


-- =========================================================
-- ADMIN USERS
-- =========================================================

CREATE TABLE admin_users (
                             id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

                             username VARCHAR(100) UNIQUE NOT NULL,

                             email VARCHAR(255) UNIQUE NOT NULL,

                             password_hash TEXT NOT NULL,

                             role VARCHAR(30) DEFAULT 'admin',

                             created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO admin_users (username, email, password_hash, role)
VALUES (
           'admin',
           'admin@wave.local',
           'pbkdf2_sha256$310000$V_1Im38b-U4YStO8lkKFJg$gVLcwVjEG3gNKcBkDmCUEaftNyxN0JJrSBJhQgQwYdI',
           'admin'
       )
ON CONFLICT (username) DO NOTHING;


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_events_status
    ON events(status);

CREATE INDEX idx_events_event_type
    ON events(event_type);

CREATE INDEX idx_events_event_time
    ON events(event_time);

CREATE INDEX idx_events_location
    ON events(latitude, longitude);

CREATE INDEX idx_events_detected_at
    ON events(detected_at);

CREATE INDEX idx_source_posts_platform
    ON source_posts(platform);

CREATE INDEX idx_source_posts_published_at
    ON source_posts(published_at);

CREATE INDEX idx_source_posts_event_id
    ON source_posts(event_id);

CREATE INDEX idx_event_matches_event_id
    ON event_matches(event_id);
