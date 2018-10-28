'use strict'

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

require('dotenv').config();

const PORT = process.env.PORT || 3000;

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));

const app = express();

app.use(cors());

app.get('/location', getLocation);

app.get('/weather', getWeather);

app.get('/yelp', getYelp);

app.get('/movies', getMovie);

app.get('/meetups', getMeetup);

function handleError(err, res){
  console.error('ERR', err);
  if (res) res.status(500).send('Oh NOOO!!!!  We\'re so sorry.  We really tried.');
}
/*---------------------LOCATION--------------------------*/
function Location(query, data){
  this.search_query = query;
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
}
Location.prototype.save = function(){
  let SQL = `
    INSERT INTO locations
      (search_query,formatted_query,latitude,longitude)
      VALUES($1,$2,$3,$4)
  `;
  let values = Object.values(this);
  client.query(SQL,values);
}

Location.fetchLocation = (query) => {
  const URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GOOGLE_MAPS_API}`;
  return superagent.get(URL)
    .then( data => {
      console.log('Retrieving data from API');
      if( ! data.body.results.length){ throw 'No Data Received';}
      else{
        let location = new Location(query, data.body.results[0]);
        location.save();
        return location;
      }
    });
};

function getLocation(request, response){
  const locationHandler = {

    query: request.query.data,

    cacheHit: (results) => {
      console.log('Got data from SQL');
      response.send(results.rows[0]);
    },

    cacheMiss: () => {
      Location.fetchLocation(request.query.data)
        .then(data => response.send(data));
    },
  };

  Location.lookupLocation(locationHandler);
}

Location.lookupLocation = (handler) => {

  const SQL = `SELECT * FROM locations where search_query=$1`;
  const values = [handler.query];

  return client.query( SQL, values)
    .then( results => {
      if(results.rowCount > 0){
        handler.cacheHit(results);
      }
      else{
        handler.cacheMiss();
      }
    })
    .catch( console.error );
}

/*---------------------WEATHER--------------------------*/

function DailyWeather(data){
  this.forecast = data.summary;
  this.time = new Date(data.time * 1000).toString().slice(0,15);
}

DailyWeather.prototype.save = function(id){
  const SQL = `INSERT INTO weathers (forecast, time, location_id, created_at) VALUES ($1, $2, $3, $4);`;
  const values = Object.values(this);
  values.push(id);
  values.push(Date.now());
  client.query(SQL, values);
}

DailyWeather.deleteEntrybyId = function (id){
  const SQL = `DELETE FROM weathers WHERE location_id=${id};`;
  client.query(SQL)
    .then(() =>{
      console.log('Deleted entry from SQL');
    })
    .catch(error => handleError(error));
}

DailyWeather.lookup = function(handler) {
  const SQL = `SELECT * FROM weathers WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result =>{
      if(result.rowCount > 0){
        let currentAge = (Date.now() - result.rows[0].created_at) / (1000 * 60); //invalidate every hour
        if( result.rowCount > 0 && currentAge > 1){
          console.log('Data was too old, refreshing');
          DailyWeather.deleteEntrybyId(handler.location.id);
          handler.cacheMiss();
        }
        else{
          console.log('Data in SQL and not too old');
          handler.cacheHit(result);
        }
      }
      else{
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

DailyWeather.fetch = function(location){
  const URL = `https://api.darksky.net/forecast/${process.env.DARK_SKY_API}/${location.latitude},${location.longitude}`;

  return superagent.get(URL)
    .then(result => {
      const weatherSummaries = result.body.daily.data.map(day =>{
        const summary = new DailyWeather(day);
        summary.save(location.id);
        return summary;
      });
      return weatherSummaries;
    });
};

function getWeather(request, response){
  const handler = {
    location: request.query.data,

    cacheHit: function(result) {
      response.send(result.rows);
    },

    cacheMiss: function() {
      DailyWeather.fetch(request.query.data)
        .then( results => response.send(results))
        .catch( console.error );
    },
  };

  DailyWeather.lookup(handler);
}

/*---------------------YELP--------------------------*/
function YelpRestaurants(data){
  this.name = data.name;
  this.image_url = data.image_url;
  this.price = data.price;
  this.rating = data.rating;
  this.url = data.url;
}

YelpRestaurants.prototype.save = function(id){
  const SQL = `INSERT INTO yelps (name, image_url, price, rating, url, location_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7);`;
  const values = Object.values(this);
  values.push(id);
  values.push(Date.now());
  client.query(SQL, values);
}

YelpRestaurants.deleteEntrybyId = function (id){
  const SQL = `DELETE FROM yelps WHERE location_id=${id};`;
  client.query(SQL)
    .then(() =>{
      console.log('Deleted entry from SQL');
    })
    .catch(error => handleError(error));
}

YelpRestaurants.lookup = function(handler) {
  const SQL = `SELECT * FROM yelps WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result =>{
      if(result.rowCount > 0){
        let currentAge = (Date.now() - result.rows[0].created_at) / (1000 * 3600);
        if( result.rowCount > 0 && currentAge > 1){
          console.log('Data was too old, refreshing');
          YelpRestaurants.deleteEntrybyId(handler.location.id);
          handler.cacheMiss();
        }
        else{
          console.log('Data in SQL and not too old');
          handler.cacheHit(result);
        }
      }
      else{
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

YelpRestaurants.fetch = function(location){
  const URL = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${location.latitude}&longitude=${location.longitude}`;
  return superagent.get(URL)
    .set('Authorization', `Bearer ${process.env.YELP_API}`)
    .then(result =>{
      const yelpSummaries = result.body.businesses.map(restaurant =>{
        const summary = new YelpRestaurants(restaurant);
        summary.save(location.id);
        return summary;
      })
      return yelpSummaries;
    })
    .catch(error => handleError(error));
}

function getYelp(request, response){
  const handler = {
    location: request.query.data,

    cacheHit: function(result) {
      response.send(result.rows);
    },

    cacheMiss: function() {
      YelpRestaurants.fetch(request.query.data)
        .then( results => response.send(results))
        .catch( console.error );
    },
  };

  YelpRestaurants.lookup(handler);
}

/*---------------------MOVIES--------------------------*/

function Movie(data){
  this.title = data.title;
  this.overview = data.overview;
  this.average_vote = data.vote_average;
  this.total_votes = data.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/original/${data.poster_path}`;
  this.popularity = data.popularity;
  this.released_on = data.release_date;
}

Movie.prototype.save = function(id){
  const SQL = `INSERT INTO movies (title, overview, average_vote, total_votes, image_url, popularity, released_on, location_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`;
  const values = Object.values(this);
  values.push(id);
  values.push(Date.now());
  client.query(SQL, values);
}

Movie.deleteEntrybyId = function (id){
  const SQL = `DELETE FROM movies WHERE location_id=${id};`;
  client.query(SQL)
    .then(() =>{
      console.log('Deleted entry from SQL');
    })
    .catch(error => handleError(error));
}

Movie.lookup = function(handler) {
  const SQL = `SELECT * FROM movies WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result =>{
      if(result.rowCount > 0){
        let currentAge = (Date.now() - result.rows[0].created_at) / (1000 * 3600 * 24);
        if( result.rowCount > 0 && currentAge > 1){
          console.log('Data was too old, refreshing');
          Movie.deleteEntrybyId(handler.location.id);
          handler.cacheMiss();
        }
        else{
          console.log('Data in SQL and not too old');
          handler.cacheHit(result);
        }
      }
      else{
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

Movie.fetch = function(location){
  let cityname = location.formatted_query.split(',')[0];
  const URL = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIES_API}&language=en-US&query=${cityname}&page=1`;
  return superagent.get(URL)
    .then(result =>{
      const movieSummaries = result.body.results.map(movie =>{
        const summary = new Movie(movie);
        summary.save(location.id);
        return summary;
      })
      return movieSummaries;
    })
    .catch(error => handleError(error));
}

function getMovie(request, response){
  const handler = {
    location: request.query.data,

    cacheHit: function(result) {
      response.send(result.rows);
    },

    cacheMiss: function() {
      Movie.fetch(request.query.data)
        .then(results => {
          response.send(results);
        })
        .catch( console.error );
    },
  };

  Movie.lookup(handler);
}

/*---------------------MEETUPS--------------------------*/

function Meetup(data){
  this.link = data.link;
  this.name = data.name;
  this.creation_date = new Date(data.created).toString().slice(0,15);
  this.host = data.group.name;
}

Meetup.prototype.save = function(id){
  const SQL = `INSERT INTO meetups (link, name, creation_date, host, location_id, created_at) VALUES ($1, $2, $3, $4, $5, $6);`;
  const values = Object.values(this);
  values.push(id);
  values.push(Date.now());
  client.query(SQL, values);
}

Meetup.deleteEntrybyId = function (id){
  const SQL = `DELETE FROM meetups WHERE location_id=${id};`;
  client.query(SQL)
    .then(() =>{
      console.log('Deleted entry from SQL');
    })
    .catch(error => handleError(error));
}

Meetup.lookup = function(handler) {
  const SQL = `SELECT * FROM meetups WHERE location_id=$1;`;
  client.query(SQL, [handler.location.id])
    .then(result =>{
      if(result.rowCount > 0){
        let currentAge = (Date.now() - result.rows[0].created_at) / (1000 * 3600 * 24);
        if( result.rowCount > 0 && currentAge > 1){
          console.log('Data was too old, refreshing');
          Movie.deleteEntrybyId(handler.location.id);
          handler.cacheMiss();
        }
        else{
          console.log('Data in SQL and not too old');
          handler.cacheHit(result);
        }
      }
      else{
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

Meetup.fetch = function(location){
  // let cityname = location.formatted_query.split(',')[0];
  // const URL = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIES_API}&language=en-US&query=${cityname}&page=1`;
  const URL = `https://api.meetup.com/find/upcoming_events?&sign=true&photo-host=public&lon=${location.longitude}&page=20&lat=${location.latitude}&key=${process.env.MEETUP_API}`;
  return superagent.get(URL)
    .then(result =>{
      // console.log(result);
      const meetupSummaries = result.body.events.map( meetup => {
        const summary = new Meetup(meetup);
        summary.save(location.id);
        return summary;
      })
      return meetupSummaries;
      // const movieSummaries = result.body.results.map(movie =>{
      //   const summary = new Movie(movie);
      //   summary.save(location.id);
      //   return summary;
      // })
      // return movieSummaries;
    })
    .catch(error => handleError(error));
}

function getMeetup(request, response){
  const handler = {
    location: request.query.data,

    cacheHit: function(result) {
      response.send(result.rows);
    },

    cacheMiss: function() {
      Meetup.fetch(request.query.data)
        .then(results => {
          response.send(results);
        })
        .catch( console.error );
    },
  };

  Meetup.lookup(handler);
}
app.listen(PORT, () => console.log(`App is up on ${PORT}`) );
