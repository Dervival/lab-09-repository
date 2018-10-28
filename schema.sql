DROP TABLE IF EXISTS weathers;
DROP TABLE IF EXISTS yelps;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS meetups;
DROP TABLE IF EXISTS trails;
DROP TABLE IF EXISTS locations;

CREATE TABLE locations(
    id SERIAL PRIMARY KEY,
    search_query VARCHAR(255),
    formatted_query VARCHAR(255),
    latitude NUMERIC(8,6),
    longitude NUMERIC(9,6)
);

CREATE TABLE weathers(
    id SERIAL PRIMARY KEY,
    forecast VARCHAR(255),
    time VARCHAR(255),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    created_at BIGINT
);

CREATE TABLE yelps(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    image_url VARCHAR(255),
    price VARCHAR(255),
    rating NUMERIC(2,1),
    url VARCHAR(255),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    created_at BIGINT
);

CREATE TABLE movies(
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    overview VARCHAR(4095),
    average_vote NUMERIC(10,5),
    total_votes NUMERIC(8),
    image_url VARCHAR(255),
    popularity NUMERIC(5,3),
    released_on VARCHAR(255),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    created_at BIGINT
);

CREATE TABLE meetups(
    id SERIAL PRIMARY KEY,
    link VARCHAR(255),
    name VARCHAR(255),
    creation_date VARCHAR(255),
    host VARCHAR(255),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    created_at BIGINT
);

CREATE TABLE trails(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    location VARCHAR(255),
    length NUMERIC(5,1),
    stars NUMERIC(2,1),
    star_votes NUMERIC(8),
    summary VARCHAR(4095),
    trail_url VARCHAR(255),
    conditions VARCHAR(255),
    condition_date VARCHAR(255),
    condition_time VARCHAR(255),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    created_at BIGINT
);